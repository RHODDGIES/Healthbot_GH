/**
 * HealthBot GH — frontend chat logic
 *
 * Backend:
 * POST /api/ai/chat
 * POST /api/ai/conversations
 * GET  /api/ai/conversations
 * GET  /api/ai/conversations/:conversationId
 *
 * Firebase Authentication supplies
 * the ID token required by the backend.
 */

import {
  getCurrentUserToken,
  watchAuthState,
  logoutUser
} from "./auth.js";

// --------------------------------------------------
// API
// --------------------------------------------------

const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "";

// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

const chatLog = document.getElementById("chatLog");
const composerForm = document.getElementById("composerForm");
const messageInput = document.getElementById("messageInput");
const statusLine = document.getElementById("statusLine");
const quickChips = document.getElementById("quickChips");
const logoutButton = document.getElementById("logoutButton");
const newChatButton = document.getElementById("newChatButton");
const newChatButtonLabel =
  document.getElementById("newChatButtonLabel");
const newChatStatus = document.getElementById("newChatStatus");
const conversationList = document.getElementById("conversationList");
const conversationSidebar =
  document.getElementById("conversationSidebar");
const historyToggleButton =
  document.getElementById("historyToggleButton");
const sidebarCloseButton =
  document.getElementById("sidebarCloseButton");
const sidebarBackdrop =
  document.getElementById("sidebarBackdrop");
const voiceNoteButton =
  document.getElementById("voiceNoteButton");
const voiceNoteStatus =
  document.getElementById("voiceNoteStatus");
const voiceTranscriptCancelButton =
  document.getElementById("voiceTranscriptCancelButton");
const sendBtn = composerForm.querySelector(".send-btn");

// --------------------------------------------------
// STATE
// --------------------------------------------------

let currentLanguage = "en";
let historyLoaded = false;
let activeConversationId = null;
let activeConversationIsLegacy = false;
let conversations = [];
let isChatBusy = false;
let isConversationBusy = true;
let isVoicePreparing = false;
let isVoiceRecording = false;
let mediaRecorder = null;
let voiceStream = null;
let voiceChunks = [];
let voiceRecordingTimer = null;
let voiceRecordingStartedAt = 0;
let discardVoiceRecording = false;
let voiceRecordingLanguage = "English";
let pendingVoiceConfirmation = null;

const MAX_WEB_VOICE_NOTE_SECONDS = 60;
const MAX_WEB_VOICE_NOTE_BYTES = 4 * 1024 * 1024;
const WEB_VOICE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/webm"
];
const KHAYA_WEB_AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav"
]);
const KHAYA_TARGET_SAMPLE_RATE = 16000;

// --------------------------------------------------
// LANGUAGE
// --------------------------------------------------

const greetings = {
  en:
    "Hello! I'm HealthBot GH. Ask me a general health question in English, Twi or Ewe.",

  tw:
    "Akwaaba! Me ne HealthBot GH. Wubetumi abisa me akwahosan ho asɛm wɔ Borɔfo, Twi anaa Ewe mu.",

  ee:
    "Woezɔ! Nyee nye HealthBot GH. Àte ŋu abia nye lãmesẽ ŋu nya le English, Twi alo Eʋegbe me."
};

const statusText = {
  en: "Ask a health question",
  tw: "Bisa akwahosan ho asɛm",
  ee: "Bia lãmesẽ ŋu nya"
};

