const express = require('express');
const http = require('http');
const { Readable } = require('stream');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// Auto-Routing: model prefix → provider base URL
// NOTE: baseUrl should NOT include /v1 — it's appended in the proxy call
// ============================================================
const ROUTES = [
  // Groq (fast free tier) — baseUrl already has /openai/v1
  { prefix: 'groq/', baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com', provider: 'groq' },
  // Ollama (local) — baseUrl already has /v1
  { prefix: 'ollama/', baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434', provider: 'ollama' },
  // OpenRouter / 9router / fallback — baseUrl already has /v1
  { prefix: '', baseUrl: process.env.DEFAULT_BASE_URL || 'http://localhost:20128', provider: 'openrouter' },
];

// IMPORTANT: Providers that share the same base URL as default (9router/openrouter)
// should NOT be listed above — they'll all go through the same endpoint.
// If you want to use a provider directly, set the base URL without /v1 and it will be appended.
// ============================================================

// Route to specific provider by base URL (set via env or config)
// For direct provider calls, set env vars WITHOUT /v1 suffix:
const DIRECT_PROVIDERS = {
  openai:   process.env.OPENAI_BASE_URL,       // e.g. https://api.openai.com (no /v1)
  groq:     process.env.GROQ_BASE_URL,          // e.g. https://api.groq.com
  ollama:   process.env.OLLAMA_BASE_URL,        // e.g. http://localhost:11434
};

function findRoute(model) {
  const m = (model || '').toLowerCase();
  // Check prefixes that need specific routing
  if (m.includes('groq/')) {
    const base = DIRECT_PROVIDERS.groq || 'https://api.groq.com';
    return { prefix: 'groq/', baseUrl: base, provider: 'groq' };
  }
  if (m.includes('ollama/')) {
    const base = DIRECT_PROVIDERS.ollama || 'http://localhost:11434';
    return { prefix: 'ollama/', baseUrl: base, provider: 'ollama' };
  }
  // Everything else → default (9router/openrouter proxy)
  const base = process.env.DEFAULT_BASE_URL || 'http://localhost:20128';
  return { prefix: '', baseUrl: base, provider: 'openrouter' };
}

// ============================================================
// CORS
// ============================================================
app.use('/v1', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Provider, X-Api-Key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================================
// Routes listing
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    routing: 'auto-route by model prefix via 9router',
    default_provider: 'openrouter (localhost:20128)',
    direct_providers: Object.entries(DIRECT_PROVIDERS).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`)
  });
});

// List all supported routes
app.get('/api/routes', (req, res) => {
  res.json([
    { prefix: 'groq/', provider: 'groq', baseUrl: 'https://api.groq.com', note: 'free fast tier' },
    { prefix: 'ollama/', provider: 'ollama', baseUrl: 'http://localhost:11434', note: 'local models' },
    { prefix: '(all others)', provider: 'openrouter', baseUrl: 'http://localhost:20128', note: 'default via 9router' },
  ]);
});

// ============================================================
// Proxy: GET /v1/models
// Fetches from the default / first provider listed
// ============================================================
app.get('/v1/models', async (req, res) => {
  // Allow ?model=xxx to route to specific provider
  const modelHint = req.query.model;
  const overrideProvider = req.query.provider;
  const apiKey = req.headers['x-api-key'] || '';

  let route;
  if (overrideProvider) {
    route = ROUTES.find(r => r.provider === overrideProvider) || ROUTES[ROUTES.length - 1];
  } else if (modelHint) {
    route = findRoute(modelHint);
  } else {
    route = ROUTES[ROUTES.length - 1]; // default
  }

  const targetUrl = `${route.baseUrl.replace(/\/$/, '')}/v1/models`;
  console.log(`[GET /v1/models] → ${route.provider}: ${targetUrl}`);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    else if (route.provider === 'anthropic') headers['x-api-key'] = apiKey;

    const response = await fetch(targetUrl, { method: 'GET', headers });
    const data = await response.json();
    // Tag models with their provider
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(m => { m._provider = route.provider; });
    }
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `Upstream error (${route.provider}): ${err.message}` });
  }
});

// ============================================================
// Proxy: POST /v1/chat/completions
// Auto-routes based on model name in request body
// ============================================================
app.post('/v1/chat/completions', async (req, res) => {
  const model = req.body.model || '';
  const overrideProvider = req.headers['x-provider'];
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || '';

  let route;
  if (overrideProvider) {
    route = ROUTES.find(r => r.provider === overrideProvider) || findRoute(model);
  } else {
    route = findRoute(model);
  }

  const targetUrl = `${route.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const stream = req.body.stream === true;

  console.log(`[POST /v1/chat/completions] model=${model} → ${route.provider}: ${targetUrl}`);

  try {
    const headers = { 'Content-Type': 'application/json' };

    // Route-specific auth headers
    if (route.provider === 'anthropic') {
      // Anthropic uses x-api-key header
      headers['x-api-key'] = apiKey;
      // Anthropic specific headers
      headers['anthropic-version'] = '2023-06-01';
      // Strip Authorization header for Anthropic
      delete headers['Authorization'];
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[${route.provider}] error ${response.status}: ${errBody.slice(0, 200)}`);
      return res.status(response.status).json({ error: errBody, provider: route.provider });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('X-Routed-Provider', route.provider);
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.setHeader('X-Routed-Provider', route.provider);
      const data = await response.json();
      res.json(data);
    }
  } catch (err) {
    console.error(`[${route.provider}] fetch error: ${err.message}`);
    res.status(502).json({ error: `Upstream error (${route.provider}): ${err.message}`, provider: route.provider });
  }
});

// ============================================================
// Image Generation: POST /v1/images/generations
// ============================================================
const GEMINI_IMAGE_MODELS = [
  'imagen-3.0-generate',
  'imagen-2.0-generate',
  'imagegeneration@006',
];

// Retryable error codes for cascading fallback
const RETRYABLE_ERROR_CODES = new Set([404, 429, 403]);

function isRetryableError(err) {
  if (err.status) return RETRYABLE_ERROR_CODES.has(err.status);
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('resource_exhausted') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('model not found') ||
    msg.includes('not found') ||
    msg.includes('permission denied')
  );
}

// Map aspect ratio labels to API values
function mapAspectRatio(ar) {
  const map = {
    '1:1': '1:1',
    '16:9': '16:9',
    '9:16': '9:16',
    '4:3': '4:3',
    '3:4': '3:4',
  };
  return map[ar] || '1:1';
}

// Map resolution label to imageSize
function mapImageSize(res) {
  const map = { '1K': '1K', '2K': '2K', '4K': '4K' };
  return map[res] || '1K';
}

app.post('/v1/images/generations', async (req, res) => {
  const { prompt, model, n = 1, aspect_ratio, resolution, api_key, base_url } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" field' });
  }

  const apiKey = api_key || '';
  const bUrl = (base_url || '').replace(/\/$/, '');

  console.log(`[POST /v1/images/generations] model=${model} prompt="${prompt.slice(0, 50)}..."`);

  // Determine if this is a Gemini model
  const modelStr = (model || '').toLowerCase();
  const isDalle = modelStr.startsWith('dall-e') || modelStr === 'dall-e-3';

  if (isDalle) {
    // --- DALL-E via OpenAI API ---
    await handleDalle(req, res, apiKey, bUrl);
    return;
  }

  // --- Gemini image generation with cascading fallback ---
  await handleGeminiWithFallback(req, res, apiKey, bUrl);
});

async function handleGeminiWithFallback(req, res, apiKey, baseUrl) {
  const { prompt, model: requestedModel, n = 1, aspect_ratio, resolution } = req.body;

  // Build the list of models to try (fallback chain)
  let modelsToTry = [];

  if (requestedModel && GEMINI_IMAGE_MODELS.includes(requestedModel)) {
    // Use requested model first, then fall back to the rest
    const idx = GEMINI_IMAGE_MODELS.indexOf(requestedModel);
    modelsToTry = [requestedModel, ...GEMINI_IMAGE_MODELS.slice(idx + 1)];
  } else if (requestedModel) {
    // Use requested model as primary, then full fallback chain
    modelsToTry = [requestedModel, ...GEMINI_IMAGE_MODELS];
  } else {
    modelsToTry = [...GEMINI_IMAGE_MODELS];
  }

  const ar = mapAspectRatio(aspect_ratio);
  const imgSize = mapImageSize(resolution);

  for (const modelName of modelsToTry) {
    try {
      const result = await generateGeminiImage({
        apiKey,
        baseUrl,
        model: modelName,
        prompt,
        n: Math.min(Number(n) || 1, 4),
        aspectRatio: ar,
        imageSize: imgSize,
      });

      if (result.success) {
        console.log(`[Image Gen] Success with model=${modelName}`);
        return res.json(result.data);
      }

      // If model returned an error, check if it's retryable
      if (result.retryable && modelName !== modelsToTry[modelsToTry.length - 1]) {
        console.log(`[Image Gen] Retryable error with ${modelName}, trying next model...`);
        continue;
      }

      // Non-retryable or last model — return error
      return res.status(result.status || 500).json(result.error || { error: 'Image generation failed' });

    } catch (err) {
      console.error(`[Image Gen] Exception with ${modelName}: ${err.message}`);
      if (isRetryableError(err) && modelName !== modelsToTry[modelsToTry.length - 1]) {
        continue;
      }
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(500).json({ error: 'All image generation models failed' });
}

async function generateGeminiImage({ apiKey, baseUrl, model, prompt, n, aspectRatio, imageSize }) {
  // Dynamic import of ES module
  const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = await import('@google/genai');

  // Build safety settings: BLOCK_NONE for all categories
  const safetySettings = Object.keys(HarmCategory).map(key => ({
    category: HarmCategory[key],
    threshold: HarmBlockThreshold.BLOCK_NONE,
  }));

  const ai = new GoogleGenAI({ apiKey: apiKey || undefined });

  // Build request config
  const config = {
    numberOfImages: Math.min(n, 4),
    aspectRatio,
    imageSize,
    safetyFilterLevel: undefined, // use safetySettings below
    safetySettings,
    outputMimeType: 'image/png',
  };

  try {
    const response = await ai.models.generateImages({
      model,
      prompt,
      config,
    });

    const generatedImages = response.generatedImages || [];

    if (!generatedImages.length) {
      return {
        success: false,
        retryable: false,
        status: 422,
        error: { error: 'No images generated. The prompt may have been blocked by safety filters.' }
      };
    }

    // Convert base64 image bytes to data URLs
    const images = generatedImages.map((img, idx) => {
      const bytes = img.image?.imageBytes || '';
      const mimeType = img.image?.mimeType || 'image/png';
      const dataUrl = `data:${mimeType};base64,${bytes}`;
      return { url: dataUrl, revised_prompt: img.enhancedPrompt || prompt };
    });

    return {
      success: true,
      data: {
        created: Math.floor(Date.now() / 1000),
        data: images.map(img => ({ url: img.url })),
        _revised_prompts: images.map(img => img.revised_prompt),
        _model: model,
      }
    };

  } catch (err) {
    // Parse error for retryable conditions
    const errMsg = err.message || '';
    const errStatus = err.status || (err.response?.status);

    const isRetryable =
      errStatus === 404 ||
      errStatus === 429 ||
      errStatus === 403 ||
      errMsg.toLowerCase().includes('resource_exhausted') ||
      errMsg.toLowerCase().includes('not found') ||
      errMsg.toLowerCase().includes('permission') ||
      errMsg.toLowerCase().includes('quota');

    return {
      success: false,
      retryable: isRetryable,
      status: errStatus || 500,
      error: { error: errMsg || 'Gemini image generation failed' }
    };
  }
}

async function handleDalle(req, res, apiKey, baseUrl) {
  const { prompt, model = 'dall-e-3', n = 1, aspect_ratio, resolution, size } = req.body;

  // Determine DALL-E size
  let dalleSize = size || '1024x1024';
  if (resolution) {
    const resMap = { '1K': '1024x1024', '2K': '1792x1024', '4K': '2048x2048' };
    dalleSize = resMap[resolution] || '1024x1024';
  }
  // Override with aspect ratio if specified (DALL-E 3 supports specific sizes)
  if (aspect_ratio === '16:9') dalleSize = '1792x1024';
  else if (aspect_ratio === '9:16') dalleSize = '1024x1792';

  const targetUrl = `${baseUrl || 'https://api.openai.com'}/v1/images/generations`;
  console.log(`[DALL-E] → ${targetUrl}`);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model.startsWith('dall-e') ? model : 'dall-e-3',
        prompt,
        n: Math.min(Number(n) || 1, 10),
        size: dalleSize,
        response_format: 'url',
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[DALL-E] error ${response.status}: ${errBody.slice(0, 200)}`);
      return res.status(response.status).json({ error: errBody });
    }

    const data = await response.json();

    // Normalize to OpenAI format: {created, data:[{url}]}
    return res.json({
      created: data.created || Math.floor(Date.now() / 1000),
      data: (data.data || []).map(item => ({
        url: item.url || item.b64_json ? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url) : ''
      }))
    });

  } catch (err) {
    console.error(`[DALL-E] fetch error: ${err.message}`);
    return res.status(502).json({ error: `DALL-E upstream error: ${err.message}` });
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GodGPT server running at http://localhost:${PORT}`);
  console.log('Auto-routing enabled:');
  ROUTES.forEach(r => console.log(`  ${r.prefix || '(default)'}: ${r.provider} → ${r.baseUrl}`));
});
