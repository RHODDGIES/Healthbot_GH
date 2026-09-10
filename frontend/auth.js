import { auth } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "./vendor/firebase-auth.js";

// --------------------------------------------------
// REGISTER
// --------------------------------------------------

export async function registerUser(name, email, password) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  if (name) {
    await updateProfile(credential.user, {
      displayName: name
    });
  }

  return credential.user;
}

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return credential.user;
}

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

export async function logoutUser() {
  await signOut(auth);
}

// --------------------------------------------------
// CURRENT USER TOKEN
// --------------------------------------------------

export async function getCurrentUserToken() {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  return await user.getIdToken();
}

// --------------------------------------------------
// AUTH STATE
// --------------------------------------------------

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
