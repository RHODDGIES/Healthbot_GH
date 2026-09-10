const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const frontendDirectory = path.join(__dirname, "../../frontend");
const appSource = fs.readFileSync(
  path.join(frontendDirectory, "app.js"),
  "utf8"
);
const htmlSource = fs.readFileSync(
  path.join(frontendDirectory, "index.html"),
  "utf8"
);

test("web chat includes an accessible voice-note control and status", () => {
  assert.match(htmlSource, /id="voiceNoteButton"/);
  assert.match(htmlSource, /aria-label="Record an English voice note"/);
  assert.match(htmlSource, /id="voiceNoteStatus"/);
  assert.match(htmlSource, /aria-live="polite"/);
});

test("web voice notes use MediaRecorder and the protected conversation endpoint", () => {
  assert.match(appSource, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(appSource, /window\.MediaRecorder/);
  assert.match(appSource, /"\/api\/ai\/voice"/);
  assert.match(appSource, /"X-Conversation-Id": conversationId/);
  assert.match(appSource, /rawBody: audioBlob/);
});

test("web voice notes remain English-only for the first release", () => {
  assert.match(appSource, /currentLanguage !== "en"/);
  assert.match(
    appSource,
    /Web voice notes currently support English only/
  );
  assert.match(appSource, /"X-HealthBot-Language": "English"/);
});
