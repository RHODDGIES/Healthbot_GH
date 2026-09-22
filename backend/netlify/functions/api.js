const serverless = require("serverless-http");

const app = require("../../src/app");

function getEventBodyBuffer(event) {
  if (Buffer.isBuffer(event.body)) {
    return event.body;
  }

  if (typeof event.body === "string") {
    return Buffer.from(
      event.body,
      event.isBase64Encoded ? "base64" : "utf8"
    );
  }

  if (event.body && typeof event.body === "object") {
    return Buffer.from(JSON.stringify(event.body), "utf8");
  }

  return Buffer.alloc(0);
}

const handler = serverless(app, {
  request(request, event) {
    if (
      request.method === "POST" &&
      request.url.startsWith("/api/whatsapp/webhook")
    ) {
      request.rawBody = getEventBodyBuffer(event);
    }
  }
});

module.exports = {
  getEventBodyBuffer,
  handler
};
