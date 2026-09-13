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
  assert.match(appSource, /rawBody: uploadBlob/);
});

test("web voice notes send the selected English, Twi or Ewe language", () => {
  assert.match(
    appSource,
    /voiceRecordingLanguage =\s*languageNames\[currentLanguage\]/
  );
  assert.match(
    appSource,
    /"X-HealthBot-Language": selectedLanguage/
  );
  assert.doesNotMatch(appSource, /currentLanguage !== "en"/);
  assert.doesNotMatch(
    appSource,
    /Web voice notes currently support English only/
  );
  assert.match(
    appSource,
    /data\.requiresConfirmation/
  );
  assert.match(
    appSource,
    /beginVoiceConfirmation/
  );
  assert.match(
    appSource,
    /inputType: "voice"/
  );
  assert.match(appSource, /prepareVoiceNoteAudio/);
  assert.match(appSource, /convertVoiceBlobToWav/);
  assert.match(appSource, /KHAYA_TARGET_SAMPLE_RATE = 16000/);
  assert.match(appSource, /type: "audio\/wav"/);
});

test("Twi and Ewe voice transcripts can be corrected or cancelled", () => {
  assert.match(htmlSource, /id="voiceTranscriptCancelButton"/);
  assert.match(
    appSource,
    /Check and correct the \$\{selectedLanguage\} transcription/
  );
  assert.match(appSource, /sendConfirmedVoiceTranscription/);
  assert.match(appSource, /clearPendingVoiceConfirmation/);
});
