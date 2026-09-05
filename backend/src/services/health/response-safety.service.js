function applyResponseSafety(response) {
  if (!response || typeof response !== "string") {
    return response;
  }

  const lines = response.split("\n");

  const dosePatterns = [
    /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg)\b/i,
    /\b\d+(?:\.\d+)?\s*g\s*(?:\/|per)\s*24\s*h/i,
    /\b\d+(?:\.\d+)?\s*g\s+every\s+\d+/i,
    /\bevery\s+\d+(?:-\d+)?\s*(?:hours?|hrs?|h)\b/i,
    /\b\d+(?:-\d+)?\s*(?:times?|x)\s+(?:a|per)\s+day\b/i
  ];

  let medicationLineRemoved = false;

  const safeLines = lines.filter((line) => {
    const containsDose = dosePatterns.some((pattern) =>
      pattern.test(line)
    );

    if (containsDose) {
      medicationLineRemoved = true;
      return false;
    }

    return true;
  });

  if (medicationLineRemoved) {
    const safeMedicationAdvice =
      "\n- For medicine or pain relief, follow the product label and ask a pharmacist or qualified healthcare professional if you are unsure what is suitable for you.";

    const medicineHeadingIndex = safeLines.findIndex((line) =>
      /medicine|medication/i.test(line)
    );

    if (medicineHeadingIndex !== -1) {
      safeLines.splice(
        medicineHeadingIndex + 1,
        0,
        safeMedicationAdvice
      );
    } else {
      safeLines.push(
        "\n**Medicine:**",
        safeMedicationAdvice
      );
    }
  }

  return safeLines.join("\n").trim();
}

module.exports = {
  applyResponseSafety
};