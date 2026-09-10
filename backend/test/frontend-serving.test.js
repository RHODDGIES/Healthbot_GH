const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverSource = fs.readFileSync(
  path.join(__dirname, "../src/server.js"),
  "utf8"
);

test("Express serves the existing web frontend", () => {
  assert.match(
    serverSource,
    /path\.join\(\s*__dirname,\s*"\.\.\/\.\.\/frontend"/
  );
  assert.match(
    serverSource,
    /express\.static\(frontendDirectory\)/
  );
});
