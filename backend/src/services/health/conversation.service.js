const { db } = require("../../config/firebase");

const CHAT_SESSIONS_COLLECTION = "chatSessions";
const LEGACY_CHAT_PREFIX = "legacy:";
const DEFAULT_CHAT_TITLE = "New chat";
const MAX_CHAT_TITLE_LENGTH = 60;

function createConversationTitle(message) {
  if (!message || typeof message !== "string") {
    return DEFAULT_CHAT_TITLE;
  }

  const title = message.replace(/\s+/g, " ").trim();

  if (!title) {
    return DEFAULT_CHAT_TITLE;
  }

  if (title.length <= MAX_CHAT_TITLE_LENGTH) {
    return title;
  }

  return `${title.substring(0, MAX_CHAT_TITLE_LENGTH - 3)}...`;
}

function timestampToMilliseconds(timestamp) {
  if (!timestamp) {
    return 0;
  }

  if (typeof timestamp.toMillis === "function") {
    return timestamp.toMillis();
  }

  if (timestamp._seconds !== undefined) {
    return timestamp._seconds * 1000;
  }

  if (timestamp.seconds !== undefined) {
    return timestamp.seconds * 1000;
  }

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function createConversationNotFoundError() {
  const error = new Error("Conversation not found.");
  error.statusCode = 404;

  return error;
}

function isLegacyConversationId(conversationId) {
  return conversationId.startsWith(LEGACY_CHAT_PREFIX);
}

function messagesToConversationHistory(messages) {
  const history = [];
  let pendingUserMessage = null;

  messages.forEach((message) => {
    if (message.role === "user") {
      pendingUserMessage = message.content;

      return;
    }

    if (
      message.role === "assistant" &&
      pendingUserMessage !== null
    ) {
      history.push({
        userMessage: pendingUserMessage,
        botResponse: message.content
      });

      pendingUserMessage = null;
    }
  });

  return history;
}

async function saveConversation(userId, userMessage, botResponse) {
  const conversationRef = await db.collection("conversations").add({
    userId,
    userMessage,
    botResponse,
    createdAt: new Date()
  });

  return conversationRef.id;
}

async function getUserConversations(userId) {
  const snapshot = await db
    .collection("conversations")
    .where("userId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function getRecentConversations(userId, limit = 5) {
  const snapshot = await db
    .collection("conversations")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const conversations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  // Firestore returns newest first.
  // Reverse so Groq receives the conversation in chronological order.
  return conversations.reverse();
}

async function createChatSession(userId) {
  const sessionRef = db
    .collection(CHAT_SESSIONS_COLLECTION)
    .doc();

  const createdAt = new Date();

  const session = {
    userId,
    title: DEFAULT_CHAT_TITLE,
    channel: "web",
    messageCount: 0,
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt
  };

  await sessionRef.set(session);

  return {
    id: sessionRef.id,
    ...session
  };
}

async function listUserChatSessions(userId) {
  const [sessionSnapshot, legacySnapshot] = await Promise.all([
    db
      .collection(CHAT_SESSIONS_COLLECTION)
      .where("userId", "==", userId)
      .get(),
    db
      .collection("conversations")
      .where("userId", "==", userId)
      .get()
  ]);

  const sessions = sessionSnapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
    legacy: false
  }));

  const legacySessions = legacySnapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: `${LEGACY_CHAT_PREFIX}${doc.id}`,
      userId: data.userId,
      title: createConversationTitle(data.userMessage),
      channel: "web",
      messageCount: 2,
      schemaVersion: 0,
      createdAt: data.createdAt,
      updatedAt: data.createdAt,
      legacy: true
    };
  });

  return [...sessions, ...legacySessions].sort((a, b) =>
    timestampToMilliseconds(b.updatedAt) -
    timestampToMilliseconds(a.updatedAt)
  );
}

async function getOwnedChatSession(userId, conversationId) {
  if (
    !conversationId ||
    typeof conversationId !== "string"
  ) {
    throw createConversationNotFoundError();
  }

  const sessionRef = db
    .collection(CHAT_SESSIONS_COLLECTION)
    .doc(conversationId);

  const sessionDoc = await sessionRef.get();
  const sessionData = sessionDoc.data();

  if (!sessionDoc.exists || sessionData?.userId !== userId) {
    throw createConversationNotFoundError();
  }

  return {
    ref: sessionRef,
    data: sessionData,
    id: sessionDoc.id
  };
}

