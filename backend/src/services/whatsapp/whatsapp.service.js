const config = require("../../config/environment");

const GRAPH_API_VERSION = "v26.0";
const MAX_AUDIO_SIZE_BYTES = 16 * 1024 * 1024;

async function sendWhatsAppMessage(recipient, message) {
  try {
    const isBsuid = /^[A-Z]{2}\./.test(recipient);

    const payload = {
      messaging_product: "whatsapp",
      type: "text",
      text: {
        body: message
      }
    };

    if (isBsuid) {
      payload.recipient = recipient;
    } else {
      payload.to = recipient;
    }

    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      throw new Error("Failed to send WhatsApp message.");
    }

    console.log("WhatsApp API response:", {
      messaging_product: data.messaging_product,
      hasMessages: !!data.messages?.length
    });

    return data;
  } catch (error) {
    console.error("WhatsApp Service Error:", error.message);
    throw error;
  }
}

async function downloadWhatsAppMedia(
  mediaId,
  fetchImplementation = fetch
) {
  if (!mediaId || typeof mediaId !== "string") {
    throw new Error("A valid WhatsApp media ID is required.");
  }

  const mediaEndpoint = new URL(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(mediaId)}`
  );

  if (config.whatsappPhoneNumberId) {
    mediaEndpoint.searchParams.set(
      "phone_number_id",
      config.whatsappPhoneNumberId
    );
  }

  const authorizationHeader = {
    Authorization: `Bearer ${config.whatsappAccessToken}`
  };

  const metadataResponse = await fetchImplementation(
    mediaEndpoint,
    {
      headers: authorizationHeader
    }
  );

  if (!metadataResponse.ok) {
    throw new Error(
      `Unable to retrieve WhatsApp media metadata (${metadataResponse.status}).`
    );
  }

  const metadata = await metadataResponse.json();

  if (!metadata?.url) {
    throw new Error("WhatsApp did not return a media download URL.");
  }

  const reportedFileSize = Number(metadata.file_size);

  if (
    Number.isFinite(reportedFileSize) &&
    reportedFileSize > MAX_AUDIO_SIZE_BYTES
  ) {
    throw new Error("The WhatsApp voice note is larger than 16 MB.");
  }

  const downloadUrl = new URL(metadata.url);

  if (downloadUrl.protocol !== "https:") {
    throw new Error("WhatsApp returned an invalid media download URL.");
  }

  const mediaResponse = await fetchImplementation(
    downloadUrl,
    {
      headers: authorizationHeader
    }
  );

  if (!mediaResponse.ok) {
    throw new Error(
      `Unable to download WhatsApp media (${mediaResponse.status}).`
    );
  }

  const contentLength = Number(
    mediaResponse.headers.get("content-length")
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_AUDIO_SIZE_BYTES
  ) {
    throw new Error("The WhatsApp voice note is larger than 16 MB.");
  }

  const mediaBuffer = Buffer.from(
    await mediaResponse.arrayBuffer()
  );

  if (mediaBuffer.length === 0) {
    throw new Error("The WhatsApp voice note was empty.");
  }

  if (mediaBuffer.length > MAX_AUDIO_SIZE_BYTES) {
    throw new Error("The WhatsApp voice note is larger than 16 MB.");
  }

  return {
    buffer: mediaBuffer,
    mimeType:
      metadata.mime_type ||
      mediaResponse.headers.get("content-type") ||
      ""
  };
}

module.exports = {
  downloadWhatsAppMedia,
  sendWhatsAppMessage
};
