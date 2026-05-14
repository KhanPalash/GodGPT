const { BaseProvider } = require('./base');

class OllamaProvider extends BaseProvider {
  buildHeaders() {
    return { 'Content-Type': 'application/json' };
  }
}

module.exports = { OllamaProvider };
