/**
 * HealthBot GH — frontend chat logic
 *
 * Backend:
 * POST /api/ai/chat
 *
 * Firebase Authentication is used to obtain
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
// LANGUAGE
// --------------------------------------------------

let currentLanguage = "en";

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

function addMessage(text, role, { flagged = false } = {}) {
  if (!text) {
    return;
  }

  const bubble = document.createElement("div");

  bubble.className = `msg ${role}${flagged ? " alert" : ""}`;

  const textNode = document.createElement("span");

  textNode.className = "msg-text";
  textNode.textContent = text;

  bubble.appendChild(textNode);

  if (role !== "system") {
    const time = document.createElement("span");

    time.className = "msg-time";
    time.textContent = timeNow();

    bubble.appendChild(time);
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
  const element = document.getElementById("typingIndicator");

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

// --------------------------------------------------
// FIREBASE AUTH TOKEN
// --------------------------------------------------

async function getAuthToken() {
  return await getCurrentUserToken();
}

// --------------------------------------------------
// BACKEND REQUEST
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
    conversationId: data.conversationId || null,
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

  addMessage(trimmed, "user");

  messageInput.value = "";

  setLoading(true);

  try {
    const result = await getReply(trimmed);

    addMessage(
      result.text,
      "bot",
      {
        flagged: result.flagged
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

      const topic = chip.dataset.topic;

      if (!topic) {
        return;
      }

      let message = topic;

      if (currentLanguage === "tw") {
        const twiTopics = {
          malaria: "Malaria ho nsɛm",
          typhoid: "Typhoid ho nsɛm",
          cholera: "Cholera ho nsɛm"
        };

        message =
          twiTopics[topic] || topic;
      }

      if (currentLanguage === "ee") {
        const eweTopics = {
          malaria: "Malaria ŋu nya",
          typhoid: "Typhoid ŋu nya",
          cholera: "Cholera ŋu nya"
        };

        message =
          eweTopics[topic] || topic;
      }

      handleUserMessage(message);
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
          statusText[currentLanguage] ||
          statusText.en;

        let message;

        if (currentLanguage === "tw") {
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

        addSystemMessage(message);

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
        logoutButton.disabled = true;

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

        logoutButton.disabled = false;

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
// PROTECT CHAT PAGE
// --------------------------------------------------

watchAuthState((user) => {
  if (!user) {
    window.location.href =
      "login.html";

    return;
  }

  console.log(
    "HealthBot user authenticated."
  );
});

// --------------------------------------------------
// INITIAL STATE
// --------------------------------------------------

statusLine.textContent =
  statusText.en;

addMessage(
  greetings.en,
  "bot"
);

messageInput.focus();