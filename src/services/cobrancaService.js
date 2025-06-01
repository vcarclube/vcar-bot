const SocioModel = require('../models/socioModel');
const AssinaturasAssasModel = require('../models/assinaturasAssasModel');
const { enviarEmail } = require('../config/email');
const { enviarWhatsApp } = require('../config/whatsapp');
const { logger } = require('../utils/logger');

class CobrancaService {

  static async executarCobranca() {
    logger.info('Iniciando processo de cobrança: ' + new Date().toLocaleString());
    
    try {

      
      const sociosVeiculos = await SocioModel.getSociosVeiculos();

      const BATCH_SIZE = 50;
      const INTERVAL = 60000; // 60 segundos

      const sleep = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      for (let i = 0; i < sociosVeiculos.length; i += BATCH_SIZE) {
        const batch = sociosVeiculos.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (socioVeiculo) => {
          try {
            let cobrancas = await AssinaturasAssasModel.getAssinaturaCobrancaSocio(socioVeiculo);
            if(cobrancas != null){

              console.log(cobrancas)

              //let pedingsCobs = cobrancas.filter(c => { return c.status == "CONFIRMED"});

              //console.log(pedingsCobs);
            }
          } catch (error) {
            console.error('Erro ao processar sócio:', socioVeiculo.id, error);
          }
        }));
        console.log(`Batch ${i / BATCH_SIZE + 1} finalizado. Aguardando 1 minuto...`);
        if (i + BATCH_SIZE < sociosVeiculos.length) {
          await sleep(INTERVAL);
        }
      }

      /*const sociosVeiculosAssinados = sociosVeiculos.filter(item => { return item.IdAsaas.includes("sub_")});

      console.log(sociosVeiculos);
      console.log(assinaturasAssas);

      logger.info(`Encontrados ${sociosVeiculosAssinados.length} sócios assinantes com pagamento atrasado.`);
      
      for (const socio of sociosVeiculosAssinados) {
        await this.processarCobrancaSocio(socio);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info('Processo de cobrança finalizado com sucesso.');*/

      //return { success: true, total: sociosVeiculosAssinados.length };
      return { success: true, total: 0 };

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