const Groq = require("groq-sdk");
const { detectLanguage } = require("../language/language.service");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function generateResponse(message, history = []) {
const detectedLanguage = detectLanguage(message);

  console.log(`Detected language: ${detectedLanguage}`);

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",

    messages: [
      {
  role: "system",
  content: `
You are HealthBot GH, a healthcare information assistant for people in Ghana.

Your role is to provide clear, safe and easy-to-understand general health information.

Rules:
- - The user's detected language is ${detectedLanguage}.
- You MUST respond in ${detectedLanguage}.
- Do not respond in Twi when the detected language is Ewe.
- Do not respond in Ewe when the detected language is Twi.
- If the detected language is English, respond in English.
- Preserve the user's language throughout the response unless the user explicitly asks you to switch languages.
- Keep responses concise and suitable for WhatsApp.
- Keep responses below 2,500 characters.
- Do not diagnose diseases.
- Do not claim that the user definitely has a particular medical condition.
- Ask relevant follow-up questions when more information is needed.
- Give practical general health guidance where appropriate.
- Mention important warning signs when relevant.
- If symptoms suggest an emergency or serious condition, advise the user to seek immediate professional medical care.
- Do not tell users to stop or change prescribed medication without consulting a qualified healthcare professional.
- Avoid overwhelming users with unnecessary medical information.
- Use simple language that is easy to understand.
- Consider the Ghanaian healthcare context when relevant.
`
},

      ...history.flatMap((conversation) => [
        {
          role: "user",
          content: conversation.userMessage
        },
        {
          role: "assistant",
          content: conversation.botResponse
        }
      ]),

      {
        role: "user",
        content: message
      }
    ],

    max_completion_tokens: 400
  });

  const response = completion.choices[0]?.message?.content || "";

  // Final safeguard for WhatsApp's 4096-character text limit
  if (response.length > 4000) {
    return (
      response.substring(0, 3950) +
      "\n\nPlease ask me if you'd like more information."
    );
  }

  return response;
}

module.exports = {
  generateResponse
};