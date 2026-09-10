const express = require("express");

const {
  chatWithAI,
  voiceWithAI,
  createConversation,
  getConversation,
  listConversations,
  getConversationHistory
} = require("../controllers/ai.controller");

const { authenticateUser } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/chat", authenticateUser, chatWithAI);

router.post(
  "/voice",
  authenticateUser,
  express.raw({
    type: () => true,
    limit: "16mb"
  }),
  voiceWithAI
);

router.post(
  "/conversations",
  authenticateUser,
  createConversation
);

router.get(
  "/conversations",
  authenticateUser,
  listConversations
);

router.get(
  "/conversations/:conversationId",
  authenticateUser,
  getConversation
);

router.get("/history", authenticateUser, getConversationHistory);

router.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "The voice note is too large. Please record a shorter message."
    });
  }

  return next(error);
});

module.exports = router;
