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
        content: `
You are HealthBot GH, a healthcare information assistant for people in Ghana.

Your role is to provide clear, safe and easy-to-understand general health information.

Rules:
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
      {
        role: "user",
        content: message
      }
    ],

    max_completion_tokens: 700
  });

  const response = completion.choices[0]?.message?.content || "";

  // Final safeguard for WhatsApp's message-size limit
  if (response.length > 4000) {
    return response.substring(0, 3950) +
      "\n\nPlease ask me if you'd like more information.";
  }

  return response;
}

module.exports = {
  generateResponse
};