const languageNames = {
  en: "English",
  tw: "Twi",
  ee: "Ewe"
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function scrollToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function timeNow() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMessageText(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
  .replace(/\n/g, "<br>");
}

function addMessage(
  text,
  role,
  {
    flagged = false,
    time = null,
    inputType = "text"
  } = {}
) {
  if (!text) {
    return;
  }

  const bubble = document.createElement("div");

  bubble.className =
    `msg ${role}${flagged ? " alert" : ""}`;

  const textNode = document.createElement("div");

  textNode.className = "msg-text";

  if (role === "bot") {
    textNode.innerHTML = formatMessageText(text);
  } else {
    textNode.textContent = text;
  }

  if (role === "user" && inputType === "voice") {
    const voiceLabel = document.createElement("span");

    voiceLabel.className = "voice-message-label";
    voiceLabel.textContent = "Voice note transcription";
    bubble.appendChild(voiceLabel);
  }

  bubble.appendChild(textNode);

  if (role !== "system") {
    const timeElement = document.createElement("span");

    timeElement.className = "msg-time";
    timeElement.textContent = time || timeNow();

    bubble.appendChild(timeElement);
  }

  chatLog.appendChild(bubble);

  scrollToBottom();
}

function addSystemMessage(text) {
  addMessage(text, "system");
}

function showTyping() {
  hideTyping();

  const element = document.createElement("div");

  element.className = "typing";
  element.id = "typingIndicator";

  element.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;

  chatLog.appendChild(element);

  scrollToBottom();
}

function hideTyping() {
  const element =
    document.getElementById("typingIndicator");

  if (element) {
    element.remove();
  }
}

function updateInteractiveState() {
  const hasPendingVoiceConfirmation =
    Boolean(pendingVoiceConfirmation);
  const composerDisabled =
    isChatBusy ||
    isConversationBusy ||
    isVoicePreparing ||
    isVoiceRecording ||
    !activeConversationId ||
    activeConversationIsLegacy;

  sendBtn.disabled = composerDisabled;
  messageInput.disabled = composerDisabled;

  if (newChatButton) {
    newChatButton.disabled =
      isChatBusy ||
      isConversationBusy ||
      isVoicePreparing ||
      isVoiceRecording ||
      hasPendingVoiceConfirmation;
  }

  if (voiceNoteButton) {
    const selectedVoiceLanguage =
      languageNames[currentLanguage] || languageNames.en;

    voiceNoteButton.disabled =
      isChatBusy ||
      isConversationBusy ||
      isVoicePreparing ||
      hasPendingVoiceConfirmation ||
      !activeConversationId ||
      activeConversationIsLegacy;

    voiceNoteButton.classList.toggle(
      "is-recording",
      isVoiceRecording
    );
    voiceNoteButton.setAttribute(
      "aria-pressed",
      String(isVoiceRecording)
    );
    voiceNoteButton.setAttribute(
      "aria-label",
      isVoiceRecording
        ? "Stop and send voice note"
        : `Record a ${selectedVoiceLanguage} voice note`
    );
    voiceNoteButton.title = isVoiceRecording
      ? "Stop and send voice note"
      : `Record a ${selectedVoiceLanguage} voice note`;
  }

  document
    .querySelectorAll(".lang-pill")
    .forEach((pill) => {
      pill.disabled =
        isChatBusy ||
        isConversationBusy ||
        isVoicePreparing ||
        isVoiceRecording ||
        hasPendingVoiceConfirmation;
    });

  document
    .querySelectorAll(".chip")
    .forEach((chip) => {
      chip.disabled =
        composerDisabled || hasPendingVoiceConfirmation;
    });

  renderConversationList();
}

function setNewChatStatus(message = "", type = "") {
  if (!newChatStatus) {
    return;
  }

  newChatStatus.textContent = message;
  newChatStatus.className = "new-chat-status";

  if (type) {
    newChatStatus.classList.add(type);
  }
}

function setVoiceNoteStatus(message = "", type = "") {
  if (!voiceNoteStatus) {
    return;
  }

  voiceNoteStatus.textContent = message;
  voiceNoteStatus.className = "voice-note-status";

  if (type) {
    voiceNoteStatus.classList.add(type);
  }
}

function clearPendingVoiceConfirmation({
  clearInput = true,
  statusMessage = ""
} = {}) {
  pendingVoiceConfirmation = null;

  if (voiceTranscriptCancelButton) {
    voiceTranscriptCancelButton.hidden = true;
  }

  if (clearInput) {
    messageInput.value = "";
  }

  messageInput.placeholder = "Type your question...";
  setVoiceNoteStatus(statusMessage);
  updateInteractiveState();
}

function beginVoiceConfirmation(
  transcription,
  selectedLanguage,
  conversationId
) {
  pendingVoiceConfirmation = {
    language: selectedLanguage,
    conversationId
  };

  messageInput.value = transcription;
  messageInput.placeholder =
    `Correct the ${selectedLanguage} transcription`;

  if (voiceTranscriptCancelButton) {
    voiceTranscriptCancelButton.hidden = false;
  }

  setVoiceNoteStatus(
    `Check and correct the ${selectedLanguage} transcription in the message box, then press Send.`,
    "recording"
  );
  updateInteractiveState();
  messageInput.focus();
  messageInput.select();
}

function setNewChatLoading(isLoading) {
  if (newChatButtonLabel) {
    newChatButtonLabel.textContent = isLoading
      ? "Starting chat..."
      : "New Chat";
  }

  newChatButton?.setAttribute(
    "aria-busy",
    String(isLoading)
  );
}

function setLoading(isLoading) {
  isChatBusy = isLoading;

  updateInteractiveState();

  if (isLoading) {
    showTyping();
  } else {
    hideTyping();

    if (!messageInput.disabled) {
      messageInput.focus();
    }
  }
}

function clearChat() {
  chatLog.innerHTML = "";
}

function formatHistoryTime(createdAt) {
  if (!createdAt) {
    return "";
  }

  let date;

  if (createdAt._seconds !== undefined) {
    date = new Date(
      createdAt._seconds * 1000
    );
  } else if (createdAt.seconds !== undefined) {
    date = new Date(
      createdAt.seconds * 1000
    );
  } else {
    date = new Date(createdAt);
  }

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatConversationDate(createdAt) {
  if (!createdAt) {
    return "";
  }

  let date;

  if (createdAt._seconds !== undefined) {
    date = new Date(createdAt._seconds * 1000);
  } else if (createdAt.seconds !== undefined) {
    date = new Date(createdAt.seconds * 1000);
  } else {
    date = new Date(createdAt);
  }

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}

// --------------------------------------------------
// FIREBASE AUTH TOKEN
// --------------------------------------------------

async function getAuthToken() {
  return await getCurrentUserToken();
}

// --------------------------------------------------
// CONVERSATIONS
// --------------------------------------------------

async function requestApi(
  path,
  {
    method = "GET",
    body,
    rawBody,
    headers = {},
    timeoutMs = 15000
  } = {}
) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      "You need to sign in before using HealthBot."
    );
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers
    }
  };

  if (rawBody !== undefined) {
    options.body = rawBody;
  } else if (body !== undefined) {
    options.headers["Content-Type"] =
      "application/json";
    options.body = JSON.stringify(body);
  }

  const requestController = new AbortController();
  const requestTimeout = setTimeout(
    () => requestController.abort(),
    timeoutMs
  );

  options.signal = requestController.signal;

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      options
    );
  } catch (error) {
    const localBackendMessage = API_BASE_URL
      ? " Start the backend on port 5000 and try again."
      : " Please try again.";

    if (error?.name === "AbortError") {
      throw new Error(
        `The HealthBot server did not respond.${localBackendMessage}`
      );
    }

    throw new Error(
      `Unable to connect to the HealthBot server.${localBackendMessage}`
    );
  } finally {
    clearTimeout(requestTimeout);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "HealthBot received an invalid response from the server."
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    throw new Error(
      data?.error ||
        `HealthBot request failed with status ${response.status}.`
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
        "HealthBot could not process your request."
    );
  }

  return data;
}

