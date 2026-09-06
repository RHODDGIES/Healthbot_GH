import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCewRQQeIRdaA1KjZZA1mDnXcZ38UEPlD0",
  authDomain: "healthbotgh-4fd54.firebaseapp.com",
  projectId: "healthbotgh-4fd54",
  storageBucket: "healthbotgh-4fd54.firebasestorage.app",
  messagingSenderId: "659122744633",
  appId: "1:659122744633:web:fdb86fd9b802e1bf5a8ce8"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export {
  app,
  auth
};