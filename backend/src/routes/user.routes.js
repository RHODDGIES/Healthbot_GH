const express = require("express");

const {
  registerUser,
  getCurrentUser
} = require("../controllers/user.controller");

const { authenticateUser } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register", registerUser);

router.get("/me", authenticateUser, getCurrentUser);

module.exports = router;