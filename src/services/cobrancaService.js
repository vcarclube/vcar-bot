const SocioModel = require('../models/socioModel');
const { enviarEmail } = require('../config/email');
const { enviarWhatsApp } = require('../config/whatsapp');
const { logger } = require('../utils/logger');

class CobrancaService {

  static async executarCobranca() {
    logger.info('Iniciando processo de cobrança: ' + new Date().toLocaleString());
    
    try {

      const sociosAtrasados = await SocioModel.getSociosComPagamentoAtrasado(5);
      logger.info(`Encontrados ${sociosAtrasados.length} sócios com pagamento atrasado.`);
      
      for (const socio of sociosAtrasados) {
        await this.processarCobrancaSocio(socio);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info('Processo de cobrança finalizado com sucesso.');
      return { success: true, total: sociosAtrasados.length };
    } catch (error) {
      logger.error('Erro durante o processo de cobrança:', error);
      return { success: false, error: error.message };
    }
  }

  static async processarCobrancaSocio(socio) {
    try {
      // Envia WhatsApp se tiver telefone cadastrado
      if (socio.Telefone) {
        const mensagemWhatsApp = this.gerarMensagemCobrancaWhatsApp(socio.Nome, socio.DiasAtraso);
        const resultWhatsApp = await enviarWhatsApp(socio.Telefone, mensagemWhatsApp);
        
        // Registra a notificação enviada
        await SocioModel.registrarNotificacaoEnviada(
          socio.Id, 
          'whatsapp', 
          resultWhatsApp.success ? 'enviado' : 'falha',
          resultWhatsApp.messageId || resultWhatsApp.error
        );
      }
      
      // Envia Email se tiver email cadastrado
      if (socio.Email) {
        const assunto = 'Lembrete de Pagamento Pendente';
        const corpoEmail = this.gerarCorpoEmailCobranca(socio.Nome, socio.DiasAtraso);
        const resultEmail = await enviarEmail(socio.Email, assunto, corpoEmail, true);
        
        // Registra a notificação enviada
        await SocioModel.registrarNotificacaoEnviada(
          socio.Id, 
          'email', 
          resultEmail.success ? 'enviado' : 'falha',
          resultEmail.messageId || resultEmail.error
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Erro ao processar cobrança para sócio ID ${socio.Id}:`, error);
      return false;
    }
  }

  // Gera mensagem para WhatsApp
  static gerarMensagemCobrancaWhatsApp(nome, diasAtraso) {
    return `Olá, ${nome}! Identificamos que sua assinatura está pendente há ${diasAtraso} dias. Por favor, regularize seu pagamento para evitar a suspensão dos serviços. Caso já tenha efetuado o pagamento, desconsidere esta mensagem.`;
  }

  // Gera corpo do email de cobrança em HTML
  static gerarCorpoEmailCobranca(nome, diasAtraso) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Olá, ${nome}!</h2>
        <p>Notamos que sua assinatura está com pagamento pendente há <strong>${diasAtraso} dias</strong>.</p>
        <p>Para evitar a suspensão dos serviços, solicitamos a regularização do pagamento o mais breve possível.</p>
        <p>Caso já tenha efetuado o pagamento, por favor, desconsidere esta mensagem.</p>
        <p>Para dúvidas ou informações adicionais, entre em contato com nosso suporte.</p>
        <p>Atenciosamente,<br>Equipe de Atendimento</p>
      </div>
    `;
  }
}

module.exports = CobrancaService;