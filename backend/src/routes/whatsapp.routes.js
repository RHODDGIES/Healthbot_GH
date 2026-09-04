const express = require("express");

const {
  verifyWebhook,
  receiveWebhook
} = require("../controllers/whatsapp.controller");

const router = express.Router();

// Meta webhook verification
router.get("/webhook", verifyWebhook);

// Incoming WhatsApp messages
router.post("/webhook", receiveWebhook);

module.exports = router;