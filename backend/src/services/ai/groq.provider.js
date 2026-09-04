const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function generateResponse(message) {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content:
          "You are HealthBot GH, a helpful healthcare information assistant for people in Ghana. Provide clear, safe, and easy-to-understand health information. Do not claim to diagnose diseases. For emergencies, advise the user to seek immediate professional medical care."
      },
      {
        role: "user",
        content: message
      }
    ]
  });

  return completion.choices[0]?.message?.content || "";
}

module.exports = {
  generateResponse
};