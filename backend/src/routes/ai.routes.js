const express = require("express");

const {
  chatWithAI,
  getConversationHistory
} = require("../controllers/ai.controller");

const { authenticateUser } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/chat", authenticateUser, chatWithAI);

router.get("/history", authenticateUser, getConversationHistory);

module.exports = router;