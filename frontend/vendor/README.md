# Firebase Web SDK

This directory contains the official Firebase Web SDK 12.3.0 modules used by
the existing static frontend:

- `firebase-app.js`
- `firebase-auth.js`

They are stored locally so authentication does not fail when the Google CDN is
blocked by a browser or network. The authentication module's single Firebase
App import was changed from the Google CDN URL to `./firebase-app.js`.

The original license headers are preserved in both files. Firebase is licensed
under the Apache License 2.0.
