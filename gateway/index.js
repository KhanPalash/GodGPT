const { Readable } = require('stream');
const {
  PROVIDER_REGISTRY,
  getProviderForModel,
  getProviderBaseUrl,
  getProviderApiKey,
  getAllProviders,
} = require('./utils/config');
const { createProvider } = require('./providers');
const {
  GEMINI_IMAGE_MODELS,
  generateGeminiImage,
  handleDalle,
  isRetryableError,
  mapAspectRatio,
  mapImageSize,
} = require('./imageGen');

const REFUSAL_PATTERNS = [
  /i can'?t\b/i,
  /i cannot\b/i,
  /i won'?t\b/i,
  /i'?m sorry\b/i,
  /i am sorry\b/i,
  /against my (guidelines|principles|policies)/i,
  /i apologize\b/i,
  /i am unable\b/i,
  /not (something )?i can (help with|provide)/i,
  /cannot (assist|help|provide|answer)/i,
];

function extractAssistantText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(part => part.text || '').join(' ');
  return '';
}

function detectRefusal(text) {
  return REFUSAL_PATTERNS.some(pattern => pattern.test(text || ''));
}

class Gateway {
  constructor() {
    this.providers = new Map();
  }

  getProvider(name) {
    const providerName = name || 'openrouter';
    if (!this.providers.has(providerName)) {
      this.providers.set(providerName, createProvider(providerName, getProviderBaseUrl(providerName)));
    }
    return this.providers.get(providerName);
  }

  resolveProvider(req) {
    const providerName = req.headers['x-provider'] || req.query?.provider || getProviderForModel(req.body?.model || req.query?.model || '');
    return { providerName, provider: this.getProvider(providerName) };
  }

  getApiKey(req, providerName) {
    const headerKey = req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    return getProviderApiKey(providerName, headerKey);
  }

  async handleModels(req, res) {
    const { providerName, provider } = this.resolveProvider(req);
    const headers = provider.buildHeaders(this.getApiKey(req, providerName));

    try {
      const response = await provider.request(provider.getModelsPath(), 'GET', headers, null);
      const data = await response.json();
      if (Array.isArray(data.data)) data.data.forEach(model => { model._provider = providerName; });
      res.setHeader('x-routed-provider', providerName);
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: `Upstream error (${providerName}): ${err.message}`, provider: providerName });
    }
  }

  async handleChat(req, res) {
    const { providerName, provider } = this.resolveProvider(req);
    const headers = provider.buildHeaders(this.getApiKey(req, providerName));
    const body = provider.transformRequest(req.body);
    const stream = req.body?.stream === true;

    try {
      const response = await provider.request(provider.getChatPath(), 'POST', headers, body);

      if (!response.ok) {
        return res.status(response.status).json({ error: await response.text(), provider: providerName });
      }

      res.setHeader('x-routed-provider', providerName);

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        const readable = Readable.fromWeb(response.body);
        readable.on('error', (err) => {
          console.error(`[stream error] ${providerName}: ${err.message}`);
          if (!res.headersSent) res.status(502).json({ error: 'Stream error' });
        });
        res.on('close', () => readable.destroy());
        return readable.pipe(res);
      }

      const data = provider.transformResponse(await response.json());
      const refusalDetected = detectRefusal(extractAssistantText(data));
      res.setHeader('x-refusal-detected', String(refusalDetected));
      if (data && typeof data === 'object' && !Array.isArray(data)) data.refusal_detected = refusalDetected;
      return res.json(data);
    } catch (err) {
      return res.status(502).json({ error: `Upstream error (${providerName}): ${err.message}`, provider: providerName });
    }
  }

  async handleImageGen(req, res) {
    const { prompt, model, n = 1, aspect_ratio, resolution, api_key, base_url } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "prompt" field' });
    }

    // Use gateway auth if body doesn't provide keys
    const apiKey = api_key || this.getApiKey(req, 'openai');
    const baseUrl = base_url || getProviderBaseUrl('openai');

    const modelText = (model || '').toLowerCase();
    if (modelText.startsWith('dall-e') || modelText === 'dall-e-3') {
      res.setHeader('x-routed-provider', 'openai-images');
      return handleDalle(req, res, apiKey, baseUrl);
    }

    let modelsToTry;
    if (model && GEMINI_IMAGE_MODELS.includes(model)) {
      const index = GEMINI_IMAGE_MODELS.indexOf(model);
      modelsToTry = [model, ...GEMINI_IMAGE_MODELS.slice(index + 1)];
    } else if (model) {
      modelsToTry = [model, ...GEMINI_IMAGE_MODELS];
    } else {
      modelsToTry = [...GEMINI_IMAGE_MODELS];
    }

    for (const modelName of modelsToTry) {
      try {
        const result = await generateGeminiImage({
          apiKey,
          model: modelName,
          prompt,
          n: Math.min(Number(n) || 1, 4),
          aspectRatio: mapAspectRatio(aspect_ratio),
          imageSize: mapImageSize(resolution),
        });

        if (result.success) {
          res.setHeader('x-routed-provider', 'google-gemini');
          return res.json(result.data);
        }

        if (result.retryable && modelName !== modelsToTry[modelsToTry.length - 1]) continue;
        return res.status(result.status || 500).json(result.error || { error: 'Image generation failed' });
      } catch (err) {
        if (isRetryableError(err) && modelName !== modelsToTry[modelsToTry.length - 1]) continue;
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(500).json({ error: 'All image generation models failed' });
  }

  health(req, res) {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      routing: 'gateway',
      default_provider: 'openrouter',
      providers: getAllProviders(),
    });
  }

  listRoutes(req, res) {
    return res.json([
      { prefix: 'groq/', provider: 'groq', baseUrl: PROVIDER_REGISTRY.groq, note: 'Groq OpenAI-compatible API' },
      { prefix: 'ollama/', provider: 'ollama', baseUrl: PROVIDER_REGISTRY.ollama, note: 'Local Ollama OpenAI-compatible API' },
      { prefix: 'openai/', provider: 'openai', baseUrl: PROVIDER_REGISTRY.openai, note: 'OpenAI API' },
      { prefix: 'openrouter/', provider: 'openrouter', baseUrl: PROVIDER_REGISTRY.openrouter, note: 'OpenRouter or 9router API' },
      { prefix: '(all others)', provider: 'openrouter', baseUrl: PROVIDER_REGISTRY.openrouter, note: 'Default route' },
    ]);
  }

  listProviders(req, res) {
    return res.json(getAllProviders());
  }

  printRoutes() {
    console.log('Gateway routes enabled:');
    console.log('  GET  /v1/models');
    console.log('  POST /v1/chat/completions');
    console.log('  POST /v1/images/generations');
    console.log('  GET  /api/health');
    console.log('  GET  /api/routes');
    console.log('  GET  /api/providers');
  }
}

module.exports = { Gateway, detectRefusal, extractAssistantText };
