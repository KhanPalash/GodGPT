const PROVIDER_REGISTRY = {
  openai: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
  groq: process.env.GROQ_BASE_URL || 'https://api.groq.com',
  ollama: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  openrouter: process.env.OPENROUTER_BASE_URL || process.env.DEFAULT_BASE_URL || 'http://localhost:20128',
  default: process.env.DEFAULT_BASE_URL || 'http://localhost:20128',
};

const MODEL_PREFIX_MAP = {
  'groq/': 'groq',
  'ollama/': 'ollama',
  'openai/': 'openai',
  'openrouter/': 'openrouter',
};

const ENV_KEY_MAP = {
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  ollama: null,
  openrouter: 'OPENROUTER_API_KEY',
  default: 'DEFAULT_API_KEY',
};

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || '').replace(/\/$/, '');
}

function getProviderForModel(model) {
  const text = (model || '').toLowerCase();
  for (const [prefix, provider] of Object.entries(MODEL_PREFIX_MAP)) {
    if (text.includes(prefix)) return provider;
  }
  return 'openrouter';
}

function getProviderBaseUrl(provider) {
  return normalizeBaseUrl(PROVIDER_REGISTRY[provider] || PROVIDER_REGISTRY.default);
}

function getProviderApiKey(provider, headerKey) {
  if (headerKey) return headerKey;
  const envName = ENV_KEY_MAP[provider] || ENV_KEY_MAP.default;
  return envName ? (process.env[envName] || '') : '';
}

function getAllProviders() {
  return Object.entries(PROVIDER_REGISTRY)
    .filter(([name]) => name !== 'default')
    .map(([name, baseUrl]) => ({
      name,
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKeySet: !!process.env[ENV_KEY_MAP[name]],
    }));
}

module.exports = {
  PROVIDER_REGISTRY,
  MODEL_PREFIX_MAP,
  getProviderForModel,
  getProviderBaseUrl,
  getProviderApiKey,
  getAllProviders,
  normalizeBaseUrl,
};
