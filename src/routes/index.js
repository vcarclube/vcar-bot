const express = require('express');
const cobrancaRoutes = require('./cobrancaRoutes');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    serverTime: new Date().toLocaleString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

router.use('/cobranca', cobrancaRoutes);

module.exports = router;