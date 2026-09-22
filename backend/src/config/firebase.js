const {
  initializeApp,
  cert,
  getApps
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const {
  loadFirebaseServiceAccount
} = require("./firebase-credentials");

const serviceAccountPath = path.join(
  __dirname,
  "../../serviceAccountKey.json"
);

const serviceAccount = loadFirebaseServiceAccount({
  serviceAccountPath
});

const firebaseApp = getApps()[0] || initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(firebaseApp);

module.exports = {
  db
};
