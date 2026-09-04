const { generateResponse } = require("../services/ai/groq.provider");
const { sendWhatsAppMessage } = require("../services/whatsapp/whatsapp.service");
const config = require("../config/environment");

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

async function receiveWebhook(req, res) {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    const from = message.from;
    const userMessage = message.text?.body;

    if (!from || !userMessage) {
      return res.sendStatus(200);
    }

    console.log(`WhatsApp message from ${from}: ${userMessage}`);

    const aiResponse = await generateResponse(userMessage);

    await sendWhatsAppMessage(from, aiResponse);

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