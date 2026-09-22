const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  buildNetlifyFrontend,
  getFirebaseWebConfig
} = require("../scripts/build-netlify-frontend");

const publicEnvironment = {
  FIREBASE_WEB_API_KEY: "public-web-api-key",
  FIREBASE_WEB_AUTH_DOMAIN: "healthbot-test.firebaseapp.com",
  FIREBASE_WEB_PROJECT_ID: "healthbot-test",
  FIREBASE_WEB_STORAGE_BUCKET: "healthbot-test.firebasestorage.app",
  FIREBASE_WEB_MESSAGING_SENDER_ID: "123456789",
  FIREBASE_WEB_APP_ID: "test-app-id",
  GROQ_API_KEY: "must-not-enter-browser-build"
};

test("requires every public Firebase web setting", () => {
  assert.throws(
    () => getFirebaseWebConfig({
      FIREBASE_WEB_API_KEY: "only-one-setting"
    }),
    /FIREBASE_WEB_AUTH_DOMAIN/
  );
});

test("builds an isolated Netlify frontend without local credentials", (t) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "healthbot-netlify-build-")
  );
  const frontendDirectory = path.join(
    temporaryDirectory,
    "frontend"
  );
  const outputDirectory = path.join(
    temporaryDirectory,
    "dist"
  );
  const privacyPolicyPath = path.join(
    temporaryDirectory,
    "privacy-policy.html"
  );

  t.after(() => {
    fs.rmSync(temporaryDirectory, {
      recursive: true,
      force: true
    });
  });

  fs.mkdirSync(frontendDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDirectory, "index.html"),
    "<h1>HealthBot GH</h1>"
  );
  fs.writeFileSync(
    path.join(frontendDirectory, "firebase-config.js"),
    "local configuration must not be copied"
  );
  fs.writeFileSync(
    path.join(frontendDirectory, "firebase-config.example.js"),
    "example configuration is not a production asset"
  );
  fs.writeFileSync(
    path.join(frontendDirectory, ".env"),
    "LOCAL_SECRET=must-not-be-copied"
  );
  fs.writeFileSync(
    path.join(frontendDirectory, "serviceAccountKey.json"),
    "must-not-be-copied"
  );
  fs.writeFileSync(
    privacyPolicyPath,
    "<h1>Privacy policy</h1>"
  );

  buildNetlifyFrontend({
    environment: publicEnvironment,
    frontendDirectory,
    outputDirectory,
    privacyPolicyPath
  });

  const generatedConfig = fs.readFileSync(
    path.join(outputDirectory, "firebase-config.js"),
    "utf8"
  );

  assert.equal(
    fs.existsSync(path.join(outputDirectory, "index.html")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(outputDirectory, "privacy-policy.html")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(outputDirectory, ".env")),
    false
  );
  assert.equal(
    fs.existsSync(
      path.join(outputDirectory, "firebase-config.example.js")
    ),
    false
  );
  assert.equal(
    fs.existsSync(
      path.join(outputDirectory, "serviceAccountKey.json")
    ),
    false
  );
  assert.match(generatedConfig, /public-web-api-key/);
  assert.doesNotMatch(
    generatedConfig,
    /local configuration must not be copied/
  );
  assert.doesNotMatch(
    generatedConfig,
    /must-not-enter-browser-build/
  );
});