function openConversationSidebar() {
  conversationSidebar?.classList.add("is-open");
  sidebarBackdrop?.classList.add("is-visible");
  historyToggleButton?.setAttribute(
    "aria-expanded",
    "true"
  );
}

function closeConversationSidebar() {
  conversationSidebar?.classList.remove("is-open");
  sidebarBackdrop?.classList.remove("is-visible");
  historyToggleButton?.setAttribute(
    "aria-expanded",
    "false"
  );
}

function renderConversationList() {
  if (!conversationList) {
    return;
  }

  conversationList.innerHTML = "";

  if (conversations.length === 0) {
    const status = document.createElement("p");

    status.className = "conversation-list-status";
    status.textContent = isConversationBusy
      ? "Loading chats…"
      : "No saved chats yet.";

    conversationList.appendChild(status);

    return;
  }

  conversations.forEach((conversation) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const date = formatConversationDate(
      conversation.updatedAt || conversation.createdAt
    );

    item.type = "button";
    item.className = "conversation-item";
    item.dataset.conversationId = conversation.id;
    item.disabled =
      isChatBusy ||
      isConversationBusy ||
      isVoicePreparing ||
      isVoiceRecording ||
      Boolean(pendingVoiceConfirmation);

    if (conversation.id === activeConversationId) {
      item.classList.add("is-active");
      item.setAttribute("aria-current", "true");
    }

    title.className = "conversation-item-title";
    title.textContent = conversation.title || "New chat";

    meta.className = "conversation-item-meta";
    meta.textContent = conversation.legacy
      ? `Saved chat${date ? ` · ${date}` : ""}`
      : date || "New chat";

    item.append(title, meta);
    conversationList.appendChild(item);
  });
}

function showConversation(conversation, messages = []) {
  activeConversationId = conversation.id;
  activeConversationIsLegacy = Boolean(
    conversation.legacy
  );

  clearChat();

  if (!messages.length) {
    addMessage(
      greetings[currentLanguage],
      "bot"
    );
  } else {
    messages.forEach((message) => {
      if (
        !message?.content ||
        !["user", "assistant"].includes(message.role)
      ) {
        return;
      }

      addMessage(
        message.content,
        message.role === "assistant" ? "bot" : "user",
        {
          time: formatHistoryTime(message.createdAt),
          inputType: message.inputType || "text"
        }
      );
    });
  }

  if (activeConversationIsLegacy) {
    addSystemMessage(
      "This saved conversation is read-only. Start a new chat to continue."
    );
  }

  updateInteractiveState();
  closeConversationSidebar();
}