async function getLegacyChatSession(userId, conversationId) {
  const legacyId = conversationId.substring(
    LEGACY_CHAT_PREFIX.length
  );

  if (!legacyId) {
    throw createConversationNotFoundError();
  }

  const legacyDoc = await db
    .collection("conversations")
    .doc(legacyId)
    .get();

  const data = legacyDoc.data();

  if (!legacyDoc.exists || data?.userId !== userId) {
    throw createConversationNotFoundError();
  }

  const messages = [
    {
      id: `${legacyId}:user`,
      userId,
      role: "user",
      content: data.userMessage,
      inputType: "text",
      sequence: 0,
      createdAt: data.createdAt
    },
    {
      id: `${legacyId}:assistant`,
      userId,
      role: "assistant",
      content: data.botResponse,
      inputType: "text",
      sequence: 1,
      createdAt: data.createdAt
    }
  ];

  return {
    conversation: {
      id: conversationId,
      userId,
      title: createConversationTitle(data.userMessage),
      channel: "web",
      messageCount: messages.length,
      schemaVersion: 0,
      createdAt: data.createdAt,
      updatedAt: data.createdAt,
      legacy: true
    },
    messages
  };
}

async function getChatSessionWithMessages(
  userId,
  conversationId
) {
  if (
    typeof conversationId === "string" &&
    isLegacyConversationId(conversationId)
  ) {
    return getLegacyChatSession(userId, conversationId);
  }

  const session = await getOwnedChatSession(
    userId,
    conversationId
  );

  const messageSnapshot = await session.ref
    .collection("messages")
    .orderBy("sequence", "asc")
    .get();

  const messages = messageSnapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id
  }));

  return {
    conversation: {
      ...session.data,
      id: session.id,
      legacy: false
    },
    messages
  };
}

async function getChatHistory(userId, conversationId) {
  const { messages } = await getChatSessionWithMessages(
    userId,
    conversationId
  );

  return messagesToConversationHistory(messages);
}

async function saveChatTurn(
  userId,
  conversationId,
  userMessage,
  botResponse,
  inputType = "text"
) {
  const sessionRef = db
    .collection(CHAT_SESSIONS_COLLECTION)
    .doc(conversationId);

  const userMessageRef = sessionRef
    .collection("messages")
    .doc();

  const assistantMessageRef = sessionRef
    .collection("messages")
    .doc();

  const turnId = userMessageRef.id;
  const createdAt = new Date();

  return db.runTransaction(async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef);
    const sessionData = sessionDoc.data();

    if (!sessionDoc.exists || sessionData?.userId !== userId) {
      throw createConversationNotFoundError();
    }

    const currentMessageCount = Number.isInteger(
      sessionData.messageCount
    )
      ? sessionData.messageCount
      : 0;

    const safeInputType =
      inputType === "voice" ? "voice" : "text";

    transaction.set(userMessageRef, {
      userId,
      role: "user",
      content: userMessage,
      inputType: safeInputType,
      turnId,
      sequence: currentMessageCount,
      createdAt
    });

    transaction.set(assistantMessageRef, {
      userId,
      role: "assistant",
      content: botResponse,
      inputType: "text",
      turnId,
      sequence: currentMessageCount + 1,
      createdAt
    });

    const sessionUpdates = {
      messageCount: currentMessageCount + 2,
      updatedAt: createdAt
    };

    if (
      !sessionData.title ||
      sessionData.title === DEFAULT_CHAT_TITLE
    ) {
      sessionUpdates.title = createConversationTitle(userMessage);
    }

    transaction.update(sessionRef, sessionUpdates);

    return {
      conversationId,
      userMessageId: userMessageRef.id,
      assistantMessageId: assistantMessageRef.id
    };
  });
}

async function isMessageProcessed(messageId) {
  if (!messageId) {
    return false;
  }

  const messageRef = db
    .collection("processedMessages")
    .doc(messageId);

  const messageDoc = await messageRef.get();

  return messageDoc.exists;
}

async function markMessageAsProcessed(messageId) {
  if (!messageId) {
    return;
  }

  await db
    .collection("processedMessages")
    .doc(messageId)
    .set({
      processedAt: new Date()
    });
}

module.exports = {
  createChatSession,
  createConversationTitle,
  getChatHistory,
  getChatSessionWithMessages,
  saveConversation,
  saveChatTurn,
  listUserChatSessions,
  messagesToConversationHistory,
  getUserConversations,
  getRecentConversations,
  isMessageProcessed,
  markMessageAsProcessed
};
