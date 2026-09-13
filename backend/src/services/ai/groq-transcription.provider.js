const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const TRANSCRIPTION_MODEL = "whisper-large-v3";

const audioFileExtensions = {
  "audio/flac": "flac",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-flac": "flac",
  "audio/x-wav": "wav"
};

function normalizeMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== "string") {
    return "";
  }

  return mimeType
    .split(";")[0]
    .trim()
    .toLowerCase();
}

async function transcribeAudio(
  audioBuffer,
  mimeType,
  groqClient = groq,
  transcriptionOptions = {}
) {
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    throw new Error("A valid audio buffer is required.");
  }

  const normalizedMimeType = normalizeMimeType(mimeType);
  const fileExtension =
    audioFileExtensions[normalizedMimeType];

  if (!fileExtension) {
    throw new Error("This audio format is not supported for transcription.");
  }

  const audioFile = await Groq.toFile(
    audioBuffer,
    `whatsapp-voice-note.${fileExtension}`,
    {
      type: normalizedMimeType
    }
  );

  const transcriptionRequest = {
    file: audioFile,
    model: TRANSCRIPTION_MODEL,
    response_format: "json",
    temperature: 0
  };
  const safeTranscriptionOptions =
    transcriptionOptions && typeof transcriptionOptions === "object"
      ? transcriptionOptions
      : {};

  const requestedLanguage =
    typeof safeTranscriptionOptions.language === "string"
      ? safeTranscriptionOptions.language.trim().toLowerCase()
      : "";
  const transcriptionPrompt =
    typeof safeTranscriptionOptions.prompt === "string"
      ? safeTranscriptionOptions.prompt.trim()
      : "";

  if (requestedLanguage) {
    transcriptionRequest.language = requestedLanguage;
  }

  if (transcriptionPrompt) {
    transcriptionRequest.prompt = transcriptionPrompt;
  }

  const transcription =
    await groqClient.audio.transcriptions.create(
      transcriptionRequest
    );

  const transcript = transcription?.text?.trim();

  if (!transcript) {
    throw new Error("The voice note did not contain understandable speech.");
  }

  return transcript;
}

module.exports = {
  normalizeMimeType,
  transcribeAudio
};
