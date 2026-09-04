const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { db } = require("./config/firebase");

const aiRoutes = require("./routes/ai.routes");
const userRoutes = require("./routes/user.routes");
const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`HealthBot GH server running on port ${PORT}`);
});