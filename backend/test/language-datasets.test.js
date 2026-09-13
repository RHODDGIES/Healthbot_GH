const assert = require("node:assert/strict");
const { test } = require("node:test");

const english = require("../src/data/languages/english.json");
const twi = require("../src/data/languages/twi.json");
const ewe = require("../src/data/languages/ewe.json");

const sections = ["greetings", "healthTerms", "safety"];

function sortedKeys(value) {
  return Object.keys(value).sort();
}

test("Twi and Ewe contain every English translation key", () => {
  for (const section of sections) {
    assert.deepEqual(
      sortedKeys(twi[section]),
      sortedKeys(english[section]),
      `Twi ${section} keys should match English`
    );
    assert.deepEqual(
      sortedKeys(ewe[section]),
      sortedKeys(english[section]),
      `Ewe ${section} keys should match English`
    );
  }

  const expectedEntryCount = sections.reduce(
    (total, section) => total + Object.keys(english[section]).length,
    0
  );

  assert.equal(expectedEntryCount, 18);
});

test("draft local-language entries remain pending and non-empty", () => {
  for (const dataset of [twi, ewe]) {
    assert.equal(dataset.validationStatus, "pending");

    for (const section of sections) {
      for (const value of Object.values(dataset[section])) {
        assert.equal(typeof value, "string");
        assert.notEqual(value.trim(), "");
      }
    }
  }
});

test("HealthBot product name is spelled consistently in draft greetings", () => {
  assert.match(twi.greetings.welcome, /HealthBot GH/);
  assert.match(ewe.greetings.welcome, /HealthBot GH/);
  assert.doesNotMatch(twi.greetings.welcome, /heathBot/i);
  assert.doesNotMatch(ewe.greetings.welcome, /heathBot/i);
});

let capturedRequest = null;

class MockGroq {
  constructor() {
    this.chat = {
      completions: {
        create: async (request) => {
          capturedRequest = request;

          return {
            choices: [
              {
                message: {
                  content: "General health information."
                }
              }
            ]
          };
        }
      }
    };
  }
}

const groqModulePath = require.resolve("groq-sdk");

require.cache[groqModulePath] = {
  id: groqModulePath,
  filename: groqModulePath,
  loaded: true,
  exports: MockGroq
};

const {
  generateResponse
} = require("../src/services/ai/groq.provider");

test("pending Twi terminology is labelled as draft in the Groq prompt", async () => {
  capturedRequest = null;

  await generateResponse("Medaase", [], "Twi");

  const systemPrompt = capturedRequest.messages[0].content;

  assert.match(systemPrompt, /DRAFT GREETINGS/);
  assert.match(systemPrompt, /DRAFT HEALTH TERMS/);
  assert.match(systemPrompt, /DRAFT SAFETY PHRASES/);
  assert.match(systemPrompt, /has not yet been medically or linguistically validated/);
  assert.doesNotMatch(systemPrompt, /APPROVED GREETINGS/);
});

test("pending Ewe terminology is labelled as draft in the Groq prompt", async () => {
  capturedRequest = null;

  await generateResponse("Akpe", [], "Ewe");

  const systemPrompt = capturedRequest.messages[0].content;

  assert.match(systemPrompt, /DRAFT GREETINGS/);
  assert.match(systemPrompt, /DRAFT HEALTH TERMS/);
  assert.match(systemPrompt, /DRAFT SAFETY PHRASES/);
  assert.doesNotMatch(systemPrompt, /APPROVED GREETINGS/);
});

test("validated English terminology remains labelled as approved", async () => {
  capturedRequest = null;

  await generateResponse("Hello", [], "English");

  const systemPrompt = capturedRequest.messages[0].content;

  assert.match(systemPrompt, /APPROVED GREETINGS/);
  assert.match(systemPrompt, /APPROVED HEALTH TERMS/);
  assert.match(systemPrompt, /APPROVED SAFETY PHRASES/);
  assert.doesNotMatch(systemPrompt, /DRAFT GREETINGS/);
});
