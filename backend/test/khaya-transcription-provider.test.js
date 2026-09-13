const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  normalizeMimeType,
  transcribeAudio
} = require("../src/services/ai/khaya-transcription.provider");

test("normalizes Khaya audio MIME types", () => {
  assert.equal(
    normalizeMimeType("audio/ogg; codecs=opus"),
    "audio/ogg"
  );
});

for (const languageCode of ["twi", "ewe"]) {
  test(`sends raw ${languageCode} audio to Khaya v3 using the subscription header`, async () => {
    let capturedRequest;
    const audioBuffer = Buffer.from("test audio");

    const transcript = await transcribeAudio(
      audioBuffer,
      "audio/ogg; codecs=opus",
      languageCode,
      {
        apiKey: "test-subscription-key",
        baseUrl: "https://example.test/asr/v3/",
        fetchImplementation: async (url, options) => {
          capturedRequest = {
            url: String(url),
            options
          };

          return {
            ok: true,
            status: 200,
            json: async () => ({
              text: "  Me ho yɛ  "
            })
          };
        }
      }
    );

    assert.equal(transcript, "Me ho yɛ");
    assert.equal(
      capturedRequest.url,
      `https://example.test/asr/v3/transcribe?language=${languageCode}`
    );
    assert.equal(capturedRequest.options.method, "POST");
    assert.equal(
      capturedRequest.options.headers["Content-Type"],
      "audio/ogg"
    );
    assert.equal(
      capturedRequest.options.headers["Ocp-Apim-Subscription-Key"],
      "test-subscription-key"
    );
    assert.equal(capturedRequest.options.body, audioBuffer);
  });
}

test("rejects browser WebM before contacting Khaya", async () => {
  let requestCount = 0;

  await assert.rejects(
    transcribeAudio(
      Buffer.from("webm audio"),
      "audio/webm",
      "twi",
      {
        apiKey: "test-subscription-key",
        fetchImplementation: async () => {
          requestCount += 1;
        }
      }
    ),
    (error) => {
      assert.equal(error.statusCode, 415);
      assert.match(error.message, /MP3, WAV, FLAC or OGG/);

      return true;
    }
  );

  assert.equal(requestCount, 0);
});

test("requires a configured Khaya subscription key", async () => {
  await assert.rejects(
    transcribeAudio(
      Buffer.from("wav audio"),
      "audio/wav",
      "ewe",
      {
        apiKey: " "
      }
    ),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /not configured/);

      return true;
    }
  );
});

test("does not expose Khaya response details when the service fails", async () => {
  await assert.rejects(
    transcribeAudio(
      Buffer.from("wav audio"),
      "audio/wav",
      "twi",
      {
        apiKey: "test-subscription-key",
        fetchImplementation: async () => ({
          ok: false,
          status: 500,
          json: async () => ({
            error: {
              message: "sensitive upstream diagnostic"
            }
          })
        })
      }
    ),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.doesNotMatch(error.message, /sensitive upstream diagnostic/);

      return true;
    }
  );
});
