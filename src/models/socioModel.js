const { executeQuery } = require('../config/database');

class SocioModel {

  static async getSociosVeiculos() {
    try {
      const query = `
        SELECT * FROM SociosVeiculos;
      `;
      
      return await executeQuery(query);
    } catch (error) {
      console.error('Erro ao buscar sócios com pagamento atrasado:', error);
      throw error;
    }
  }

  static async registrarNotificacaoEnviada(socioId, tipoNotificacao, statusEnvio, detalhes = null) {
    try {
      const query = `
        INSERT INTO NotificacoesCobranca (SocioId, TipoNotificacao, DataEnvio, StatusEnvio, Detalhes)
        VALUES (
          ${socioId}, 
          '${tipoNotificacao}', 
          GETDATE(), 
          '${statusEnvio}', 
          ${detalhes ? `'${detalhes}'` : 'NULL'}
        )
      `;
      
      return await executeQuery(query);
    } catch (error) {
      console.error('Erro ao registrar notificação enviada:', error);
      return null;
    }
  }
}

module.exports = SocioModel;