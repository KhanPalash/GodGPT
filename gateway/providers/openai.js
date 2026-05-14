const { BaseProvider } = require('./base');

class OpenAIProvider extends BaseProvider {
  buildHeaders(apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }
}

module.exports = { OpenAIProvider };
