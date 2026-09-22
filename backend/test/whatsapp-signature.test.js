const assert = require("node:assert/strict");
const { test } = require("node:test");

const environment = {
  whatsappAppSecret: "test-meta-app-secret"
};
const environmentPath = require.resolve(
  "../src/config/environment"
);

require.cache[environmentPath] = {
  id: environmentPath,
  filename: environmentPath,
  loaded: true,
  exports: environment
};

const {
  createWhatsAppSignature,
  isValidWhatsAppSignature,
  verifyWhatsAppSignature
} = require("../src/middleware/whatsapp-signature.middleware");

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(statusCode) {
      this.statusCode = statusCode;

      return this;
    },
    json(payload) {
      this.payload = payload;

      return this;
    }
  };
}

test("accepts a valid Meta WhatsApp webhook signature", () => {
  const rawBody = Buffer.from(
    JSON.stringify({ object: "whatsapp_business_account" })
  );
  const signature = createWhatsAppSignature(
    rawBody,
    environment.whatsappAppSecret
  );
  const req = {
    rawBody,
    headers: {
      "x-hub-signature-256": signature
    }
  };
  const res = createResponse();
  let nextCalled = false;

  verifyWhatsAppSignature(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(
    isValidWhatsAppSignature(
      rawBody,
      signature,
      environment.whatsappAppSecret
    ),
    true
  );
});

for (const providedSignature of [
  "",
  "sha256=not-a-valid-signature",
  `sha256=${"0".repeat(64)}`
]) {
  test("rejects a missing or invalid Meta WhatsApp webhook signature", () => {
    const req = {
      rawBody: Buffer.from("{}"),
      headers: {
        "x-hub-signature-256": providedSignature
      }
    };
    const res = createResponse();
    let nextCalled = false;

    verifyWhatsAppSignature(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.payload.error, /Invalid WhatsApp webhook signature/);
  });
}

test("fails closed when the Meta app secret is not configured", () => {
  const previousSecret = environment.whatsappAppSecret;
  const res = createResponse();

  environment.whatsappAppSecret = "";

  try {
    verifyWhatsAppSignature({
      rawBody: Buffer.from("{}"),
      headers: {}
    }, res, () => {
      throw new Error("next must not be called");
    });
  } finally {
    environment.whatsappAppSecret = previousSecret;
  }

  assert.equal(res.statusCode, 503);
  assert.match(res.payload.error, /verification is unavailable/);
});
