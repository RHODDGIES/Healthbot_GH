const { generateResponse } = require("../services/ai/groq.provider");
const { sendWhatsAppMessage } = require("../services/whatsapp/whatsapp.service");

const {
  saveConversation,
  getRecentConversations,
  isMessageProcessed,
  markMessageAsProcessed
} = require("../services/health/conversation.service");

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
    const messageId = message.id;

    if (!recipient || !userMessage || !messageId) {
      return res.sendStatus(200);
    }

    // Check whether this WhatsApp message was already processed
    const alreadyProcessed = await isMessageProcessed(messageId);

    if (alreadyProcessed) {
      console.log("Duplicate WhatsApp message ignored.");
      return res.sendStatus(200);
    }

    console.log("Incoming WhatsApp message received.");

    // Get recent conversation history
    const history = await getRecentConversations(recipient, 2);

    // Generate contextual HealthBot response
    const aiResponse = await generateResponse(userMessage, history);

    // Save conversation to Firestore
    await saveConversation(
      recipient,
      userMessage,
      aiResponse
    );

    // Send response back through WhatsApp
    await sendWhatsAppMessage(recipient, aiResponse);

    // Only mark the message as processed after the reply succeeds
    await markMessageAsProcessed(messageId);

    console.log("HealthBot reply sent successfully.");
    console.log("WhatsApp message marked as processed.");

    return res.sendStatus(200);
  } catch (error) {
    console.error("WhatsApp Webhook Error:", error.message);

    // Return 200 so Meta does not repeatedly retry
    // the same webhook when an external service fails.
    return res.sendStatus(200);
  }
}

module.exports = {
  verifyWebhook,
  receiveWebhook
};