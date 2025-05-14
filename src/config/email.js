const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

async function enviarEmail(destinatario, assunto, corpo, isHtml = true) {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: destinatario,
      subject: assunto,
      ...(isHtml ? { html: corpo } : { text: corpo })
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email enviado para ${destinatario}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Erro ao enviar email para ${destinatario}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  enviarEmail
};