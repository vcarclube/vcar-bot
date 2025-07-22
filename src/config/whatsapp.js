const axios = require('axios');

const zapiConfig = {
  apiKey: process.env.ZAPI_API_KEY,
  instanceId: process.env.ZAPI_INSTANCE_ID,
  clientToken: process.env.ZAPI_CLIENT_TOKEN
};

function formatarTelefone(telefone) {
  if (!telefone) return '';
  
  // Remove caracteres especiais
  let numeroLimpo = telefone
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/-/g, '')
    .replace(/\s/g, '')
    .replace(/\+/g, '')
    .trim();
  
  // Adiciona código do país se necessário
  if (numeroLimpo.length <= 11) {
    numeroLimpo = '55' + numeroLimpo;
  }
  
  return numeroLimpo;
}

async function enviarWhatsApp(telefone, mensagem, linkUrl = null) {
  try {
    const telefoneFormatado = formatarTelefone(telefone);
    
    // Define URL e dados baseado no tipo de mensagem
    let url = `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.apiKey}/send-text`;
    let dados = {
      phone: telefoneFormatado,
      message: mensagem
    };
    
    // Se há link, usa endpoint específico para links
    if (linkUrl) {
      url = `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.apiKey}/send-link`;
      dados.linkUrl = linkUrl;
    }
    
    const response = await axios.post(url, dados, {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiConfig.clientToken
      }
    });
    
    console.log(`WhatsApp enviado para ${telefoneFormatado}: ${response.data.messageId || response.data.id}`);
    return { 
      success: true, 
      messageId: response.data.messageId || response.data.id,
      data: response.data 
    };
    
  } catch (error) {
    console.error(`Erro ao enviar WhatsApp para ${telefone}:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return { 
      success: false, 
      error: error.message,
      details: error.response?.data 
    };
  }
}

module.exports = {
  enviarWhatsApp,
  formatarTelefone
};