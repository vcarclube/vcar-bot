const express = require('express');
const router = express.Router();

router.get('/status', (req, res) => {
  return res.status(200).json({ 
    message: 'Funcionalidade em desenvolvimento'
  });
});

module.exports = router;