const assert = require("node:assert/strict");
const { test } = require("node:test");

const calls = {
  created: [],
  generated: [],
  histories: [],
  legacySaves: [],
  listed: [],
  opened: [],
  sessionSaves: []
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

const session = {
  id: "session-1",
  userId: "firebase-user-1",
  title: "New chat"
};

const history = [
  {
    userMessage: "Hello",
    botResponse: "Hello!"
  }
];

mockModule("../src/services/ai/groq.provider", {
  generateResponse: async (
    message,
    conversationHistory,
    language
  ) => {
    calls.generated.push({
      message,
      history: conversationHistory,
      language
    });

    return "General health information.";
  }
});

mockModule("../src/services/ai/groq-transcription.provider", {
  normalizeMimeType: (mimeType = "") =>
    mimeType.split(";")[0].trim().toLowerCase(),
  transcribeAudio: async () => ""
});

mockModule("../src/services/health/conversation.service", {
  createChatSession: async (userId) => {
    calls.created.push(userId);

    return session;
  },
  getChatHistory: async (userId, conversationId) => {
    calls.histories.push({
      userId,
      conversationId
    });

    return history;
  },
  getChatSessionWithMessages: async (
    userId,
    conversationId
  ) => {
    calls.opened.push({
      userId,
      conversationId
    });

    return {
      conversation: session,
      messages: []
    };
  },
  getUserConversations: async () => [],
  listUserChatSessions: async (userId) => {
    calls.listed.push(userId);

    return [session];
  },
  saveChatTurn: async (...args) => {
    calls.sessionSaves.push(args);
  },
  saveConversation: async (...args) => {
    calls.legacySaves.push(args);

    return "legacy-exchange-id";
  }
});

const {
  chatWithAI,
  createConversation,
  getConversation,
  listConversations
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

test("creates a new authenticated conversation", async () => {
  resetCalls();

  const res = createResponse();

  await createConversation(
    {
      user: {
        uid: "firebase-user-1"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls.created, ["firebase-user-1"]);
  assert.deepEqual(res.payload, {
    success: true,
    conversation: session
  });
});

test("lists only the authenticated user's conversations", async () => {
  resetCalls();

  const res = createResponse();

  await listConversations(
    {
      user: {
        uid: "firebase-user-1"
      }
    },
    res
  );

  assert.deepEqual(calls.listed, ["firebase-user-1"]);
  assert.deepEqual(res.payload, {
    success: true,
    conversations: [session]
  });
});

test("opens a conversation through the authenticated user ID", async () => {
  resetCalls();

  const res = createResponse();

  await getConversation(
    {
      user: {
        uid: "firebase-user-1"
      },
      params: {
        conversationId: "session-1"
      }
    },
    res
  );

  assert.deepEqual(calls.opened, [
    {
      userId: "firebase-user-1",
      conversationId: "session-1"
    }
  ]);
  assert.deepEqual(res.payload, {
    success: true,
    conversation: session,
    messages: []
  });
});

test("uses only the active conversation history for session-aware chat", async () => {
  resetCalls();

  const res = createResponse();

  await chatWithAI(
    {
      user: {
        uid: "firebase-user-1"
      },
      body: {
        message: "What should I do?",
        language: "English",
        conversationId: "session-1"
      }
    },
    res
  );

  assert.deepEqual(calls.histories, [
    {
      userId: "firebase-user-1",
      conversationId: "session-1"
    }
  ]);
  assert.deepEqual(calls.generated, [
    {
      message: "What should I do?",
      history,
      language: "English"
    }
  ]);
  assert.deepEqual(calls.sessionSaves, [
    [
      "firebase-user-1",
      "session-1",
      "What should I do?",
      "General health information.",
      "text"
    ]
  ]);
  assert.deepEqual(calls.legacySaves, []);
  assert.equal(res.payload.conversationId, "session-1");
});

test("preserves legacy chat behaviour when no session ID is supplied", async () => {
  resetCalls();

  const res = createResponse();

  await chatWithAI(
    {
      user: {
        uid: "firebase-user-1"
      },
      body: {
        message: "Hello"
      }
    },
    res
  );

  assert.deepEqual(calls.histories, []);
  assert.deepEqual(calls.sessionSaves, []);
  assert.deepEqual(calls.legacySaves, [
    [
      "firebase-user-1",
      "Hello",
      "General health information."
    ]
  ]);
  assert.equal(
    res.payload.conversationId,
    "legacy-exchange-id"
  );
});
