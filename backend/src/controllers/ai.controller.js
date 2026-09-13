const { generateResponse } = require("../services/ai/groq.provider");

const {
  normalizeMimeType,
  transcribeAudio: transcribeAudioWithGroq
} = require("../services/ai/groq-transcription.provider");

const {
  transcribeAudio: transcribeAudioWithKhaya
} = require("../services/ai/khaya-transcription.provider");

const {
  createChatSession,
  getChatHistory,
  getChatSessionWithMessages,
  listUserChatSessions,
  saveConversation,
  saveChatTurn,
  getUserConversations
} = require("../services/health/conversation.service");

const MAX_WEB_VOICE_NOTE_BYTES = 16 * 1024 * 1024;
const SUPPORTED_WEB_AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-flac",
  "audio/x-wav"
]);
const SUPPORTED_WEB_VOICE_LANGUAGES = new Set([
  "English",
  "Twi",
  "Ewe"
]);
const KHAYA_WEB_VOICE_LANGUAGE_CODES = {
  Twi: "twi",
  Ewe: "ewe"
};


function sendControllerError(
  res,
  error,
  logLabel,
  fallbackMessage
) {
  console.error(logLabel, error.message);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    error:
      statusCode === 500
        ? fallbackMessage
        : error.message
  });
}


async function chatWithAI(req, res) {
  try {
    const {
      message,
      language,
      conversationId,
      inputType
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "A valid message is required."
      });
    }

    // Languages currently supported by HealthBot GH
    const supportedLanguages = [
      "English",
      "Twi",
      "Ewe"
    ];

    // Use selected language only if it is valid.
    // Otherwise Groq will fall back to automatic detection.
    const selectedLanguage =
      supportedLanguages.includes(language)
        ? language
        : null;
    const selectedInputType =
      inputType === "voice" ? "voice" : "text";

    if (
      conversationId !== undefined &&
      (
        typeof conversationId !== "string" ||
        !conversationId.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "A valid conversation ID is required."
      });
    }

    const activeConversationId =
      typeof conversationId === "string"
        ? conversationId.trim()
        : null;

    if (activeConversationId?.startsWith("legacy:")) {
      return res.status(409).json({
        success: false,
        error:
          "Legacy conversations are read-only. Start a new chat to continue."
      });
    }

    const conversationUserId = req.user.uid;

    const history = activeConversationId
      ? await getChatHistory(
          conversationUserId,
          activeConversationId
        )
      : [];

    const response = await generateResponse(
      message,
      history,
      selectedLanguage
    );

    let savedConversationId;

    if (activeConversationId) {
      await saveChatTurn(
        conversationUserId,
        activeConversationId,
        message,
        response,
        selectedInputType
      );

      savedConversationId = activeConversationId;
    } else {
      savedConversationId = await saveConversation(
        conversationUserId,
        message,
        response
      );
    }

    res.json({
      success: true,
      response,
      conversationId: savedConversationId,
      language: selectedLanguage || "auto"
    });

  } catch (error) {
    return sendControllerError(
      res,
      error,
      "AI Controller Error:",
      "Unable to process your request at the moment."
    );
  }
}


async function voiceWithAI(req, res) {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({
        success: false,
        error: "A voice note is required."
      });
    }

    if (req.body.length > MAX_WEB_VOICE_NOTE_BYTES) {
      return res.status(413).json({
        success: false,
        error: "The voice note is too large. Please record a shorter message."
      });
    }

    const conversationId = String(
      req.headers["x-conversation-id"] || ""
    ).trim();

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: "A valid conversation ID is required."
      });
    }

    if (conversationId.startsWith("legacy:")) {
      return res.status(409).json({
        success: false,
        error:
          "Legacy conversations are read-only. Start a new chat to continue."
      });
    }

    const requestedLanguage = String(
      req.headers["x-healthbot-language"] || "English"
    ).trim();

    if (!SUPPORTED_WEB_VOICE_LANGUAGES.has(requestedLanguage)) {
      return res.status(400).json({
        success: false,
        error:
          "Web voice notes support English, Twi and Ewe."
      });
    }

    const mimeType = normalizeMimeType(
      req.headers["content-type"]
    );

    if (!SUPPORTED_WEB_AUDIO_TYPES.has(mimeType)) {
      return res.status(415).json({
        success: false,
        error: "This voice-note audio format is not supported."
      });
    }

    const conversationUserId = req.user.uid;

    // Loading history first also verifies that this conversation
    // belongs to the authenticated user before audio is sent to a
    // transcription provider.
    const history = await getChatHistory(
      conversationUserId,
      conversationId
    );

    const transcription = requestedLanguage === "English"
      ? await transcribeAudioWithGroq(
          req.body,
          mimeType,
          undefined,
          {
            language: "en"
          }
        )
      : await transcribeAudioWithKhaya(
          req.body,
          mimeType,
          KHAYA_WEB_VOICE_LANGUAGE_CODES[requestedLanguage]
        );

    if (requestedLanguage !== "English") {
      return res.json({
        success: true,
        transcription,
        conversationId,
        language: requestedLanguage,
        requiresConfirmation: true
      });
    }

    const response = await generateResponse(
      transcription,
      history,
      requestedLanguage
    );

    await saveChatTurn(
      conversationUserId,
      conversationId,
      transcription,
      response,
      "voice"
    );

    return res.json({
      success: true,
      transcription,
      response,
      conversationId,
      language: requestedLanguage,
      requiresConfirmation: false
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Web Voice Controller Error:",
      "Unable to process the voice note at the moment."
    );
  }
}


async function createConversation(req, res) {
  try {
    const conversation = await createChatSession(
      req.user.uid
    );

    return res.status(201).json({
      success: true,
      conversation
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Create Conversation Error:",
      "Unable to start a new conversation."
    );
  }
}


async function listConversations(req, res) {
  try {
    const conversations = await listUserChatSessions(
      req.user.uid
    );

    return res.json({
      success: true,
      conversations
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "List Conversations Error:",
      "Unable to retrieve conversations."
    );
  }
}


async function getConversation(req, res) {
  try {
    const {
      conversation,
      messages
    } = await getChatSessionWithMessages(
      req.user.uid,
      req.params.conversationId
    );

    return res.json({
      success: true,
      conversation,
      messages
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Get Conversation Error:",
      "Unable to retrieve the conversation."
    );
  }
}


async function getConversationHistory(req, res) {
  try {
    const conversations =
      await getUserConversations(req.user.uid);

    res.json({
      success: true,
      conversations
    });

  } catch (error) {
    console.error(
      "Conversation History Error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error:
        "Unable to retrieve conversation history."
    });
  }
}


module.exports = {
  chatWithAI,
  voiceWithAI,
  createConversation,
  getConversation,
  listConversations,
  getConversationHistory
};