async function createNewConversation() {
  if (
    isChatBusy ||
    isConversationBusy ||
    isVoicePreparing ||
    isVoiceRecording ||
    pendingVoiceConfirmation
  ) {
    return false;
  }

  isConversationBusy = true;
  setNewChatLoading(true);
  setNewChatStatus("Creating a separate conversation...");
  updateInteractiveState();

  try {
    const data = await requestApi(
      "/api/ai/conversations",
      {
        method: "POST"
      }
    );

    if (!data.conversation?.id) {
      throw new Error(
        "HealthBot did not return a conversation ID."
      );
    }

    const conversation = {
      ...data.conversation,
      legacy: false
    };

    conversations = [
      conversation,
      ...conversations.filter(
        (item) => item.id !== conversation.id
      )
    ];

    setNewChatStatus();
    showConversation(conversation, []);

    return true;
  } catch (error) {
    console.error("New conversation error:", error);

    addSystemMessage(
      error.message ||
        "Unable to start a new conversation."
    );

    setNewChatStatus(
      error.message ||
        "Unable to start a new conversation.",
      "error"
    );

    return false;
  } finally {
    isConversationBusy = false;
    setNewChatLoading(false);
    updateInteractiveState();
  }
}

async function openConversation(conversationId) {
  if (
    !conversationId ||
    isChatBusy ||
    isConversationBusy ||
    isVoicePreparing ||
    isVoiceRecording ||
    pendingVoiceConfirmation
  ) {
    return;
  }

  if (conversationId === activeConversationId) {
    closeConversationSidebar();

    return;
  }

  isConversationBusy = true;
  updateInteractiveState();

  try {
    const data = await requestApi(
      `/api/ai/conversations/${encodeURIComponent(
        conversationId
      )}`
    );

    showConversation(
      data.conversation,
      data.messages || []
    );
  } catch (error) {
    console.error("Open conversation error:", error);

    addSystemMessage(
      error.message ||
        "Unable to open that conversation."
    );
  } finally {
    isConversationBusy = false;
    updateInteractiveState();
  }
}

function recordConversationActivity(message) {
  if (!activeConversationId || activeConversationIsLegacy) {
    return;
  }

  const index = conversations.findIndex(
    (conversation) =>
      conversation.id === activeConversationId
  );

  if (index === -1) {
    return;
  }

  const current = conversations[index];
  const normalizedMessage = message
    .replace(/\s+/g, " ")
    .trim();

  const title = normalizedMessage.length > 60
    ? `${normalizedMessage.substring(0, 57)}...`
    : normalizedMessage;

  const updatedConversation = {
    ...current,
    title:
      !current.title || current.title === "New chat"
        ? title
        : current.title,
    messageCount: (current.messageCount || 0) + 2,
    updatedAt: new Date().toISOString()
  };

  conversations = [
    updatedConversation,
    ...conversations.filter(
      (conversation) =>
        conversation.id !== activeConversationId
    )
  ];

  renderConversationList();
}

async function loadConversationHistory() {
  if (historyLoaded) {
    return;
  }

  isConversationBusy = true;
  setNewChatStatus("Loading saved chats...");
  updateInteractiveState();

  let needsNewConversation = false;
  let historyLoadFailed = false;

  try {
    const data = await requestApi(
      "/api/ai/conversations"
    );

    conversations = Array.isArray(data.conversations)
      ? data.conversations
      : [];

    renderConversationList();

    const latestWritableConversation =
      conversations.find(
        (conversation) => !conversation.legacy
      );

    if (latestWritableConversation) {
      const details = await requestApi(
        `/api/ai/conversations/${encodeURIComponent(
          latestWritableConversation.id
        )}`
      );

      showConversation(
        details.conversation,
        details.messages || []
      );
    } else {
      clearChat();
      addMessage(greetings[currentLanguage], "bot");
      needsNewConversation = true;
    }

    setNewChatStatus();
  } catch (error) {
    historyLoadFailed = true;

    console.error(
      "Conversation history error:",
      error
    );

    clearChat();
    addMessage(greetings[currentLanguage], "bot");
    addSystemMessage(
      "Previous conversations could not be loaded."
    );

    setNewChatStatus(
      error.message ||
        "Previous conversations could not be loaded.",
      "error"
    );
  } finally {
    historyLoaded = true;
    isConversationBusy = false;
    updateInteractiveState();
  }

  if (needsNewConversation) {
    await createNewConversation();
  }

  return !historyLoadFailed;
}

