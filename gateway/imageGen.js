const GEMINI_IMAGE_MODELS = [
  'imagen-3.0-generate',
  'imagen-2.0-generate',
  'imagegeneration@006',
];

const RETRYABLE_ERROR_CODES = new Set([404, 429, 403]);

function isRetryableError(err) {
  if (err.status) return RETRYABLE_ERROR_CODES.has(err.status);
  const msg = (err.message || '').toLowerCase();
  return msg.includes('resource_exhausted') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('model not found') ||
    msg.includes('not found') ||
    msg.includes('permission denied');
}

function mapAspectRatio(ar) {
  const map = { '1:1': '1:1', '16:9': '16:9', '9:16': '9:16', '4:3': '4:3', '3:4': '3:4' };
  return map[ar] || '1:1';
}

function mapImageSize(res) {
  const map = { '1K': '1K', '2K': '2K', '4K': '4K' };
  return map[res] || '1K';
}

async function generateGeminiImage({ apiKey, model, prompt, n, aspectRatio, imageSize }) {
  const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = await import('@google/genai');
  const safetySettings = Object.keys(HarmCategory).map(key => ({
    category: HarmCategory[key],
    threshold: HarmBlockThreshold.BLOCK_NONE,
  }));
  const ai = new GoogleGenAI({ apiKey: apiKey || undefined });

  try {
    const response = await ai.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: Math.min(n, 4),
        aspectRatio,
        imageSize,
        safetyFilterLevel: undefined,
        safetySettings,
        outputMimeType: 'image/png',
      },
    });

    const generatedImages = response.generatedImages || [];
    if (!generatedImages.length) {
      return { success: false, retryable: false, status: 422, error: { error: 'No images generated. The prompt may have been blocked by safety filters.' } };
    }

    return {
      success: true,
      data: {
        created: Math.floor(Date.now() / 1000),
        data: generatedImages.map(img => ({ url: `data:${img.image?.mimeType || 'image/png'};base64,${img.image?.imageBytes || ''}` })),
        _revised_prompts: generatedImages.map(img => img.enhancedPrompt || prompt),
        _model: model,
      },
    };
  } catch (err) {
    const message = err.message || '';
    const status = err.status || err.response?.status || 500;
    return { success: false, retryable: isRetryableError(err), status, error: { error: message || 'Gemini image generation failed' } };
  }
}

async function handleDalle(req, res, apiKey, baseUrl) {
  const { prompt, model = 'dall-e-3', n = 1, aspect_ratio, resolution, size } = req.body;
  let dalleSize = size || '1024x1024';
  if (resolution) dalleSize = { '1K': '1024x1024', '2K': '1792x1024', '4K': '2048x2048' }[resolution] || '1024x1024';
  if (aspect_ratio === '16:9') dalleSize = '1792x1024';
  else if (aspect_ratio === '9:16') dalleSize = '1024x1792';

  const targetUrl = `${(baseUrl || 'https://api.openai.com').replace(/\/$/, '')}/v1/images/generations`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model.startsWith('dall-e') ? model : 'dall-e-3',
        prompt,
        n: Math.min(Number(n) || 1, 10),
        size: dalleSize,
        response_format: 'url',
      }),
    });

    if (!response.ok) return res.status(response.status).json({ error: await response.text() });
    const data = await response.json();
    return res.json({
      created: data.created || Math.floor(Date.now() / 1000),
      data: (data.data || []).map(item => ({ url: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url || '' })),
    });
  } catch (err) {
    return res.status(502).json({ error: `DALL-E upstream error: ${err.message}` });
  }
}

module.exports = {
  GEMINI_IMAGE_MODELS,
  isRetryableError,
  mapAspectRatio,
  mapImageSize,
  generateGeminiImage,
  handleDalle,
};
