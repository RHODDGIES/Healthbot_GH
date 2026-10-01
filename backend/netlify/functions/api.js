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

function prepareNetlifyRequest(request, event) {
  const bodyBuffer = getEventBodyBuffer(event);

  if (
    request.method === "POST" &&
    request.url.startsWith("/api/whatsapp/webhook")
  ) {
    request.rawBody = bodyBuffer;
  }

  const contentType = String(
    request.headers["content-type"] || ""
  )
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  // serverless-http exposes the event body as a Buffer. Express 5's JSON
  // parser treats that serverless request as already complete, so parse JSON
  // here before the request reaches the normal Express middleware stack.
  if (contentType === "application/json" && bodyBuffer.length > 0) {
    try {
      request.body = JSON.parse(bodyBuffer.toString("utf8"));
    } catch {
      request.body = {};
    }
  }
}

const handler = serverless(app, {
  request: prepareNetlifyRequest
});

module.exports = {
  getEventBodyBuffer,
  prepareNetlifyRequest,
  handler
};
