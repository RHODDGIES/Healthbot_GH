# HealthBot GH

HealthBot GH is an authenticated health-information chatbot for Ghana. It
supports web and WhatsApp conversations in English, Twi and Ewe, including
web and WhatsApp voice notes.

## Local development

1. Copy `backend/.env.example` to `backend/.env` and enter local credentials.
2. Keep `backend/serviceAccountKey.json` local; it is ignored by Git.
3. Copy `frontend/firebase-config.example.js` to
   `frontend/firebase-config.js` and enter the Firebase Web App settings.
4. In `backend`, run `npm install` and then `npm start`.
5. Open `http://localhost:5000`.

Never commit `.env`, Firebase service-account files, generated frontend
configuration, API keys or WhatsApp tokens.

## Netlify deployment

The root `netlify.toml` builds the static frontend from `backend/`, deploys
the Express API as one Netlify Function, and preserves the existing `/api/*`
URLs. The production branch is configured in the Netlify dashboard and should
be set to `development` for the current project workflow.

1. Import this GitHub repository into Netlify.
2. Confirm that Netlify detects the root `netlify.toml`; do not override its
   base, build, publish or functions settings in the dashboard.
3. Add every variable listed in `backend/.env.example` to the Netlify project.
   Secret values belong in Netlify only, not in `netlify.toml`.
4. Deploy, then check `https://<site>.netlify.app/api/health`.
5. Add `<site>.netlify.app` to Firebase Authentication's authorized domains.
6. Test registration, login, password reset, chat history, New Chat and web
   voice notes before connecting WhatsApp.

The Netlify build creates `backend/dist/`. This generated directory is ignored
by Git and never includes local environment files or service-account files.

## Permanent WhatsApp webhook

Use this callback after the production Netlify site name is final:

`https://<site>.netlify.app/api/whatsapp/webhook`

In the Meta app's WhatsApp configuration:

1. Enter the callback URL above.
2. Enter the same random verify token stored in Netlify as
   `WHATSAPP_VERIFY_TOKEN`.
3. Subscribe to the `messages` webhook field.
4. Store the Meta app secret as `WHATSAPP_APP_SECRET` so incoming POST requests
   can be authenticated with `X-Hub-Signature-256`.

For ongoing Graph API access, a Meta Business Portfolio administrator must
create a System User, assign the app and WhatsApp Business Account assets, and
generate a token with `whatsapp_business_messaging` and
`whatsapp_business_management`. Store that token only as
`WHATSAPP_ACCESS_TOKEN` in Netlify.
