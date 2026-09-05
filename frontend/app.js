/**
 * HealthBot GH — frontend chat logic.
 *
 * Expects a backend endpoint:
 *   POST /api/chat
 *   body: { message: string, language: "en" | "tw" | "ee" }
 *   response: { reply: string, flagged?: boolean }
 *
 * "flagged" is optional — the backend can set it true when a reply
 * covers an urgent symptom, so the UI can style it differently.
 *
 * Until that route exists on the backend, this file falls back to a
 * small local knowledge snippet so the interface is demoable on its own.
 */

const API_BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : ""; // same-origin in production; update if the API is hosted elsewhere

const chatLog = document.getElementById("chatLog");
const composerForm = document.getElementById("composerForm");
const messageInput = document.getElementById("messageInput");
const statusLine = document.getElementById("statusLine");
const quickChips = document.getElementById("quickChips");
const sendBtn = composerForm.querySelector(".send-btn");

let currentLanguage = "en";

const greetings = {
  en: "Hello! I'm HealthBot GH. Ask me about malaria, typhoid, or cholera — symptoms, prevention, or when to see a health worker.",
  tw: "Akwaaba! Me ne HealthBot GH. Bisa me malaria, typhoid, anaa cholera ho asɛm — nsɛnkyerɛnne, ɔkwan a wobɛfa so akwae, anaa berɛ a ɛsɛ sɛ wohu ɔdɔkota.",
  ee: "Woezor! Nyee nye HealthBot GH. Bia nye nu tso malaria, typhoid alo cholera ŋu — dɔléleawo ƒe dzesiwo, ale si nàkpɔ ta le eŋu, alo ɣeyiɣi si nàyi dɔdɔkpɔla gbɔ."
};

const statusText = {
  en: "Ask about malaria, typhoid or cholera",
  tw: "Bisa malaria, typhoid anaa cholera ho asɛm",
  ee: "Bia nu tso malaria, typhoid alo cholera ŋu"
};

// Small local fallback so the UI works before /api/chat exists on the backend.
const fallbackAnswers = {
  malaria: {
    en: "Malaria spreads through mosquito bites. Common signs: fever, chills, headache, and body aches. Sleep under a treated net, clear standing water nearby, and see a health worker quickly if fever doesn't ease in a day.",
    tw: "Malaria fi ntontom ano ka mu. Nsɛnkyerɛnne: atiridii, awɔw, tipae, ne nipadua mu yaw. Da ntamaa a wɔasra ano, yi nsu a ɛgyina hɔ, na sɛ atiridii no ankɔ da koro a, kɔ ɔdɔkota nkyɛn ntɛm.",
    ee: "Malaria doa go tso togbato ƒe ɖuɖu me. Dzesiwo: dzoxɔxɔ, vuvɔ, taɖuame kple ŋutilã veve. Dɔ le nyɔ te si wode aɖe ɖe eme, ɖe tsi si le tsitre ɖo ɖa, eye ne dzoxɔxɔ la mele nu tem le ŋkeke ɖeka me o la, yi dɔdɔkpɔla gbɔ enumake."
  },
  typhoid: {
    en: "Typhoid comes from contaminated food or water. Signs: prolonged fever, stomach pain, weakness. Drink boiled or treated water, wash hands before eating, and seek treatment if fever lasts more than 3 days.",
    tw: "Typhoid fi nnuane anaa nsu a ɛho ntew mu. Nsɛnkyerɛnne: atiridii a ɛkyɛ, yafunu mu yaw, mmerɛwyɛ. Nom nsu a wɔanoa anaa wɔasra ho, hohoro wo nsa ansa na woredidi, na sɛ atiridii no tra nnansa a, kɔpɛ ayaresa.",
    ee: "Typhoid vaa tso nuɖuɖu alo tsi si me makɔmakɔ le. Dzesiwo: dzoxɔxɔ si le eme didim, dɔmedzewo kple gbɔdzɔgbɔdzɔ. No tsi si woɖa alo wode aɖe ɖe eme, klɔ asi hafi aɖu nu, eye ne dzoxɔxɔ la nɔ eme ŋkeke etɔ̃ wu la, di dɔyɔyɔ."
  },
  cholera: {
    en: "Cholera spreads through unsafe water and poor sanitation. Signs: sudden watery diarrhea and vomiting. Rehydrate with oral rehydration salts and get to a clinic fast — cholera can dehydrate the body quickly.",
    tw: "Cholera fi nsu a ɛho ntew ne nsɛnkyerɛnne pa a nni hɔ mu. Nsɛnkyerɛnne: yafunu mu ntɔntɔ a ɛba prɛko pɛ ne fe. Nom oral rehydration salts na kɔ ayaresabea ntɛm — cholera betumi ama nsu a ɛwɔ nipadua mu asa ntɛm.",
    ee: "Cholera doa go tso tsi makɔmakɔ kple dedienɔnɔ manyomanyo me. Dzesiwo: dɔmeɖuɖu si va kpata kple dzudzɔ. No oral rehydration salts eye nàyi dɔyɔƒe kaba — cholera te ŋu ɖea tsi le ŋutilã me kabakaba."
  },
  default: {
    en: "I can share guidance on malaria, typhoid, and cholera. Try tapping one of the topics above, or ask me a specific question.",
    tw: "Metumi aka malaria, typhoid, ne cholera ho asɛm akyerɛ wo. Sɔ nsɛntitiriw a ɛwɔ soro no bi hwɛ, anaasɛ bisa me asɛm pɔtee bi.",
    ee: "Mate ŋu agblɔ nya tso malaria, typhoid, kple cholera ŋu na wò. Te nyawo dometɔ ɖeka le tame kpɔ, alo bia nya tɔxɛ aɖe."
  }
};

function scrollToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMessage(text, role, { flagged = false } = {}) {
  const bubble = document.createElement("div");
  bubble.className = `msg ${role}${flagged ? " alert" : ""}`;
  bubble.textContent = text;

  if (role !== "system") {
    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = timeNow();
    bubble.appendChild(time);
  }

  chatLog.appendChild(bubble);
  scrollToBottom();
}

function showTyping() {
  const el = document.createElement("div");
  el.className = "typing";
  el.id = "typingIndicator";
  el.innerHTML = "<span></span><span></span><span></span>";
  chatLog.appendChild(el);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

async function getReply(message) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, language: currentLanguage })
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    return { text: data.reply, flagged: Boolean(data.flagged) };
  } catch (err) {
    // Backend endpoint isn't live yet or is unreachable — fall back locally.
    const lower = message.toLowerCase();
    const topic = ["malaria", "typhoid", "cholera"].find(t => lower.includes(t));
    const bank = topic ? fallbackAnswers[topic] : fallbackAnswers.default;
    return { text: bank[currentLanguage] || bank.en, flagged: false };
  }
}

async function handleUserMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  addMessage(trimmed, "user");
  messageInput.value = "";
  sendBtn.disabled = true;
  showTyping();

  const { text: reply, flagged } = await getReply(trimmed);

  hideTyping();
  addMessage(reply, "bot", { flagged });
  sendBtn.disabled = false;
  messageInput.focus();
}

composerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleUserMessage(messageInput.value);
});

quickChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  handleUserMessage(chip.dataset.topic);
});

document.querySelectorAll(".lang-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".lang-pill").forEach(p => p.classList.remove("is-active"));
    pill.classList.add("is-active");
    currentLanguage = pill.dataset.lang;
    statusLine.textContent = statusText[currentLanguage];
    addMessage(
      currentLanguage === "en" ? "Language set to English."
        : currentLanguage === "tw" ? "Wɔasesa kasa no akɔ Twi."
        : "Wotrɔ gbe la yi Eʋegbe.",
      "system"
    );
  });
});

// Initial greeting
addMessage(greetings.en, "bot");
