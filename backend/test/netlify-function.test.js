const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

process.env.WHATSAPP_APP_SECRET = "test-meta-app-secret";
process.env.WHATSAPP_VERIFY_TOKEN = "test-webhook-verify-token";

function mockModule(relativePath, exports) {
  const modulePath = require.resolve(relativePath);

  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  };
}

mockModule("../src/config/firebase", {
  db: {}
});

mockModule("../src/services/ai/groq.provider", {
  generateResponse: async () => "test response"
});

mockModule("../src/services/ai/groq-transcription.provider", {
  normalizeMimeType: (mimeType = "") => mimeType,
  transcribeAudio: async () => "test transcription"
});

const {
  handler
} = require("../netlify/functions/api");

test("Netlify Express function serves the API health route", async () => {
  const response = await handler({
    httpMethod: "GET",
    path: "/api/health",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: {}
  }, {});

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    status: "OK",
    service: "HealthBot GH",
    message: "HealthBot GH API is running"
  });
});

test("Netlify Express function completes Meta webhook verification", async () => {
  const response = await handler({
    httpMethod: "GET",
    path: "/api/whatsapp/webhook",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: {
      "hub.mode": "subscribe",
      "hub.verify_token": process.env.WHATSAPP_VERIFY_TOKEN,
      "hub.challenge": "healthbot-challenge"
    },
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: {}
  }, {});

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "healthbot-challenge");
});

test("Netlify Express function preserves the raw body for Meta signature verification", async () => {
  const body = JSON.stringify({ object: "signature-test" });
  const signature = `sha256=${crypto
    .createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
    .update(body)
    .digest("hex")}`;
  const response = await handler({
    httpMethod: "POST",
    path: "/api/whatsapp/webhook",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body,
    isBase64Encoded: false,
    requestContext: {}
  }, {});

  assert.equal(response.statusCode, 404);
});

test("Netlify Express function rejects a forged Meta webhook body", async () => {
  const response = await handler({
    httpMethod: "POST",
    path: "/api/whatsapp/webhook",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${"0".repeat(64)}`
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: JSON.stringify({ object: "signature-test" }),
    isBase64Encoded: false,
    requestContext: {}
  }, {});

  assert.equal(response.statusCode, 401);
});

test("Netlify configuration preserves same-origin API routes", () => {
  const configSource = fs.readFileSync(
    path.join(__dirname, "../../netlify.toml"),
    "utf8"
  );

  assert.match(configSource, /base = "backend"/);
  assert.match(configSource, /publish = "dist"/);
  assert.match(configSource, /from = "\/api\/\*"/);
  assert.match(
    configSource,
    /to = "\/\.netlify\/functions\/api\/:splat"/
  );
});