// --------------------------------------------------
// SEND MESSAGE TO BACKEND
// --------------------------------------------------

async function getReply(
  message,
  {
    language = null,
    inputType = "text"
  } = {}
) {
  if (!activeConversationId) {
    throw new Error(
      "Start a new chat before sending a message."
    );
  }

  if (activeConversationIsLegacy) {
    throw new Error(
      "This saved conversation is read-only. Start a new chat to continue."
    );
  }

  const data = await requestApi(
    "/api/ai/chat",
    {
      method: "POST",
      body: {
        message,
        conversationId: activeConversationId,
        language: language ||
          languageNames[currentLanguage] ||
          languageNames.en,
        inputType
      }
    }
  );

  if (!data.response) {
    throw new Error(
      "HealthBot did not return a response."
    );
  }

  return {
    text: data.response,
    conversationId:
      data.conversationId || null,
    flagged: false
  };
}

// --------------------------------------------------
// USER MESSAGE
// --------------------------------------------------

async function handleUserMessage(
  text,
  {
    language = null,
    inputType = "text"
  } = {}
) {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  if (!activeConversationId || activeConversationIsLegacy) {
    addSystemMessage(
      activeConversationIsLegacy
        ? "This saved conversation is read-only. Start a new chat to continue."
        : "Start a new chat before sending a message."
    );

    return false;
  }

  addMessage(
    trimmed,
    "user",
    {
      inputType
    }
  );

  messageInput.value = "";

  setLoading(true);

  try {
    const result =
      await getReply(trimmed, {
        language,
        inputType
      });

    addMessage(
      result.text,
      "bot",
      {
        flagged:
          result.flagged
      }
    );

    recordConversationActivity(trimmed);

    return true;

  } catch (error) {
    console.error(
      "HealthBot frontend error:",
      error
    );

    addSystemMessage(
      error.message ||
        "HealthBot is temporarily unavailable. Please try again shortly."
    );

    return false;

  } finally {
    setLoading(false);
  }
}

async function sendConfirmedVoiceTranscription() {
  if (!pendingVoiceConfirmation) {
    return false;
  }

  const transcription = messageInput.value.trim();

  if (!transcription) {
    setVoiceNoteStatus(
      "Correct the transcription or cancel the voice note.",
      "error"
    );

    return false;
  }

  const confirmation = pendingVoiceConfirmation;

  if (confirmation.conversationId !== activeConversationId) {
    clearPendingVoiceConfirmation({
      statusMessage:
        "That conversation changed. Please record the voice note again."
    });

    return false;
  }

  clearPendingVoiceConfirmation({
    clearInput: false,
    statusMessage:
      `Sending the corrected ${confirmation.language} transcription...`
  });

  const sent = await handleUserMessage(
    transcription,
    {
      language: confirmation.language,
      inputType: "voice"
    }
  );

  setVoiceNoteStatus(
    sent
      ? `${confirmation.language} voice note sent.`
      : "The voice note was not sent. Please try again.",
    sent ? "" : "error"
  );

  return sent;
}

// --------------------------------------------------
// WEB VOICE NOTES
// --------------------------------------------------

function normalizeAudioMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== "string") {
    return "";
  }

  return mimeType
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function mixAudioBufferToMono(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const monoSamples = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const channelSamples = audioBuffer.getChannelData(channel);

    for (let index = 0; index < channelSamples.length; index += 1) {
      monoSamples[index] += channelSamples[index] / channelCount;
    }
  }

  return monoSamples;
}

function resampleMonoAudio(samples, sourceRate, targetRate) {
  if (sourceRate === targetRate) {
    return samples.slice();
  }

  const outputLength = Math.max(
    1,
    Math.round(samples.length * targetRate / sourceRate)
  );
  const output = new Float32Array(outputLength);
  const sourceStep = sourceRate / targetRate;

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * sourceStep;
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(
      leftIndex + 1,
      samples.length - 1
    );
    const fraction = sourcePosition - leftIndex;

    output[index] =
      samples[leftIndex] * (1 - fraction) +
      samples[rightIndex] * fraction;
  }

  return output;
}

