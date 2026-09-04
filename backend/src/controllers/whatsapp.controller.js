const { generateResponse } = require("../services/ai/groq.provider");
const { sendWhatsAppMessage } = require("../services/whatsapp/whatsapp.service");
const { saveConversation } = require("../services/health/conversation.service");
const config = require("../config/environment");

// Verify webhook with Meta
async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsappVerifyToken) {
    console.log("WhatsApp webhook verified.");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

// Receive incoming WhatsApp messages
async function receiveWebhook(req, res) {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Ignore delivery/read status webhooks
    const status = value?.statuses?.[0];

    if (status) {
      console.log(`WhatsApp message status: ${status.status}`);
      return res.sendStatus(200);
    }

    const message = value?.messages?.[0];

    // No incoming message
    if (!message) {
      return res.sendStatus(200);
    }

    // Currently handle text messages only
    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    // Support both traditional WhatsApp IDs and newer user IDs
    const recipient =
      message.from_user_id ||
      message.from ||
      value?.contacts?.[0]?.user_id ||
      value?.contacts?.[0]?.wa_id;

    const userMessage = message.text?.body;

    if (!recipient || !userMessage) {
      return res.sendStatus(200);
    }

    console.log("Incoming WhatsApp message received.");

    // Generate HealthBot response
    const aiResponse = await generateResponse(userMessage);

    // Save conversation to Firestore
    await saveConversation(
          recipient,
          userMessage,
          aiResponse
         );

    // Send response back through WhatsApp
    await sendWhatsAppMessage(recipient, aiResponse);

    console.log("HealthBot reply sent successfully.");

    return res.sendStatus(200);
  } catch (error) {
    console.error("WhatsApp Webhook Error:", error.message);

    return res.sendStatus(500);
  }
}

module.exports = {
  verifyWebhook,
  receiveWebhook
};