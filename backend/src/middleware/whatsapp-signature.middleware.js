const crypto = require("node:crypto");

const config = require("../config/environment");

function createWhatsAppSignature(rawBody, appSecret) {
  return `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
}

function isValidWhatsAppSignature(
  rawBody,
  providedSignature,
  appSecret
) {
  if (
    !Buffer.isBuffer(rawBody) ||
    !rawBody.length ||
    typeof providedSignature !== "string" ||
    !/^sha256=[a-f0-9]{64}$/i.test(providedSignature) ||
    !appSecret
  ) {
    return false;
  }

  const expectedSignature = createWhatsAppSignature(
    rawBody,
    appSecret
  );
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");

  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function verifyWhatsAppSignature(req, res, next) {
  if (!config.whatsappAppSecret) {
    console.error("WhatsApp webhook app secret is not configured.");

    return res.status(503).json({
      success: false,
      error: "WhatsApp webhook verification is unavailable."
    });
  }

  const providedSignature = String(
    req.headers["x-hub-signature-256"] || ""
  );

  if (
    !isValidWhatsAppSignature(
      req.rawBody,
      providedSignature,
      config.whatsappAppSecret
    )
  ) {
    return res.status(401).json({
      success: false,
      error: "Invalid WhatsApp webhook signature."
    });
  }

  return next();
}

module.exports = {
  createWhatsAppSignature,
  isValidWhatsAppSignature,
  verifyWhatsAppSignature
};
