const express = require("express");
const path = require("node:path");

const app = require("./app");
const frontendDirectory = path.join(
  __dirname,
  "../../frontend"
);

app.use(express.static(frontendDirectory));

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HealthBot GH server running on port ${PORT}`);
  });
}

module.exports = app;
