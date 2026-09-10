const path = require("path");

const englishData = require(
  path.join(__dirname, "../../data/languages/english.json")
);

const twiData = require(
  path.join(__dirname, "../../data/languages/twi.json")
);

const eweData = require(
  path.join(__dirname, "../../data/languages/ewe.json")
);

/**
 * Detect the language of a user's message.
 *
 * Supported languages:
 * - English
 * - Twi
 * - Ewe
 */
function detectLanguage(message) {
  if (!message || typeof message !== "string") {
    return "English";
  }

  const text = message.toLowerCase();

  // Common Twi words and expressions
  const twiWords = [
    "me ho",
    "wo ho",
    "medaase",
    "akwaaba",
    "ɛyɛ",
    "yare",
    "mepa wo kyɛw",
    "maakye",
    "maaha",
    "maadwo",
    "wo din",
    "me din",
    "adɛn",
    "dɛn"
  ];

  // Common Ewe words and expressions
  const eweWords = [
    "wòezɔ",
    "akpe",
    "efɔa",
    "ŋdi",
    "fiẽ",
    "alekee",
    "nye ŋkɔ",
    "dɔ",
    "meɖe kuku",
    "ɖe"
  ];

  const twiScore = twiWords.filter((word) =>
    text.includes(word)
  ).length;

  const eweScore = eweWords.filter((word) =>
    text.includes(word)
  ).length;

  if (twiScore > eweScore && twiScore > 0) {
    return "Twi";
  }

  if (eweScore > twiScore && eweScore > 0) {
    return "Ewe";
  }

  return "English";
}


/**
 * Get the language dataset for a particular language.
 */
function getLanguageData(language) {
  switch (language) {
    case "Twi":
      return twiData;

    case "Ewe":
      return eweData;

    case "English":
    default:
      return englishData;
  }
}


/**
 * Returns the validation status of a language.
 */
function getLanguageValidationStatus(language) {
  const languageData = getLanguageData(language);

  return languageData.validationStatus || "validated";
}


/**
 * Returns health terminology for a language.
 */
function getHealthTerms(language) {
  const languageData = getLanguageData(language);

  return languageData.healthTerms || {};
}


/**
 * Returns greetings for a language.
 */
function getGreetings(language) {
  const languageData = getLanguageData(language);

  return languageData.greetings || {};
}


/**
 * Returns safety phrases for a language.
 */
function getSafetyPhrases(language) {
  const languageData = getLanguageData(language);

  return languageData.safety || {};
}


module.exports = {
  detectLanguage,
  getLanguageData,
  getLanguageValidationStatus,
  getHealthTerms,
  getGreetings,
  getSafetyPhrases
};