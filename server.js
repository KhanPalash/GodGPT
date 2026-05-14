const express = require('express');
const path = require('path');
const { Gateway } = require('./gateway');
const { createRateLimiter } = require('./gateway/middlewares/rateLimiter');
const { createRequestLogger } = require('./gateway/middlewares/requestLogger');

const app = express();
const PORT = process.env.PORT || 3001;
const gateway = new Gateway();

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/v1', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Provider, X-Api-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(createRequestLogger());
app.use('/v1', createRateLimiter({ windowMs: 60000, maxRequests: 120 }));

app.get('/api/health', (req, res) => gateway.health(req, res));
app.get('/api/routes', (req, res) => gateway.listRoutes(req, res));
app.get('/api/providers', (req, res) => gateway.listProviders(req, res));
app.get('/v1/models', (req, res) => gateway.handleModels(req, res));
app.post('/v1/chat/completions', (req, res) => gateway.handleChat(req, res));
app.post('/v1/images/generations', (req, res) => gateway.handleImageGen(req, res));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GodGPT Gateway running at http://localhost:${PORT}`);
  gateway.printRoutes();
});
