const { getAuth } = require("firebase-admin/auth");

async function registerUser(req, res) {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters."
      });
    }

    const user = await getAuth().createUser({
      email,
      password,
      displayName: displayName || undefined
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || null
      }
    });
  } catch (error) {
    console.error("Registration Error:", error.message);

    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists."
      });
    }

    res.status(500).json({
      success: false,
      error: "Unable to register user."
    });
  }
}

async function getCurrentUser(req, res) {
  try {
    const user = await getAuth().getUser(req.user.uid);

    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || null,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error("Get Current User Error:", error.message);

    res.status(500).json({
      success: false,
      error: "Unable to retrieve user profile."
    });
  }
}

module.exports = {
  registerUser,
  getCurrentUser
};