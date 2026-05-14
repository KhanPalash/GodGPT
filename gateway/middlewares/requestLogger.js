function createRequestLogger() {
  return function requestLogger(req, res, next) {
    const startedAt = Date.now();
    const requestId = Math.random().toString(36).slice(2, 10);
    const model = req.body?.model || req.query?.model || '-';

    console.log(`[${requestId}] --> ${req.method} ${req.path}`, {
      ip: req.ip,
      provider: req.headers['x-provider'] || req.query?.provider || '-',
      model,
      stream: req.body?.stream === true,
    });

    res.on('finish', () => {
      console.log(`[${requestId}] <-- ${res.statusCode} (${Date.now() - startedAt}ms)`, {
        provider: res.getHeader('x-routed-provider') || '-',
      });
    });

    next();
  };
}

module.exports = { createRequestLogger };
