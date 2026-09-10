const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const frontendDirectory = path.join(
  __dirname,
  "../../frontend"
);

const html = fs.readFileSync(
  path.join(frontendDirectory, "index.html"),
  "utf8"
);

const script = fs.readFileSync(
  path.join(frontendDirectory, "app.js"),
  "utf8"
);

const styles = fs.readFileSync(
  path.join(frontendDirectory, "styles.css"),
  "utf8"
);

test("renders New Chat and conversation-history controls", () => {
  assert.match(html, /id="newChatButton"/);
  assert.match(html, /id="newChatButtonLabel"/);
  assert.match(html, /id="newChatStatus"/);
  assert.match(html, /id="conversationList"/);
  assert.match(html, /id="conversationSidebar"/);
  assert.match(html, /id="historyToggleButton"/);
});

test("creates, lists, and opens authenticated conversations", () => {
  assert.match(
    script,
    /requestApi\(\s*"\/api\/ai\/conversations"/
  );
  assert.match(
    script,
    /\/api\/ai\/conversations\/\$\{encodeURIComponent/
  );
  assert.match(script, /async function createNewConversation/);
  assert.match(script, /async function openConversation/);
});

test("sends the active conversation and selected language with chat messages", () => {
  assert.match(
    script,
    /conversationId:\s*activeConversationId/
  );
  assert.match(
    script,
    /language:\s*\n?\s*languageNames\[currentLanguage\]/
  );
});

test("starting a new conversation preserves the selected language", () => {
  const start = script.indexOf(
    "async function createNewConversation"
  );
  const end = script.indexOf(
    "async function openConversation",
    start
  );
  const createNewConversationSource = script.slice(
    start,
    end
  );

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(
    createNewConversationSource,
    /currentLanguage\s*=/
  );
  assert.match(
    createNewConversationSource,
    /showConversation\(conversation, \[\]\)/
  );
});

test("includes responsive history-sidebar styles", () => {
  assert.match(styles, /\.conversation-sidebar/);
  assert.match(styles, /\.conversation-item\.is-active/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.conversation-sidebar\.is-open/);
});

test("New Chat exposes loading and backend connection feedback", () => {
  assert.match(script, /function setNewChatLoading/);
  assert.match(script, /Starting chat\.\.\./);
  assert.match(script, /Loading saved chats\.\.\./);
  assert.match(
    script,
    /Unable to connect to the HealthBot server/
  );
  assert.match(
    script,
    /Start the backend on port 5000 and try again/
  );
  assert.match(script, /new AbortController\(\)/);
  assert.match(styles, /\.new-chat-status\.error/);
});
