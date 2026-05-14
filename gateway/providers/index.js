const { OpenAIProvider } = require('./openai');
const { GroqProvider } = require('./groq');
const { OllamaProvider } = require('./ollama');

const PROVIDER_CLASSES = {
  openai: OpenAIProvider,
  groq: GroqProvider,
  ollama: OllamaProvider,
  openrouter: OpenAIProvider,
  default: OpenAIProvider,
};

function createProvider(name, baseUrl) {
  const ProviderClass = PROVIDER_CLASSES[name] || PROVIDER_CLASSES.default;
  return new ProviderClass(name, baseUrl);
}

module.exports = { createProvider, PROVIDER_CLASSES };
