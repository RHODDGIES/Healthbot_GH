const express = require("express");

const {
  verifyWebhook,
  receiveWebhook
} = require("../controllers/whatsapp.controller");

const {
  verifyWhatsAppSignature
} = require("../middleware/whatsapp-signature.middleware");

const router = express.Router();

// Meta webhook verification
router.get("/webhook", verifyWebhook);

// Incoming WhatsApp messages
router.post(
  "/webhook",
  verifyWhatsAppSignature,
  receiveWebhook
);

module.exports = router;
