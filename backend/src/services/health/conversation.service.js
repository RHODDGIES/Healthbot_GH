const { db } = require("../../config/firebase");

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
  saveConversation,
  getUserConversations,
  getRecentConversations,
  isMessageProcessed,
  markMessageAsProcessed
};