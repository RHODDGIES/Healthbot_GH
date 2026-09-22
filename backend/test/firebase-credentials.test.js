const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  getEnvironmentServiceAccount,
  loadFirebaseServiceAccount
} = require("../src/config/firebase-credentials");

test("uses complete Firebase Admin environment credentials in production", () => {
  const credentials = getEnvironmentServiceAccount({
    FIREBASE_PROJECT_ID: "healthbot-test",
    FIREBASE_CLIENT_EMAIL: "firebase@test.invalid",
    FIREBASE_PRIVATE_KEY: "line-one\\nline-two"
  });

  assert.deepEqual(credentials, {
    projectId: "healthbot-test",
    clientEmail: "firebase@test.invalid",
    privateKey: "line-one\nline-two"
  });
});

test("rejects incomplete Firebase Admin environment credentials", () => {
  assert.throws(
    () => getEnvironmentServiceAccount({
      FIREBASE_PROJECT_ID: "healthbot-test"
    }),
    /FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY/
  );
});

test("uses the local service-account file when environment credentials are absent", () => {
  const localCredentials = {
    project_id: "local-healthbot",
    client_email: "local@test.invalid",
    private_key: "local-test-key"
  };
  const credentials = loadFirebaseServiceAccount({
    environment: {},
    serviceAccountPath: "local-service-account.json",
    existsSync: () => true,
    readFileSync: () => JSON.stringify(localCredentials)
  });

  assert.deepEqual(credentials, localCredentials);
});

test("fails safely when no Firebase Admin credentials are available", () => {
  assert.throws(
    () => loadFirebaseServiceAccount({
      environment: {},
      serviceAccountPath: "missing-service-account.json",
      existsSync: () => false,
      readFileSync: () => ""
    }),
    /Firebase Admin credentials are not configured/
  );
});
