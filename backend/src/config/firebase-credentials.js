const fs = require("node:fs");

const FIREBASE_ENVIRONMENT_FIELDS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY"
];

function getEnvironmentServiceAccount(environment = process.env) {
  const values = FIREBASE_ENVIRONMENT_FIELDS.map(
    (field) => environment[field]
  );
  const hasAnyEnvironmentCredential = values.some(Boolean);

  if (!hasAnyEnvironmentCredential) {
    return null;
  }

  const missingFields = FIREBASE_ENVIRONMENT_FIELDS.filter(
    (field) => !environment[field]
  );

  if (missingFields.length) {
    throw new Error(
      `Firebase Admin configuration is incomplete. Missing: ${missingFields.join(", ")}.`
    );
  }

  return {
    projectId: environment.FIREBASE_PROJECT_ID,
    clientEmail: environment.FIREBASE_CLIENT_EMAIL,
    privateKey: environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  };
}

function loadFirebaseServiceAccount({
  environment = process.env,
  serviceAccountPath,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync
}) {
  const environmentServiceAccount =
    getEnvironmentServiceAccount(environment);

  if (environmentServiceAccount) {
    return environmentServiceAccount;
  }

  if (!serviceAccountPath || !existsSync(serviceAccountPath)) {
    throw new Error(
      "Firebase Admin credentials are not configured. Set the Firebase environment variables or provide the local service-account file."
    );
  }

  try {
    return JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  } catch {
    throw new Error(
      "The local Firebase service-account file could not be read."
    );
  }
}

module.exports = {
  FIREBASE_ENVIRONMENT_FIELDS,
  getEnvironmentServiceAccount,
  loadFirebaseServiceAccount
};
