class BaseProvider {
  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
  }

  buildHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  getModelsPath() {
    return '/v1/models';
  }

  getChatPath() {
    return '/v1/chat/completions';
  }

  getImageGenPath() {
    return '/v1/images/generations';
  }

  transformRequest(body) {
    return body;
  }

  transformResponse(data) {
    return data;
  }

  buildUrl(path) {
    return `${this.baseUrl}${path}`;
  }

  request(path, method, headers, body) {
    const options = { method, headers };
    if (body && method !== 'GET') options.body = JSON.stringify(body);
    return fetch(this.buildUrl(path), options);
  }
}

module.exports = { BaseProvider };
