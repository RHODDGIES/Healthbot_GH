/**
 * HealthBot GH — frontend chat logic
 *
 * Backend:
 * POST /api/ai/chat
 * GET  /api/ai/history
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
const sendBtn = composerForm.querySelector(".send-btn");

// --------------------------------------------------
// STATE
// --------------------------------------------------

let currentLanguage = "en";
let historyLoaded = false;

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
    time = null
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

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  messageInput.disabled = isLoading;

  if (isLoading) {
    showTyping();
  } else {
    hideTyping();
    messageInput.focus();
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

// --------------------------------------------------
// FIREBASE AUTH TOKEN
// --------------------------------------------------

async function getAuthToken() {
  return await getCurrentUserToken();
}

// --------------------------------------------------
// LOAD CONVERSATION HISTORY
// --------------------------------------------------

async function loadConversationHistory() {
  if (historyLoaded) {
    return;
  }

  const token = await getAuthToken();

  if (!token) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/ai/history`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to load conversation history."
      );
    }

    const conversations =
      data.conversations || [];

    clearChat();

    if (conversations.length === 0) {
      addMessage(
        greetings[currentLanguage],
        "bot"
      );

      historyLoaded = true;

      return;
    }

    conversations
      .sort((a, b) => {
        const aTime =
          a.createdAt?._seconds ??
          a.createdAt?.seconds ??
          0;

        const bTime =
          b.createdAt?._seconds ??
          b.createdAt?.seconds ??
          0;

        return aTime - bTime;
      })
      .forEach((conversation) => {
        const historyTime =
          formatHistoryTime(
            conversation.createdAt
          );

        addMessage(
          conversation.userMessage,
          "user",
          {
            time: historyTime
          }
        );

        addMessage(
          conversation.botResponse,
          "bot",
          {
            time: historyTime
          }
        );
      });

    historyLoaded = true;

  } catch (error) {
    console.error(
      "Conversation history error:",
      error
    );

    clearChat();

    addMessage(
      greetings[currentLanguage],
      "bot"
    );

    addSystemMessage(
      "Previous conversations could not be loaded."
    );

    historyLoaded = true;
  }
}

// --------------------------------------------------
// SEND MESSAGE TO BACKEND
// --------------------------------------------------

async function getReply(message) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      "You need to sign in before using HealthBot."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/ai/chat`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },

      body: JSON.stringify({
        message
      })
    }
  );

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

  if (!data.success) {
    throw new Error(
      data.error ||
        "HealthBot could not process your request."
    );
  }

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

async function handleUserMessage(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return;
  }

  addMessage(
    trimmed,
    "user"
  );

  messageInput.value = "";

  setLoading(true);

  try {
    const result =
      await getReply(trimmed);

    addMessage(
      result.text,
      "bot",
      {
        flagged:
          result.flagged
      }
    );

  } catch (error) {
    console.error(
      "HealthBot frontend error:",
      error
    );

    addSystemMessage(
      error.message ||
        "HealthBot is temporarily unavailable. Please try again shortly."
    );

  } finally {
    setLoading(false);
  }
}

// --------------------------------------------------
// MESSAGE FORM
// --------------------------------------------------

composerForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    handleUserMessage(
      messageInput.value
    );
  }
);

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

messageInput.focus();