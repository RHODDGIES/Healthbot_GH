const assert = require("node:assert/strict");
const { test } = require("node:test");

const calls = {
  downloads: [],
  generatedResponses: [],
  markedMessages: [],
  savedConversations: [],
  sentMessages: [],
  transcriptions: []
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

mockModule("../src/config/environment", {
  whatsappVerifyToken: "test-verify-token"
});

mockModule("../src/services/ai/groq.provider", {
  generateResponse: async (message, history) => {
    calls.generatedResponses.push({
      message,
      history
    });

    return "Miawoe. How can I help?";
  }
});

mockModule("../src/services/ai/groq-transcription.provider", {
  transcribeAudio: async (buffer, mimeType) => {
    calls.transcriptions.push({
      buffer,
      mimeType
    });

    return "Akpe";
  }
});

mockModule("../src/services/whatsapp/whatsapp.service", {
  downloadWhatsAppMedia: async (mediaId) => {
    calls.downloads.push(mediaId);

    return {
      buffer: Buffer.from("voice-note"),
      mimeType: "audio/ogg; codecs=opus"
    };
  },
  sendWhatsAppMessage: async (recipient, message) => {
    calls.sentMessages.push({
      recipient,
      message
    });
  }
});

const history = [
  {
    userMessage: "Hello",
    botResponse: "Hello!"
  }
];

mockModule("../src/services/health/conversation.service", {
  getRecentConversations: async () => history,
  isMessageProcessed: async () => false,
  markMessageAsProcessed: async (messageId) => {
    calls.markedMessages.push(messageId);
  },
  saveConversation: async (
    userId,
    userMessage,
    botResponse
  ) => {
    calls.savedConversations.push({
      userId,
      userMessage,
      botResponse
    });
  }
});

const {
  receiveWebhook
} = require("../src/controllers/whatsapp.controller");

test("routes a WhatsApp voice note through transcription and the existing chat flow", async () => {
  resetCalls();

  let responseStatus;

  const req = {
    body: {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "233200000000",
                    id: "wamid.voice-note",
                    type: "audio",
                    audio: {
                      id: "voice-media-id",
                      mime_type: "audio/ogg; codecs=opus",
                      voice: true
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  };

  const res = {
    sendStatus: (status) => {
      responseStatus = status;

      return res;
    }
  };

  await receiveWebhook(req, res);

  assert.equal(responseStatus, 200);
  assert.deepEqual(calls.downloads, ["voice-media-id"]);
  assert.equal(calls.transcriptions.length, 1);
  assert.equal(
    calls.transcriptions[0].mimeType,
    "audio/ogg; codecs=opus"
  );
  assert.deepEqual(calls.generatedResponses, [
    {
      message: "Akpe",
      history
    }
  ]);
  assert.deepEqual(calls.savedConversations, [
    {
      userId: "233200000000",
      userMessage: "Akpe",
      botResponse: "Miawoe. How can I help?"
    }
  ]);
  assert.deepEqual(calls.sentMessages, [
    {
      recipient: "233200000000",
      message: "Miawoe. How can I help?"
    }
  ]);
  assert.deepEqual(calls.markedMessages, [
    "wamid.voice-note"
  ]);
});

test("continues to route WhatsApp text messages without transcription", async () => {
  resetCalls();

  let responseStatus;

  const req = {
    body: {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "233200000000",
                    id: "wamid.text-message",
                    type: "text",
                    text: {
                      body: "Hello"
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  };

  const res = {
    sendStatus: (status) => {
      responseStatus = status;

      return res;
    }
  };

  await receiveWebhook(req, res);

  assert.equal(responseStatus, 200);
  assert.deepEqual(calls.downloads, []);
  assert.deepEqual(calls.transcriptions, []);
  assert.deepEqual(calls.generatedResponses, [
    {
      message: "Hello",
      history
    }
  ]);
  assert.deepEqual(calls.savedConversations, [
    {
      userId: "233200000000",
      userMessage: "Hello",
      botResponse: "Miawoe. How can I help?"
    }
  ]);
  assert.deepEqual(calls.markedMessages, [
    "wamid.text-message"
  ]);
});
