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
            
            if (cobrancas != null && cobrancas.length > 0) {
              console.log(`Processando cobranças do sócio: ${socioVeiculo.Nome}`);
              
              // Ordenar cobranças por data de vencimento (mais recente primeiro)
              const cobrancasOrdenadas = cobrancas.sort((a, b) => {
                return new Date(b.dueDate) - new Date(a.dueDate);
              });
              
              // Encontrar a última cobrança paga (status RECEIVED)
              const ultimaCobrancaPaga = cobrancasOrdenadas.find(c => c.status === "RECEIVED");
              
              // Se não houver cobrança paga, considerar todas as cobranças
              let cobrancasParaAnalisar;
              if (ultimaCobrancaPaga) {
                // Pegar cobranças criadas após a última paga
                const dataUltimaPaga = new Date(ultimaCobrancaPaga.dateCreated);
                cobrancasParaAnalisar = cobrancasOrdenadas.filter(c => {
                  return new Date(c.dateCreated) > dataUltimaPaga;
                });
              } else {
                // Se não há cobrança paga, analisar todas
                cobrancasParaAnalisar = cobrancasOrdenadas;
              }
              
              console.log(`Cobranças para análise: ${cobrancasParaAnalisar.length}`);
              
              // Verificar cobranças pendentes ou em atraso
              const dataAtual = new Date();
              const cobrancasProblematicas = cobrancasParaAnalisar.filter(c => {
                const dataVencimento = new Date(c.dueDate);
                
                // Verificar se é PENDING ou OVERDUE
                if (c.status === "PENDING" || c.status === "OVERDUE") {
                  return true;
                }
                
                return false;
              });
              
              if (cobrancasProblematicas.length > 0) {
                console.log(`🚨 Sócio ${socioVeiculo.Nome} possui ${cobrancasProblematicas.length} cobrança(s) problemática(s):`);
                
                cobrancasProblematicas.forEach(cobranca => {
                  const dataVencimento = new Date(cobranca.dueDate);
                  const diasAtraso = Math.floor((dataAtual - dataVencimento) / (1000 * 60 * 60 * 24));
                  
                  console.log(`- ID: ${cobranca.id}`);
                  console.log(`  Status: ${cobranca.status}`);
                  console.log(`  Vencimento: ${cobranca.dueDate}`);
                  console.log(`  Dias de atraso: ${diasAtraso > 0 ? diasAtraso : 'Não vencida ainda'}`);
                  console.log(`  Valor: R$ ${cobranca.value}`);
                  console.log('---');
                });
                
                // Aqui você pode implementar a lógica de cobrança
                await this.classificarCobrancasAtrasadas(socioVeiculo, cobrancasProblematicas);
              } else {
                console.log(`✅ Sócio ${socioVeiculo.Nome} está em dia com os pagamentos`);
              }
            }
          } catch (error) {
            console.error('Erro ao processar sócio:', socioVeiculo.Nome, error);
          }
        }));
        console.log(`Batch ${i / BATCH_SIZE + 1} finalizado. Aguardando 1 minuto...`);
        if (i + BATCH_SIZE < sociosVeiculos.length) {
          await sleep(INTERVAL);
        }
      }

      return { success: true, total: sociosVeiculos.length };
    } catch (error) {
      logger.error('Erro durante o processo de cobrança:', error);
      return { success: false, error: error.message };
    }
  }

  static async classificarCobrancasAtrasadas(socioVeiculo, cobrancasProblematicas) {
    try {
      // Separar por tipo de problema
      const pendentes = cobrancasProblematicas.filter(c => c.status === "PENDING");
      const vencidas = cobrancasProblematicas.filter(c => c.status === "OVERDUE");
      
      console.log(`📊 Resumo das cobranças problemáticas para ${socioVeiculo.Nome}:`);
      console.log(`   - Pendentes: ${pendentes.length}`);
      console.log(`   - Vencidas (OVERDUE): ${vencidas.length}`);
      
      let deveProsseguirComInativacao = false;
      let diasMaximoAtraso = 0;
      let totalCobrancasVencidas = 0;
      let cobrancasParaNotificar = [];
      
      // 1. Processar cobranças PENDING que venceram
      for (const cobranca of pendentes) {
        const dataVencimento = new Date(cobranca.dueDate);
        const diasAtraso = Math.floor((new Date() - dataVencimento) / (1000 * 60 * 60 * 24));
        
        if (new Date() > dataVencimento) {
          console.log(`📧 Cobrança PENDING vencida: ${cobranca.id} (${diasAtraso} dias)`);
          
          // Adicionar à lista de cobranças para notificar
          cobrancasParaNotificar.push({
            ...cobranca,
            diasAtraso,
            tipoAtraso: 'PENDING_VENCIDA'
          });
          
          // Contabilizar para possível inativação
          totalCobrancasVencidas++;
          diasMaximoAtraso = Math.max(diasMaximoAtraso, diasAtraso);
          
          // Definir critérios para inativação (exemplo: mais de 30 dias em atraso)
          if (diasAtraso > 30) {
            deveProsseguirComInativacao = true;
          }
        }
      }
      
      // 2. Processar cobranças OVERDUE
      for (const cobranca of vencidas) {
        const dataVencimento = new Date(cobranca.dueDate);
        const diasAtraso = Math.floor((new Date() - dataVencimento) / (1000 * 60 * 60 * 24));
        
        console.log(`🔴 Cobrança em atraso crítico: ${cobranca.id} (${diasAtraso} dias)`);
        
        // Adicionar à lista de cobranças para notificar
        cobrancasParaNotificar.push({
          ...cobranca,
          diasAtraso,
          tipoAtraso: 'OVERDUE'
        });
        
        // Cobranças OVERDUE sempre contam para inativação
        totalCobrancasVencidas++;
        diasMaximoAtraso = Math.max(diasMaximoAtraso, diasAtraso);
        deveProsseguirComInativacao = true;
      }
      
      // 3. Enviar UMA notificação consolidada se houver cobranças problemáticas
      if (cobrancasParaNotificar.length > 0) {
        console.log(`📨 Enviando notificação consolidada para ${socioVeiculo.Nome} com ${cobrancasParaNotificar.length} cobrança(s)`);
        await this.processarCobrancaConsolidada(socioVeiculo, cobrancasParaNotificar);
      }
      
      // 4. Avaliar se deve inativar o sócio
      await this.avaliarInativacaoSocio(
        socioVeiculo, 
        deveProsseguirComInativacao, 
        totalCobrancasVencidas, 
        diasMaximoAtraso,
        cobrancasProblematicas
      );
      
    } catch (error) {
      console.error('Erro ao processar cobranças atrasadas:', error);
    }
  }  
  
  static async avaliarInativacaoSocio(socioVeiculo, deveProsseguir, totalVencidas, diasMaximo, cobrancasProblematicas) {
    try {
      if (!deveProsseguir) {
        console.log(`✅ Sócio ${socioVeiculo.Nome} não atende critérios para inativação`);
        return;
      }
      
      // Definir critérios de inativação (customize conforme suas regras de negócio)
      const criterios = {
        diasMaximoPermitido: 1,        // Máximo de dias em atraso
        maxCobrancasVencidas: 1,        // Máximo de cobranças em atraso
        considerarOverdueImediato: true  // OVERDUE já é critério para inativação
      };
      
      let motivoInativacao = [];
      let deveInativar = false;
      
      // Critério 1: Dias em atraso
      if (diasMaximo > criterios.diasMaximoPermitido) {
        motivoInativacao.push(`${diasMaximo} dias em atraso (limite: ${criterios.diasMaximoPermitido})`);
        deveInativar = true;
      }
      
      // Critério 2: Quantidade de cobranças vencidas
      if (totalVencidas >= criterios.maxCobrancasVencidas) {
        motivoInativacao.push(`${totalVencidas} cobranças vencidas (limite: ${criterios.maxCobrancasVencidas})`);
        deveInativar = true;
      }
      
      // Critério 3: Possui cobrança OVERDUE
      const temOverdue = cobrancasProblematicas.some(c => c.status === "OVERDUE");
      if (temOverdue && criterios.considerarOverdueImediato) {
        motivoInativacao.push("Possui cobrança com status OVERDUE");
        deveInativar = true;
      }
      
      if (deveInativar) {
        console.log(`⚠️  INICIANDO PROCESSO DE INATIVAÇÃO`);
        console.log(`   Sócio: ${socioVeiculo.Nome} (ID: ${socioVeiculo.Id})`);
        console.log(`   Motivos: ${motivoInativacao.join(', ')}`);
        console.log(`   Total de cobranças problemáticas: ${cobrancasProblematicas.length}`);
        
        // Executar a inativação
        const resultadoInativacao = await this.inativarSocio(socioVeiculo, motivoInativacao, cobrancasProblematicas);
        
        if (resultadoInativacao.success) {
          console.log(`✅ Sócio ${socioVeiculo.Nome} inativado com sucesso`);
          
          // Log detalhado para auditoria
          await this.registrarLogInativacao({
            socioId: socioVeiculo.IdSocioVeiculo,
            socioNome: socioVeiculo.Nome,
            motivos: motivoInativacao,
            diasMaximoAtraso: diasMaximo,
            totalCobrancasVencidas: totalVencidas,
            cobrancasIds: cobrancasProblematicas.map(c => c.id),
            dataInativacao: new Date()
          });
          
        } else {
          console.error(`❌ Erro ao inativar sócio ${socioVeiculo.Nome}:`, resultadoInativacao.error);
        }
      } else {
        console.log(`⚡ Sócio ${socioVeiculo.Nome} possui cobranças vencidas mas não atende todos os critérios para inativação`);
      }
      
    } catch (error) {
      console.error('Erro ao avaliar inativação do sócio:', error);
    }
  }
  
  //teste
  static async inativarSocio(socioVeiculo, motivos, cobrancasProblematicas) {
    try {
      console.log(`🔄 Executando inativação do sócio ${socioVeiculo.Nome}...`);
      
      const resultado = await SocioModel.inativarSocio(socioVeiculo.IdSocioVeiculo);
      
      return { success: true, data: resultado };
      
    } catch (error) {
      console.error('Erro durante inativação:', error);
      return { success: false, error: error.message };
    }
  }
  
  static async registrarLogInativacao(dadosLog) {
    try {
      console.log(`📝 Registrando log de inativação:`, dadosLog);
      
      // Implementar conforme seu sistema de logs
      // Exemplo: await LogModel.registrarInativacao(dadosLog);
      
      // Ou salvar em arquivo/banco para auditoria
      logger.info('INATIVAÇÃO_SÓCIO', {
        ...dadosLog,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Erro ao registrar log de inativação:', error);
    }
  }

  static async processarCobrancaConsolidada(socio, cobrancasAtrasadas) {
    try {
      // Atualizar data da última cobrança
      await SocioModel.updateDataUltimaCobraca(socio.IdSocioVeiculo);
      
      // Calcular totais
      const valorTotal = cobrancasAtrasadas.reduce((total, c) => total + c.value, 0);
      const maiorAtraso = Math.max(...cobrancasAtrasadas.map(c => c.diasAtraso));

      console.log(socio);

      // Envia WhatsApp se tiver telefone cadastrado
      if (socio.TelefoneLimpo) {
        const mensagemWhatsApp = this.gerarMensagemCobrancaConsolidada(
          socio, 
          cobrancasAtrasadas,
          valorTotal,
          maiorAtraso
        );
        
        console.log(mensagemWhatsApp)

        const resultWhatsApp = await enviarWhatsApp(socio.TelefoneLimpo, mensagemWhatsApp);
        
        // Registra a notificação enviada
        await SocioModel.registrarNotificacaoEnviada(
          socio.IdSocioVeiculo, 
          'whatsapp',
          resultWhatsApp.success ? 'enviado' : 'falha',
          resultWhatsApp.messageId || resultWhatsApp.error
        );
        
        console.log(`📱 WhatsApp ${resultWhatsApp.success ? 'enviado' : 'falhou'} para ${socio.Nome}`);
      }
      
      // Envia Email se tiver email cadastrado
      if (socio.Email) {
        const assunto = `Importante: ${cobrancasAtrasadas.length} cobrança(s) pendente(s) - V-Car Clube`;
        const corpoEmail = this.gerarCorpoEmailCobrancaConsolidada(
          socio.Nome, 
          cobrancasAtrasadas,
          valorTotal,
          maiorAtraso
        );
        
        const resultEmail = await enviarEmail(socio.Email, assunto, corpoEmail, true);
        
        // Registra a notificação enviada
        await SocioModel.registrarNotificacaoEnviada(
          socio.IdSocioVeiculo, 
          'email',
          resultEmail.success ? 'enviado' : 'falha',
          resultEmail.messageId || resultEmail.error
        );
        
        console.log(`📧 Email ${resultEmail.success ? 'enviado' : 'falhou'} para ${socio.Nome}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Erro ao processar cobrança consolidada para sócio ID ${socio.IdSocioVeiculo}:`, error);
      return false;
    }
  }

  static gerarMensagemCobrancaConsolidada(socio, cobrancasAtrasadas, valorTotal, maiorAtraso) {
    const saudacao = this.obterSaudacao();
    const quantidadeCobrancas = cobrancasAtrasadas.length;
    
    let mensagem = `${saudacao} *${socio.Nome}*! 🚗\n\n`;
    mensagem += `Identificamos que você possui *${quantidadeCobrancas}* cobrança(s) pendente(s) no V-Car Clube:\n\n`;
    
    // Listar cada cobrança
    cobrancasAtrasadas.forEach((cobranca, index) => {
      const dataVencimento = new Date(cobranca.dueDate).toLocaleDateString('pt-BR');
      const statusEmoji = cobranca.tipoAtraso === 'OVERDUE' ? '🔴' : '⚠️';
      
      mensagem += `${statusEmoji} *Cobrança ${index + 1}:*\n`;
      mensagem += `   • Valor: R$ ${cobranca.value.toFixed(2)}\n`;
      mensagem += `   • Vencimento: ${dataVencimento}\n`;
      mensagem += `   • Atraso: ${cobranca.diasAtraso} dia(s)\n`;
      mensagem += `   • Link: ${cobranca?.invoiceUrl}\n`;
      mensagem += `   • Status: ${cobranca.status == 'OVERDUE' ? 'ATRASADA' : 'PENDENTE'}\n\n`;
    });
    
    mensagem += `💰 *Total em atraso: R$ ${valorTotal.toFixed(2)}*\n`;
    mensagem += `⏰ *Maior atraso: ${maiorAtraso} dia(s)*\n\n`;
    
    mensagem += `Para regularizar sua situação, acesse:\n`;
    
    mensagem += `Ou entre em contato conosco:\n`;
    mensagem += `📧 contato@vcarclube.com.br\n\n`;
    
    mensagem += `V-Car Clube - Cuidando do seu veículo! 🛠️`;
    
    return mensagem;
  }

  static gerarCorpoEmailCobrancaConsolidada(nome, cobrancasAtrasadas, valorTotal, maiorAtraso) {
    const quantidadeCobrancas = cobrancasAtrasadas.length;
    
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">🚗 V-Car Clube</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Cobrança(s) Pendente(s)</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Olá, ${nome}!</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ff6b6b; margin: 20px 0;">
            <h3 style="color: #ff6b6b; margin-top: 0;">⚠️ Atenção Necessária</h3>
            <p>Identificamos <strong>${quantidadeCobrancas} cobrança(s) pendente(s)</strong> em sua conta:</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">📋 Detalhes das Cobranças:</h3>`;
    
    // Listar cada cobrança em formato de tabela
    cobrancasAtrasadas.forEach((cobranca, index) => {
      const dataVencimento = new Date(cobranca.dueDate).toLocaleDateString('pt-BR');
      const statusColor = cobranca.tipoAtraso === 'OVERDUE' ? '#ff4757' : '#ffa502';
      const statusText = cobranca.tipoAtraso === 'OVERDUE' ? 'VENCIDA' : 'PENDENTE';
      
      html += `
            <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 5px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #333;">Cobrança ${index + 1}</strong>
                <span style="background: ${statusColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px;">
                  ${statusText}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                <div><strong>Valor:</strong> R$ ${cobranca.value.toFixed(2)}</div>
                <div><strong>Vencimento:</strong> ${dataVencimento}</div>
                <div><strong>Atraso:</strong> ${cobranca.diasAtraso} dia(s)</div>
                <div><strong>Status:</strong> ${cobranca.status == 'OVERDUE' ? 'ATRASADA' : 'PENDENTE'}</div>
                <div><a href='${cobranca?.invoiceUrl}'><strong>Link:</strong> ${cobranca?.invoiceUrl}</a></div>
              </div>
            </div>`;
    });
    
    html += `
          </div>
          
          <div style="background: #198754; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">💰 Resumo Total</h3>
            <div style="font-size: 18px; font-weight: bold;">R$ ${valorTotal.toFixed(2)}</div>
            <div style="font-size: 14px; opacity: 0.9;">Maior atraso: ${maiorAtraso} dia(s)</div>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #666; font-size: 14px;">
            <p><strong>Precisa de ajuda?</strong></p>
            <p>📧 contato@vcarclube.com.br</p>
            <p style="margin-top: 20px; font-style: italic;">V-Car Clube - Cuidando do seu veículo!</p>
          </div>
        </div>
      </div>`;
    
    return html;
  }

  static obterSaudacao() {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  }

}

module.exports = CobrancaService;