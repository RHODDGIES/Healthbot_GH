const { generateResponse } = require("../services/ai/groq.provider");

const {
  saveConversation,
  getUserConversations
} = require("../services/health/conversation.service");

async function chatWithAI(req, res) {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "A valid message is required."
      });
    }

    const response = await generateResponse(message);

    const conversationUserId = req.user.uid;

    const conversationId = await saveConversation(
      conversationUserId,
      message,
      response
    );

    res.json({
      success: true,
      response,
      conversationId
    });
  } catch (error) {
    console.error("AI Controller Error:", error.message);

    res.status(500).json({
      success: false,
      error: "Unable to process your request at the moment."
    });
  }
}

async function getConversationHistory(req, res) {
  try {
    const conversations = await getUserConversations(req.user.uid);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error("Conversation History Error:", error.message);

    res.status(500).json({
      success: false,
      error: "Unable to retrieve conversation history."
    });
  }
}

module.exports = {
  chatWithAI,
  getConversationHistory
};