const { executeQuery } = require('../config/database');

class SocioModel {

  static async updateDataUltimaCobraca(idSocioVeiculo) {
    try {
      const query = `UPDATE SociosVeiculos SET DataUltimaCobraca = GETDATE() WHERE IdSocioVeiculo='${idSocioVeiculo}'`;
      return await executeQuery(query);
    } catch (error) {
      console.error('Erro ao atualizar data da última cobrança:', error);
      throw error;
    }
  }

  static async inativarSocio(idSocioVeiculo) {
    try {
      const query = `UPDATE SociosVeiculos SET Status = 'I' WHERE IdSocioVeiculo='${idSocioVeiculo}'`;
      return await executeQuery(query);
    } catch (error) {
      console.error('Erro ao inativar sócio:', error);
      throw error;
    }
  }

  static async getSociosVeiculos() {
    try {
      const query = `
        SELECT 
          B.Nome,
          B.Email,
          REPLACE(REPLACE(REPLACE(REPLACE(B.Telefone, '(', ''), ')', ''), '-', ''), ' ', '') AS TelefoneLimpo,
          A.*
        FROM SociosVeiculos AS A
        INNER JOIN Socios AS B ON A.IdSocio = B.IdSocio
        WHERE A.Status = 'A'
          AND (A.Blacklist IS NULL OR A.Blacklist = 0)
          AND (A.Cancelado IS NULL OR A.Cancelado = 0)
          AND A.IdAsaas IS NOT NULL
          AND A.IdAsaas NOT IN ('', 'sem_pagto')
          AND A.FormaPagamento = 'CC'
          AND (
            A.DataUltimaCobraca IS NULL
            OR CAST(A.DataUltimaCobraca AS DATE) < CAST(GETDATE() AS DATE)
          )
          AND A.IdSocioVeiculo != 'E89044C0-63FA-4362-913A-54F987E4FF78' --(dyllan) depois tirar isso
        ORDER BY B.Nome ASC;
      `;
      
      return await executeQuery(query);
    } catch (error) {
      console.error('Erro ao buscar sócios com pagamento atrasado:', error);
      throw error;
    }
  }

  static async registrarNotificacaoEnviada(socioId, tipoNotificacao, statusEnvio, detalhes = null) {
    try {
      // Função para escapar aspas simples para SQL Server
      const escapeSqlString = (str) => str.replace(/'/g, "''");
  
      const query = `
        INSERT INTO NotificacoesCobranca (
          IdNotificacaoCobranca, 
          IdSocioVeiculo, 
          TipoNotificacao, 
          DataEnvio, 
          StatusEnvio, 
          Detalhes
        ) VALUES (
          NEWID(),
          '${escapeSqlString(socioId)}',
          '${escapeSqlString(tipoNotificacao)}',
          GETDATE(),
          '${escapeSqlString(statusEnvio)}',
          ${detalhes ? `'${escapeSqlString(detalhes)}'` : 'NULL'}
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