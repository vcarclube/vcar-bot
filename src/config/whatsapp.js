const axios = require('axios');

const zapiConfig = {
  baseURL: process.env.ZAPI_BASE_URL,
  apiKey: process.env.ZAPI_API_KEY,
  instanceId: process.env.ZAPI_INSTANCE_ID
};

function formatarTelefone(telefone) {
  let numero = telefone.replace(/\D/g, '');
  
  if (!numero.startsWith('55')) {
    numero = '55' + numero;
  }
  
  return numero;
}

async function enviarWhatsApp(telefone, mensagem) {
  try {
    const telefoneFormatado = formatarTelefone(telefone);
    
    const response = await axios.post(
      `${zapiConfig.baseURL}/instances/${zapiConfig.instanceId}/token/${zapiConfig.apiKey}/send-text`,
      {
        phone: telefoneFormatado,
        message: mensagem
      }
    );
    
    console.log(`WhatsApp enviado para ${telefoneFormatado}: ${response.data.id}`);
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error(`Erro ao enviar WhatsApp para ${telefone}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  enviarWhatsApp,
  formatarTelefone
};