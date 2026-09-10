const assert = require("node:assert/strict");
const { test } = require("node:test");

const records = {
  chatSessions: new Map(),
  conversations: new Map(),
  messages: new Map()
};

let nextId = 1;

function createSnapshot(ref, data) {
  return {
    id: ref.id,
    exists: data !== undefined,
    data: () => data
  };
}

function createMessageCollection(sessionId) {
  if (!records.messages.has(sessionId)) {
    records.messages.set(sessionId, new Map());
  }

  const messages = records.messages.get(sessionId);

  function createMessageRef(id = `message-${nextId++}`) {
    return {
      id,
      async get() {
        return createSnapshot(this, messages.get(id));
      },
      _set(data) {
        messages.set(id, data);
      },
      _update(data) {
        messages.set(id, {
          ...messages.get(id),
          ...data
        });
      }
    };
  }

  return {
    doc: createMessageRef,
    orderBy(field, direction) {
      return {
        async get() {
          const docs = [...messages.entries()]
            .map(([id, data]) =>
              createSnapshot(createMessageRef(id), data)
            )
            .sort((a, b) => {
              const difference =
                a.data()[field] - b.data()[field];

              return direction === "desc"
                ? -difference
                : difference;
            });

          return { docs };
        }
      };
    }
  };
}

function createTopLevelCollection(name) {
  const collectionRecords = records[name];

  function createDocumentRef(id = `document-${nextId++}`) {
    return {
      id,
      async get() {
        return createSnapshot(
          this,
          collectionRecords.get(id)
        );
      },
      async set(data) {
        collectionRecords.set(id, data);
      },
      collection(subcollectionName) {
        assert.equal(subcollectionName, "messages");

        return createMessageCollection(id);
      },
      _set(data) {
        collectionRecords.set(id, data);
      },
      _update(data) {
        collectionRecords.set(id, {
          ...collectionRecords.get(id),
          ...data
        });
      }
    };
  }

  return {
    doc: createDocumentRef,
    where(field, operator, value) {
      assert.equal(operator, "==");

      return {
        async get() {
          const docs = [...collectionRecords.entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id, data]) =>
              createSnapshot(createDocumentRef(id), data)
            );

          return { docs };
        }
      };
    }
  };
}

const db = {
  collection(name) {
    assert.ok(records[name], `Unexpected collection: ${name}`);

    return createTopLevelCollection(name);
  },
  async runTransaction(callback) {
    const operations = [];

    const transaction = {
      get: (ref) => ref.get(),
      set: (ref, data) => {
        operations.push(() => ref._set(data));
      },
      update: (ref, data) => {
        operations.push(() => ref._update(data));
      }
    };

    const result = await callback(transaction);

    operations.forEach((operation) => operation());

    return result;
  }
};

const firebasePath = require.resolve("../src/config/firebase");

require.cache[firebasePath] = {
  id: firebasePath,
  filename: firebasePath,
  loaded: true,
  exports: { db }
};

const {
  createChatSession,
  getChatHistory,
  getChatSessionWithMessages,
  listUserChatSessions,
  saveChatTurn
} = require("../src/services/health/conversation.service");

test("creates a conversation and stores ordered messages beneath it", async () => {
  const conversation = await createChatSession("firebase-user-1");

  assert.equal(conversation.title, "New chat");
  assert.equal(conversation.channel, "web");
  assert.equal(conversation.messageCount, 0);

  await saveChatTurn(
    "firebase-user-1",
    conversation.id,
    "What causes malaria?",
    "Malaria is caused by parasites.",
    "text"
  );

  const loaded = await getChatSessionWithMessages(
    "firebase-user-1",
    conversation.id
  );

  assert.equal(loaded.conversation.messageCount, 2);
  assert.equal(loaded.conversation.title, "What causes malaria?");
  assert.deepEqual(
    loaded.messages.map((message) => ({
      userId: message.userId,
      role: message.role,
      content: message.content,
      inputType: message.inputType,
      sequence: message.sequence
    })),
    [
      {
        userId: "firebase-user-1",
        role: "user",
        content: "What causes malaria?",
        inputType: "text",
        sequence: 0
      },
      {
        userId: "firebase-user-1",
        role: "assistant",
        content: "Malaria is caused by parasites.",
        inputType: "text",
        sequence: 1
      }
    ]
  );

  assert.deepEqual(
    await getChatHistory(
      "firebase-user-1",
      conversation.id
    ),
    [
      {
        userMessage: "What causes malaria?",
        botResponse: "Malaria is caused by parasites."
      }
    ]
  );
});

test("lists and opens legacy exchanges without rewriting them", async () => {
  const createdAt = new Date("2026-01-01T10:00:00.000Z");

  records.conversations.set("old-exchange", {
    userId: "firebase-user-1",
    userMessage: "Old health question",
    botResponse: "Old health answer",
    createdAt
  });

  const conversations = await listUserChatSessions(
    "firebase-user-1"
  );

  const legacySummary = conversations.find(
    (conversation) => conversation.id === "legacy:old-exchange"
  );

  assert.equal(legacySummary.title, "Old health question");
  assert.equal(legacySummary.legacy, true);

  const legacy = await getChatSessionWithMessages(
    "firebase-user-1",
    "legacy:old-exchange"
  );

  assert.equal(legacy.conversation.legacy, true);
  assert.deepEqual(
    legacy.messages.map((message) => message.content),
    ["Old health question", "Old health answer"]
  );
});

test("does not expose another user's conversation", async () => {
  const conversation = await createChatSession("firebase-user-2");

  await assert.rejects(
    getChatSessionWithMessages(
      "firebase-user-1",
      conversation.id
    ),
    (error) =>
      error.statusCode === 404 &&
      error.message === "Conversation not found."
  );
});
