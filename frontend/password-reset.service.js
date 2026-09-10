import {
  firebaseConfig
} from "./firebase-config.js";

const PASSWORD_RESET_ENDPOINT =
  "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode";

function createResetError(code, message) {
  const error = new Error(message);
  error.code = code;

  return error;
}

function getFirebaseErrorCode(data) {
  const message = data?.error?.message;

  if (typeof message !== "string") {
    return "";
  }

  return message.split(" : ")[0].trim();
}

export async function requestPasswordReset(email) {
  let response;

  try {
    response = await fetch(
      `${PASSWORD_RESET_ENDPOINT}?key=${encodeURIComponent(
        firebaseConfig.apiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email
        })
      }
    );
  } catch (cause) {
    const error = createResetError(
      "auth/network-request-failed",
      "Firebase could not be reached."
    );

    error.cause = cause;
    throw error;
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    // The HTTP status below still provides a safe fallback error.
  }

  if (response.ok) {
    return;
  }

  const firebaseErrorCode = getFirebaseErrorCode(data);

  // Keep the response identical for registered and unknown addresses.
  if (firebaseErrorCode === "EMAIL_NOT_FOUND") {
    return;
  }

  if (
    firebaseErrorCode === "INVALID_EMAIL" ||
    firebaseErrorCode === "MISSING_EMAIL"
  ) {
    throw createResetError(
      "auth/invalid-email",
      "The email address is invalid."
    );
  }

  if (firebaseErrorCode === "OPERATION_NOT_ALLOWED") {
    throw createResetError(
      "auth/operation-not-allowed",
      "Password recovery is disabled."
    );
  }

  if (
    firebaseErrorCode === "TOO_MANY_ATTEMPTS_TRY_LATER" ||
    firebaseErrorCode === "TOO_MANY_REQUESTS"
  ) {
    throw createResetError(
      "auth/too-many-requests",
      "Too many password reset requests."
    );
  }

  throw createResetError(
    "auth/reset-request-failed",
    `Firebase rejected the password reset request (${response.status}).`
  );
}
