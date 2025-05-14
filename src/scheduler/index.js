// Centralizador de todos os jobs do sistema
const CobrancaJob = require('../jobs/cobrancaJob');

function initializeScheduler() {
  CobrancaJob.initialize();
}

module.exports = {
  initializeScheduler
};