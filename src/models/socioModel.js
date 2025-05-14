const { executeQuery } = require('../config/database');

class SocioModel {

  static async getSociosComPagamentoAtrasado(diasAtraso = 5) {
    try {
      const query = `
        SELECT 
          S.Id,
          S.Nome, 
          S.Email, 
          S.Telefone, 
          A.DataVencimento,
          DATEDIFF(day, A.DataVencimento, GETDATE()) AS DiasAtraso
        FROM 
          Socios S
          INNER JOIN Assinaturas A ON S.Id = A.SocioId
        WHERE 
          DATEDIFF(day, A.DataVencimento, GETDATE()) >= ${diasAtraso}
          AND A.StatusPagamento = 'Pendente'
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