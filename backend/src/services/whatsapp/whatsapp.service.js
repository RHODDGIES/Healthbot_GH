const config = require("../../config/environment");

async function sendWhatsAppMessage(to, message) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${config.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: {
            body: message
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      throw new Error("Failed to send WhatsApp message.");
    }

    return data;
  } catch (error) {
    console.error("WhatsApp Service Error:", error.message);
    throw error;
  }
}

module.exports = {
  sendWhatsAppMessage
};