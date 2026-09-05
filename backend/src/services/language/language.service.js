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

module.exports = {
  detectLanguage
};