const express = require("express");
const cors = require("cors");

require("dotenv").config({ quiet: true });

const aiRoutes = require("./routes/ai.routes");
const userRoutes = require("./routes/user.routes");
const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();

app.use(cors());
app.use(express.json({
  verify(req, res, buffer) {
    if (
      req.method === "POST" &&
      req.originalUrl.startsWith("/api/whatsapp/webhook")
    ) {
      req.rawBody = Buffer.from(buffer);
    }
  }
}));

app.use("/api/ai", aiRoutes);
app.use("/api/users", userRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "HealthBot GH",
    message: "HealthBot GH API is running"
  });
});

module.exports = app;
