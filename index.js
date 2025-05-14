require('dotenv').config();

const express = require('express');

const { initializeScheduler } = require('./src/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initializeScheduler();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV}`);
});

module.exports = app;