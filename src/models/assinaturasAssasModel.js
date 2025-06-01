const axios = require('axios');

class AssinaturasAssasModel {

    static async getAssinaturaCobrancaSocio(socioVeiculo) {
        try {
          if (socioVeiculo?.IdAsaas?.includes("sub_")) {
    
            console.log(`Consultando assinatura de sócio: ${socioVeiculo.IdAsaas}`);
    
            const response = await axios.get(
              `https://api.asaas.com/v3/subscriptions/${socioVeiculo.IdAsaas}/payments`,
              {
                headers: {
                  accept: 'application/json',
                  access_token: process.env.ASAAS_API_KEY
                }
              }
            );
            
            return response?.data?.data;
          } else {
            return null;
          }
        } catch (error) {
          console.error('Erro ao buscar assinatura Asaas:', error.response?.data || error.message);
          throw error;
        }
    }

}

module.exports = AssinaturasAssasModel;