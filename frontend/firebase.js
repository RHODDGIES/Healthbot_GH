import { initializeApp } from "./vendor/firebase-app.js";

import {
  getAuth
} from "./vendor/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export {
  app,
  auth
};