function writeWavText(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function createPcmWavBlob(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  writeWavText(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeWavText(view, 8, "WAVE");
  writeWavText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeWavText(view, 36, "data");
  view.setUint32(40, dataLength, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    const pcmValue = sample < 0
      ? sample * 0x8000
      : sample * 0x7fff;

    view.setInt16(44 + index * bytesPerSample, pcmValue, true);
  }

  return new Blob([wavBuffer], {
    type: "audio/wav"
  });
}

async function convertVoiceBlobToWav(audioBlob) {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error(
      "This browser cannot prepare Twi or Ewe voice notes. Try a current version of Chrome, Edge, Firefox or Safari."
    );
  }

  const audioContext = new AudioContextClass();

  try {
    const encodedAudio = await audioBlob.arrayBuffer();
    const decodedAudio = await audioContext.decodeAudioData(
      encodedAudio.slice(0)
    );
    const monoSamples = mixAudioBufferToMono(decodedAudio);
    const resampledSamples = resampleMonoAudio(
      monoSamples,
      decodedAudio.sampleRate,
      KHAYA_TARGET_SAMPLE_RATE
    );

    return createPcmWavBlob(
      resampledSamples,
      KHAYA_TARGET_SAMPLE_RATE
    );
  } catch (error) {
    console.error("Voice audio conversion error:", error);

    throw new Error(
      "HealthBot could not prepare this voice note for transcription. Please record it again."
    );
  } finally {
    if (typeof audioContext.close === "function") {
      await audioContext.close().catch(() => {});
    }
  }
}

async function prepareVoiceNoteAudio(audioBlob, selectedLanguage) {
  if (selectedLanguage === "English") {
    return audioBlob;
  }

  const mimeType = normalizeAudioMimeType(audioBlob.type);

  if (KHAYA_WEB_AUDIO_TYPES.has(mimeType)) {
    return audioBlob;
  }

  setVoiceNoteStatus(
    `Preparing your ${selectedLanguage} voice note...`
  );

  return convertVoiceBlobToWav(audioBlob);
}

function getSupportedVoiceMimeType() {
  if (
    !window.MediaRecorder ||
    typeof window.MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }

  return WEB_VOICE_MIME_TYPES.find((mimeType) =>
    window.MediaRecorder.isTypeSupported(mimeType)
  ) || "";
}

function stopVoiceStream() {
  if (!voiceStream) {
    return;
  }

  voiceStream.getTracks().forEach((track) => {
    track.stop();
  });

  voiceStream = null;
}

function clearVoiceRecordingTimer() {
  if (voiceRecordingTimer) {
    clearInterval(voiceRecordingTimer);
    voiceRecordingTimer = null;
  }
}

function formatRecordingDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function updateVoiceRecordingStatus() {
  if (!isVoiceRecording) {
    return;
  }

  const elapsedSeconds = Math.min(
    MAX_WEB_VOICE_NOTE_SECONDS,
    Math.floor((Date.now() - voiceRecordingStartedAt) / 1000)
  );

  setVoiceNoteStatus(
    `Recording in ${voiceRecordingLanguage} ${formatRecordingDuration(elapsedSeconds)} - tap the microphone to send.`,
    "recording"
  );

  if (elapsedSeconds >= MAX_WEB_VOICE_NOTE_SECONDS) {
    stopVoiceRecording();
  }
}

async function sendWebVoiceNote(audioBlob, selectedLanguage) {
  if (!audioBlob.size) {
    addSystemMessage(
      "No audio was recorded. Please try the voice note again."
    );
    setVoiceNoteStatus("No audio was recorded.", "error");

    return;
  }

  if (audioBlob.size > MAX_WEB_VOICE_NOTE_BYTES) {
    addSystemMessage(
      "That voice note is too large. Please record a shorter message."
    );
    setVoiceNoteStatus("Voice note is too large.", "error");

    return;
  }

  const conversationId = activeConversationId;

  setVoiceNoteStatus(
    selectedLanguage === "English"
      ? "Transcribing your English voice note and preparing a reply..."
      : `Preparing your ${selectedLanguage} voice note...`
  );
  setLoading(true);

  try {
    const uploadBlob = await prepareVoiceNoteAudio(
      audioBlob,
      selectedLanguage
    );

    if (uploadBlob.size > MAX_WEB_VOICE_NOTE_BYTES) {
      throw new Error(
        "That voice note is too large. Please record a shorter message."
      );
    }

    if (selectedLanguage !== "English") {
      setVoiceNoteStatus(
        `Transcribing your ${selectedLanguage} voice note...`
      );
    }

    const data = await requestApi(
      "/api/ai/voice",
      {
        method: "POST",
        rawBody: uploadBlob,
        headers: {
          "Content-Type": uploadBlob.type || "audio/webm",
          "X-Conversation-Id": conversationId,
          "X-HealthBot-Language": selectedLanguage
        },
        timeoutMs: 60000
      }
    );

    if (!data.transcription) {
      throw new Error(
        "HealthBot could not transcribe that voice note."
      );
    }

    if (data.requiresConfirmation) {
      beginVoiceConfirmation(
        data.transcription,
        data.language || selectedLanguage,
        data.conversationId || conversationId
      );

      return;
    }

    if (!data.response) {
      throw new Error(
        "HealthBot did not return a response."
      );
    }

    addMessage(
      data.transcription,
      "user",
      {
        inputType: "voice"
      }
    );

    addMessage(data.response, "bot");
    recordConversationActivity(data.transcription);
    const successMessage = "Voice note sent.";

    setVoiceNoteStatus(successMessage);

    setTimeout(() => {
      if (voiceNoteStatus?.textContent === successMessage) {
        setVoiceNoteStatus();
      }
    }, 4000);
  } catch (error) {
    console.error("Web voice note error:", error);

    addSystemMessage(
      error.message ||
        "Unable to process the voice note. Please try again."
    );
    setVoiceNoteStatus(
      error.message || "Unable to process the voice note.",
      "error"
    );
  } finally {
    setLoading(false);
  }
}

async function finishVoiceRecording(recorder) {
  const shouldDiscard = discardVoiceRecording;
  const selectedLanguage = voiceRecordingLanguage;
  const recordedMimeType =
    recorder.mimeType || voiceChunks[0]?.type || "audio/webm";
  const audioBlob = new Blob(voiceChunks, {
    type: recordedMimeType
  });

  clearVoiceRecordingTimer();
  stopVoiceStream();

  mediaRecorder = null;
  voiceChunks = [];
  voiceRecordingStartedAt = 0;
  discardVoiceRecording = false;
  isVoiceRecording = false;
  updateInteractiveState();

  if (shouldDiscard) {
    setVoiceNoteStatus("Recording cancelled.");

    return;
  }

  await sendWebVoiceNote(audioBlob, selectedLanguage);
}

function stopVoiceRecording(discard = false) {
  if (!mediaRecorder || !isVoiceRecording) {
    return;
  }

  discardVoiceRecording = discardVoiceRecording || discard;
  setVoiceNoteStatus(
    discardVoiceRecording
      ? "Cancelling recording..."
      : "Preparing voice note..."
  );

  if (mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

async function startVoiceRecording() {
  if (!activeConversationId || activeConversationIsLegacy) {
    addSystemMessage(
      activeConversationIsLegacy
        ? "This saved conversation is read-only. Start a new chat to record a voice note."
        : "Start a new chat before recording a voice note."
    );

    return;
  }

  if (
    !navigator.mediaDevices?.getUserMedia ||
    !window.MediaRecorder
  ) {
    addSystemMessage(
      "Voice recording is not supported by this browser. Try a current version of Chrome, Edge, Firefox or Safari."
    );
    setVoiceNoteStatus(
      "Voice recording is not supported by this browser.",
      "error"
    );

    return;
  }

  voiceRecordingLanguage =
    languageNames[currentLanguage] || languageNames.en;
  isVoicePreparing = true;
  setVoiceNoteStatus(
    `Waiting for microphone permission for ${voiceRecordingLanguage}...`
  );
  updateInteractiveState();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    voiceStream = stream;

    const mimeType = getSupportedVoiceMimeType();
    const recorderOptions = {
      audioBitsPerSecond: 64000
    };

    if (mimeType) {
      recorderOptions.mimeType = mimeType;
    }

    const recorder = new window.MediaRecorder(
      stream,
      recorderOptions
    );

    mediaRecorder = recorder;
    voiceChunks = [];
    discardVoiceRecording = false;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) {
        voiceChunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      finishVoiceRecording(recorder);
    }, { once: true });

    recorder.addEventListener("error", (event) => {
      discardVoiceRecording = true;
      console.error("MediaRecorder error:", event.error);
      addSystemMessage(
        "The browser could not finish recording. Please try again."
      );

      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    });

    recorder.start(250);
    voiceRecordingStartedAt = Date.now();
    isVoiceRecording = true;
    updateVoiceRecordingStatus();

    voiceRecordingTimer = setInterval(
      updateVoiceRecordingStatus,
      1000
    );
  } catch (error) {
    console.error("Microphone access error:", error);
    stopVoiceStream();

    const message = error?.name === "NotAllowedError"
      ? "Microphone access was blocked. Allow microphone access for HealthBot in your browser settings and try again."
      : "HealthBot could not start the microphone. Please try again.";

    addSystemMessage(message);
    setVoiceNoteStatus(message, "error");
  } finally {
    isVoicePreparing = false;
    updateInteractiveState();
  }
}

