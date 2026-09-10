const assert = require("node:assert/strict");
const { test } = require("node:test");

process.env.GROQ_API_KEY = "test-groq-key";

const environmentPath = require.resolve(
  "../src/config/environment"
);

require.cache[environmentPath] = {
  id: environmentPath,
  filename: environmentPath,
  loaded: true,
  exports: {
    whatsappAccessToken: "test-whatsapp-token",
    whatsappPhoneNumberId: "test-phone-number-id"
  }
};

const {
  normalizeMimeType,
  transcribeAudio
} = require("../src/services/ai/groq-transcription.provider");

const {
  downloadWhatsAppMedia
} = require("../src/services/whatsapp/whatsapp.service");

test("normalizes WhatsApp OGG/Opus MIME types", () => {
  assert.equal(
    normalizeMimeType("audio/ogg; codecs=opus"),
    "audio/ogg"
  );
});

test("sends an in-memory voice note to Groq for transcription", async () => {
  let transcriptionRequest;

  const groqClient = {
    audio: {
      transcriptions: {
        create: async (request) => {
          transcriptionRequest = request;

          return {
            text: "  Akpe  "
          };
        }
      }
    }
  };

  const transcript = await transcribeAudio(
    Buffer.from("voice-note"),
    "audio/ogg; codecs=opus",
    groqClient
  );

  assert.equal(transcript, "Akpe");
  assert.equal(
    transcriptionRequest.model,
    "whisper-large-v3"
  );
  assert.equal(
    transcriptionRequest.file.name,
    "whatsapp-voice-note.ogg"
  );
  assert.equal(
    transcriptionRequest.file.type,
    "audio/ogg"
  );
});

test("rejects audio formats that Groq cannot transcribe", async () => {
  await assert.rejects(
    transcribeAudio(
      Buffer.from("voice-note"),
      "audio/amr"
    ),
    /not supported/
  );
});

test("rejects an empty transcription", async () => {
  const groqClient = {
    audio: {
      transcriptions: {
        create: async () => ({
          text: "   "
        })
      }
    }
  };

  await assert.rejects(
    transcribeAudio(
      Buffer.from("voice-note"),
      "audio/ogg",
      groqClient
    ),
    /understandable speech/
  );
});

test("downloads WhatsApp media through the authenticated two-step flow", async () => {
  const calls = [];

  const fetchImplementation = async (url, options) => {
    calls.push({
      url: String(url),
      options
    });

    if (calls.length === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          url: "https://lookaside.fbsbx.com/test-voice-note",
          mime_type: "audio/ogg; codecs=opus",
          file_size: 3
        })
      };
    }

    return {
      ok: true,
      status: 200,
      headers: {
        get: (name) =>
          name === "content-length" ? "3" : null
      },
      arrayBuffer: async () =>
        Uint8Array.from([1, 2, 3]).buffer
    };
  };

  const audio = await downloadWhatsAppMedia(
    "media-id",
    fetchImplementation
  );

  assert.equal(calls.length, 2);
  assert.match(
    calls[0].url,
    /graph\.facebook\.com\/v26\.0\/media-id/
  );
  assert.match(
    calls[0].url,
    /phone_number_id=test-phone-number-id/
  );
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer test-whatsapp-token"
  );
  assert.equal(
    calls[1].options.headers.Authorization,
    "Bearer test-whatsapp-token"
  );
  assert.deepEqual(audio.buffer, Buffer.from([1, 2, 3]));
  assert.equal(audio.mimeType, "audio/ogg; codecs=opus");
});

test("rejects oversized WhatsApp audio before downloading it", async () => {
  let callCount = 0;

  const fetchImplementation = async () => {
    callCount += 1;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        url: "https://lookaside.fbsbx.com/large-voice-note",
        mime_type: "audio/ogg; codecs=opus",
        file_size: 16 * 1024 * 1024 + 1
      })
    };
  };

  await assert.rejects(
    downloadWhatsAppMedia(
      "large-media-id",
      fetchImplementation
    ),
    /larger than 16 MB/
  );

  assert.equal(callCount, 1);
});
