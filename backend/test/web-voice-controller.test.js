const assert = require("node:assert/strict");
const { test } = require("node:test");

const calls = {
  generated: [],
  histories: [],
  saved: [],
  transcribed: []
};

function resetCalls() {
  Object.values(calls).forEach((entries) => {
    entries.length = 0;
  });
}

function mockModule(relativePath, exports) {
  const modulePath = require.resolve(relativePath);

  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  };
}

const history = [
  {
    userMessage: "Hello",
    botResponse: "Hello!"
  }
];

mockModule("../src/services/ai/groq.provider", {
  generateResponse: async (message, conversationHistory, language) => {
    calls.generated.push({
      message,
      history: conversationHistory,
      language
    });

    return "Please seek professional care if your symptoms are severe.";
  }
});

mockModule("../src/services/ai/groq-transcription.provider", {
  normalizeMimeType: (mimeType = "") =>
    mimeType.split(";")[0].trim().toLowerCase(),
  transcribeAudio: async (buffer, mimeType) => {
    calls.transcribed.push({
      byteLength: buffer.length,
      mimeType
    });

    return "I have a headache";
  }
});

mockModule("../src/services/health/conversation.service", {
  createChatSession: async () => ({}),
  getChatHistory: async (userId, conversationId) => {
    calls.histories.push({ userId, conversationId });

    return history;
  },
  getChatSessionWithMessages: async () => ({}),
  getUserConversations: async () => [],
  listUserChatSessions: async () => [],
  saveConversation: async () => "",
  saveChatTurn: async (...args) => {
    calls.saved.push(args);
  }
});

const {
  voiceWithAI
} = require("../src/controllers/ai.controller");

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(statusCode) {
      this.statusCode = statusCode;

      return this;
    },
    json(payload) {
      this.payload = payload;

      return this;
    }
  };
}

function createRequest(overrides = {}) {
  return {
    user: {
      uid: "firebase-user-1"
    },
    body: Buffer.from("recorded audio"),
    headers: {
      "content-type": "audio/webm;codecs=opus",
      "x-conversation-id": "session-1",
      "x-healthbot-language": "English"
    },
    ...overrides
  };
}

test("transcribes and saves an English web voice note in the active chat", async () => {
  resetCalls();

  const res = createResponse();

  await voiceWithAI(createRequest(), res);

  assert.deepEqual(calls.histories, [
    {
      userId: "firebase-user-1",
      conversationId: "session-1"
    }
  ]);
  assert.deepEqual(calls.transcribed, [
    {
      byteLength: 14,
      mimeType: "audio/webm"
    }
  ]);
  assert.deepEqual(calls.generated, [
    {
      message: "I have a headache",
      history,
      language: "English"
    }
  ]);
  assert.deepEqual(calls.saved, [
    [
      "firebase-user-1",
      "session-1",
      "I have a headache",
      "Please seek professional care if your symptoms are severe.",
      "voice"
    ]
  ]);
  assert.deepEqual(res.payload, {
    success: true,
    transcription: "I have a headache",
    response: "Please seek professional care if your symptoms are severe.",
    conversationId: "session-1",
    language: "English"
  });
});

test("rejects non-English web voice notes before transcription", async () => {
  resetCalls();

  const res = createResponse();
  const req = createRequest({
    headers: {
      "content-type": "audio/webm",
      "x-conversation-id": "session-1",
      "x-healthbot-language": "Twi"
    }
  });

  await voiceWithAI(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /English only/);
  assert.deepEqual(calls.transcribed, []);
  assert.deepEqual(calls.generated, []);
  assert.deepEqual(calls.saved, []);
});

test("rejects unsupported browser audio formats", async () => {
  resetCalls();

  const res = createResponse();
  const req = createRequest({
    headers: {
      "content-type": "audio/aac",
      "x-conversation-id": "session-1",
      "x-healthbot-language": "English"
    }
  });

  await voiceWithAI(req, res);

  assert.equal(res.statusCode, 415);
  assert.match(res.payload.error, /not supported/);
  assert.deepEqual(calls.histories, []);
  assert.deepEqual(calls.transcribed, []);
});

test("rejects voice notes without an active conversation", async () => {
  resetCalls();

  const res = createResponse();
  const req = createRequest({
    headers: {
      "content-type": "audio/webm",
      "x-healthbot-language": "English"
    }
  });

  await voiceWithAI(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /conversation ID/);
  assert.deepEqual(calls.transcribed, []);
});