// --------------------------------------------------
// MESSAGE FORM
// --------------------------------------------------

composerForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    if (pendingVoiceConfirmation) {
      sendConfirmedVoiceTranscription();
    } else {
      handleUserMessage(
        messageInput.value
      );
    }
  }
);

voiceNoteButton?.addEventListener("click", () => {
  if (isVoiceRecording) {
    stopVoiceRecording();
  } else {
    startVoiceRecording();
  }
});

voiceTranscriptCancelButton?.addEventListener("click", () => {
  clearPendingVoiceConfirmation({
    statusMessage: "Voice transcription cancelled."
  });
});

// --------------------------------------------------
// QUICK TOPICS
// --------------------------------------------------

if (quickChips) {
  quickChips.addEventListener(
    "click",
    (event) => {
      const chip =
        event.target.closest(".chip");

      if (!chip) {
        return;
      }

      const topic =
        chip.dataset.topic;

      if (!topic) {
        return;
      }

      let message = topic;

      if (
        currentLanguage === "tw"
      ) {
        const twiTopics = {
          malaria:
            "Malaria ho nsɛm",
          typhoid:
            "Typhoid ho nsɛm",
          cholera:
            "Cholera ho nsɛm"
        };

        message =
          twiTopics[topic] ||
          topic;
      }

      if (
        currentLanguage === "ee"
      ) {
        const eweTopics = {
          malaria:
            "Malaria ŋu nya",
          typhoid:
            "Typhoid ŋu nya",
          cholera:
            "Cholera ŋu nya"
        };

        message =
          eweTopics[topic] ||
          topic;
      }

      handleUserMessage(
        message
      );
    }
  );
}

