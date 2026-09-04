const config = require("../../config/environment");

async function sendWhatsAppMessage(recipient, message) {
  try {
    const isBsuid = /^[A-Z]{2}\./.test(recipient);

    const payload = {
      messaging_product: "whatsapp",
      type: "text",
      text: {
        body: message
      }
    };

    if (isBsuid) {
      payload.recipient = recipient;
    } else {
      payload.to = recipient;
    }

    const response = await fetch(
      `https://graph.facebook.com/v26.0/${config.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      throw new Error("Failed to send WhatsApp message.");
    }

    console.log("WhatsApp API response:", {
      messaging_product: data.messaging_product,
      hasMessages: !!data.messages?.length
    });

    return data;
  } catch (error) {
    console.error("WhatsApp Service Error:", error.message);
    throw error;
  }
}

module.exports = {
  sendWhatsAppMessage
};