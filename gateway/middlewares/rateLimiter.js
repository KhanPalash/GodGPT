function createRateLimiter({ windowMs = 60000, maxRequests = 120 } = {}) {
  const hits = new Map();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const recent = (hits.get(ip) || []).filter(timestamp => now - timestamp < windowMs);

    if (recent.length >= maxRequests) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({
        error: 'Rate limit exceeded. Try again later.',
        provider: 'gateway',
        limit: maxRequests,
        window_ms: windowMs,
      });
    }

    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}

module.exports = { createRateLimiter };