// --------------------------------------------------
// NEW CHAT + CHAT HISTORY
// --------------------------------------------------

if (newChatButton) {
  newChatButton.addEventListener(
    "click",
    async () => {
      await createNewConversation();
    }
  );
}

if (conversationList) {
  conversationList.addEventListener(
    "click",
    (event) => {
      const item = event.target.closest(
        ".conversation-item"
      );

      if (!item || item.disabled) {
        return;
      }

      openConversation(
        item.dataset.conversationId
      );
    }
  );
}

historyToggleButton?.addEventListener(
  "click",
  openConversationSidebar
);

sidebarCloseButton?.addEventListener(
  "click",
  closeConversationSidebar
);

sidebarBackdrop?.addEventListener(
  "click",
  closeConversationSidebar
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (isVoiceRecording) {
      stopVoiceRecording(true);
    } else if (pendingVoiceConfirmation) {
      clearPendingVoiceConfirmation({
        statusMessage: "Voice transcription cancelled."
      });
    }

    closeConversationSidebar();
  }
});

window.addEventListener("beforeunload", () => {
  clearVoiceRecordingTimer();
  stopVoiceStream();
});

// --------------------------------------------------
// LANGUAGE SELECTION
// --------------------------------------------------

document
  .querySelectorAll(".lang-pill")
  .forEach((pill) => {
    pill.addEventListener(
      "click",
      () => {
        document
          .querySelectorAll(".lang-pill")
          .forEach((item) => {
            item.classList.remove(
              "is-active"
            );
          });

        pill.classList.add(
          "is-active"
        );

        currentLanguage =
          pill.dataset.lang;

        statusLine.textContent =
          statusText[
            currentLanguage
          ] ||
          statusText.en;

        let message;

        if (
          currentLanguage === "tw"
        ) {
          message =
            "Wɔasesa kasa no akɔ Twi.";
        } else if (
          currentLanguage === "ee"
        ) {
          message =
            "Wotrɔ gbe la yi Eʋegbe.";
        } else {
          message =
            "Language set to English.";
        }

        addSystemMessage(
          message
        );

        console.log(
          `HealthBot language preference: ${
            languageNames[
              currentLanguage
            ]
          }`
        );
      }
    );
  });

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

if (logoutButton) {
  logoutButton.addEventListener(
    "click",
    async () => {
      try {
        if (isVoiceRecording) {
          stopVoiceRecording(true);
        }

        logoutButton.disabled =
          true;

        logoutButton.textContent =
          "Signing out...";

        await logoutUser();

        window.location.href =
          "login.html";

      } catch (error) {
        console.error(
          "Logout error:",
          error
        );

        logoutButton.disabled =
          false;

        logoutButton.textContent =
          "Sign out";

        addSystemMessage(
          "Unable to sign out. Please try again."
        );
      }
    }
  );
}

// --------------------------------------------------
// PROTECT CHAT + LOAD HISTORY
// --------------------------------------------------

watchAuthState(
  async (user) => {
    if (!user) {
      window.location.href =
        "login.html";

      return;
    }

    console.log(
      "HealthBot user authenticated."
    );

    await loadConversationHistory();
  }
);

// --------------------------------------------------
// INITIAL STATE
// --------------------------------------------------

statusLine.textContent =
  statusText.en;

updateInteractiveState();
