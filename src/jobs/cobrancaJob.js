const cron = require('node-cron');
const CobrancaService = require('../services/cobrancaService');
const { logger } = require('../utils/logger');

// Define a execução do job
class CobrancaJob {
  static initialize() {
    logger.info('Inicializando job de cobrança automatizada');
    
    // Agenda para executar todos os dias às 10h da manhã
    cron.schedule('* * * * *', async () => {
      logger.info('Executando job de cobrança automatizada');
      
      try {
        const resultado = await CobrancaService.executarCobranca();
        
        if (resultado.success) {
          logger.info(`Job de cobrança finalizado. Processados: ${resultado.total} sócios`);
        } else {
          logger.error(`Job de cobrança falhou: ${resultado.error}`);
        }
      } catch (error) {
        logger.error('Erro na execução do job de cobrança:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });
    
    logger.info('Job de cobrança agendado para executar às 10h da manhã todos os dias');
  }
  
  // Método para execução manual (útil para testes)
  static async executarManualmente() {
    logger.info('Iniciando execução manual do job de cobrança');
    return await CobrancaService.executarCobranca();
  }
}

module.exports = CobrancaJob;