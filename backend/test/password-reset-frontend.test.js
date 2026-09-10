const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const frontendDirectory = path.join(
  __dirname,
  "../../frontend"
);

const authScript = fs.readFileSync(
  path.join(frontendDirectory, "auth.js"),
  "utf8"
);

const passwordResetScript = fs.readFileSync(
  path.join(
    frontendDirectory,
    "password-reset.service.js"
  ),
  "utf8"
);

const loginPage = fs.readFileSync(
  path.join(frontendDirectory, "login.html"),
  "utf8"
);

const resetPage = fs.readFileSync(
  path.join(frontendDirectory, "forgot-password.html"),
  "utf8"
);

const firebaseScript = fs.readFileSync(
  path.join(frontendDirectory, "firebase.js"),
  "utf8"
);

test("login page links to password recovery", () => {
  assert.match(loginPage, /href="forgot-password\.html"/);
});

test("password-reset service calls the official Firebase REST endpoint", () => {
  assert.match(
    passwordResetScript,
    /identitytoolkit\.googleapis\.com\/v1\/accounts:sendOobCode/
  );
  assert.match(
    passwordResetScript,
    /export async function requestPasswordReset/
  );
  assert.match(
    passwordResetScript,
    /requestType:\s*"PASSWORD_RESET"/
  );
});

test("password recovery page submits an email without exposing account existence", () => {
  assert.match(resetPage, /id="passwordResetForm"/);
  assert.match(
    resetPage,
    /"\.\/password-reset\.service\.js"/
  );
  assert.match(resetPage, /requestPasswordReset\(email\)/);
  assert.match(
    resetPage,
    /If an account exists for that email/
  );
});

test("password recovery page explains local-server and Firebase failures", () => {
  assert.match(
    resetPage,
    /window\.location\.protocol === "file:"/
  );
  assert.match(resetPage, /auth\/network-request-failed/);
  assert.match(resetPage, /auth\/operation-not-allowed/);
  assert.doesNotMatch(
    resetPage,
    /Open HealthBot through http:\/\/localhost:5000/
  );
});

test("frontend authentication loads the vendored Firebase SDK", () => {
  assert.match(
    authScript,
    /from "\.\/vendor\/firebase-auth\.js"/
  );
  assert.match(
    firebaseScript,
    /from "\.\/vendor\/firebase-app\.js"/
  );
  assert.match(
    firebaseScript,
    /from "\.\/vendor\/firebase-auth\.js"/
  );
  assert.doesNotMatch(authScript, /www\.gstatic\.com/);
  assert.doesNotMatch(firebaseScript, /www\.gstatic\.com/);
});
