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

module.exports = {
  saveConversation,
  getUserConversations
};