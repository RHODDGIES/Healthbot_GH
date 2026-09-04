const dotenv = require("dotenv");

dotenv.config();

const config = {
  port: process.env.PORT || 5000,
  groqApiKey: process.env.GROQ_API_KEY || "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || ""
};

module.exports = config;