// src/utils/logger.js
// Utilitário para padronização de logs

const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp(),
  printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

const fileFormat = combine(
  timestamp(),
  json()
);

const logDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'automacao-service' },
  transports: [
    // Salva logs de erro em um arquivo separado
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Salva todos os logs em um arquivo combinado
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    // Logs no console para ambiente de desenvolvimento
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
});

module.exports = { logger };