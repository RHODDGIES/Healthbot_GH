const DEFAULT_KHAYA_ASR_BASE_URL =
  "https://developer-api.khaya.ai/asr/v3";
const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 60000;

const SUPPORTED_KHAYA_LANGUAGE_CODES = new Set([
  "twi",
  "ewe"
]);

const SUPPORTED_KHAYA_AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav"
]);

function normalizeMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== "string") {
    return "";
  }

  return mimeType
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function createProviderError(message, statusCode) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

function buildTranscriptionUrl(baseUrl, languageCode) {
  let url;

  try {
    url = new URL(
      `${String(baseUrl).trim().replace(/\/+$/, "")}/transcribe`
    );
  } catch {
    throw createProviderError(
      "Khaya speech transcription is not configured correctly.",
      503
    );
  }

  if (url.protocol !== "https:") {
    throw createProviderError(
      "Khaya speech transcription requires a secure HTTPS endpoint.",
      503
    );
  }

  url.searchParams.set("language", languageCode);

  return url;
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getKhayaErrorCode(payload) {
  const details = payload?.error?.details;

  if (!Array.isArray(details)) {
    return "";
  }

  return details.find((detail) => detail?.code)?.code || "";
}

function createKhayaResponseError(response, payload) {
  const errorCode = getKhayaErrorCode(payload);

  if (
    errorCode === "EMPTY_AUDIO" ||
    errorCode === "INVALID_AUDIO_FORMAT"
  ) {
    return createProviderError(
      "The voice note could not be decoded. Please record it again.",
      422
    );
  }

  if (errorCode === "UNSUPPORTED_LANGUAGE") {
    return createProviderError(
      "The selected language is not currently available for voice transcription.",
      503
    );
  }

  if (response.status === 401 || response.status === 403) {
    return createProviderError(
      "Twi and Ewe voice transcription is not configured correctly.",
      503
    );
  }

  if (response.status === 429) {
    return createProviderError(
      "Twi and Ewe voice transcription is temporarily busy. Please try again shortly.",
      503
    );
  }

  return createProviderError(
    "Twi and Ewe voice transcription is temporarily unavailable.",
    502
  );
}

async function transcribeAudio(
  audioBuffer,
  mimeType,
  languageCode,
  options = {}
) {
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    throw createProviderError(
      "A valid audio buffer is required.",
      400
    );
  }

  const normalizedMimeType = normalizeMimeType(mimeType);

  if (!SUPPORTED_KHAYA_AUDIO_TYPES.has(normalizedMimeType)) {
    throw createProviderError(
      "Twi and Ewe voice notes must use MP3, WAV, FLAC or OGG audio.",
      415
    );
  }

  const normalizedLanguageCode =
    typeof languageCode === "string"
      ? languageCode.trim().toLowerCase()
      : "";

  if (!SUPPORTED_KHAYA_LANGUAGE_CODES.has(normalizedLanguageCode)) {
    throw createProviderError(
      "A supported Khaya language code is required.",
      400
    );
  }

  const safeOptions =
    options && typeof options === "object" ? options : {};
  const apiKey = String(
    safeOptions.apiKey || process.env.KHAYA_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw createProviderError(
      "Twi and Ewe voice transcription is not configured yet.",
      503
    );
  }

  const baseUrl =
    safeOptions.baseUrl ||
    process.env.KHAYA_ASR_BASE_URL ||
    DEFAULT_KHAYA_ASR_BASE_URL;
  const fetchImplementation =
    safeOptions.fetchImplementation || globalThis.fetch;

  if (typeof fetchImplementation !== "function") {
    throw createProviderError(
      "Twi and Ewe voice transcription is unavailable on this server.",
      503
    );
  }

  const requestedTimeout = Number(safeOptions.timeoutMs);
  const timeoutMs =
    Number.isFinite(requestedTimeout) && requestedTimeout > 0
      ? requestedTimeout
      : DEFAULT_TRANSCRIPTION_TIMEOUT_MS;
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetchImplementation(
      buildTranscriptionUrl(baseUrl, normalizedLanguageCode),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": normalizedMimeType,
          "Ocp-Apim-Subscription-Key": apiKey
        },
        body: audioBuffer,
        signal: abortController.signal
      }
    );
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw createKhayaResponseError(response, payload);
    }

    const transcript = payload?.text?.trim();

    if (!transcript) {
      throw createProviderError(
        "The voice note did not contain understandable speech.",
        422
      );
    }

    return transcript;
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw createProviderError(
        "Twi and Ewe voice transcription timed out. Please try again.",
        504
      );
    }

    throw createProviderError(
      "Twi and Ewe voice transcription is temporarily unavailable.",
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  DEFAULT_KHAYA_ASR_BASE_URL,
  SUPPORTED_KHAYA_AUDIO_TYPES,
  SUPPORTED_KHAYA_LANGUAGE_CODES,
  normalizeMimeType,
  transcribeAudio
};
