# Vast Stair Quotation Software — Deployment Guide

This app is a client-side React app (TanStack Start + Vite) that uses **Firebase** for authentication, database and file storage. Deploying it takes about 10 minutes.

---

## 1) Create your Firebase project (one-time)

1. Go to https://console.firebase.google.com and click **Add project**. Give it a name (e.g. `vast-stair`).
2. Once created, click the **Web icon (`</>`)** to register a web app. Give it any nickname and click **Register app**.
3. Firebase will show you a `firebaseConfig` object. Keep this browser tab open — you'll copy 6 values from it in a moment.

### Enable the services

- **Authentication** → *Get started* → **Email/Password** → **Enable** → Save.
- **Firestore Database** → *Create database* → **Production mode** → pick a region close to you.
- **Storage** → *Get started* → **Production mode**.

### Create your login

- **Authentication → Users → Add user** → enter your email + password. That's your owner login.

### Paste the security rules

- **Firestore → Rules** tab → paste the contents of `firestore.rules` from this repo → **Publish**.
- **Storage → Rules** tab → paste the contents of `storage.rules` from this repo → **Publish**.

---

## 2) Deploy to Vercel

1. Push this repo to GitHub / GitLab / Bitbucket.
2. Go to https://vercel.com/new and import the repository.
3. Vercel auto-detects Vite. Leave the defaults; `vercel.json` is already in the repo.
4. In **Environment Variables**, add all 6 values from your Firebase config:

   | Name | Where to find it |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   These are the **publishable** Firebase Web SDK keys — safe to expose in a client bundle. Security is enforced by the Firestore/Storage rules above.

5. Click **Deploy**. Wait ~1 minute. Open the URL, sign in with the account you created in step 1, and start creating quotations.

### Authorize your Vercel domain in Firebase

After the first deploy, go to **Firebase → Authentication → Settings → Authorized domains** and add your Vercel URL (e.g. `vast-stair.vercel.app`). Without this, login will fail with `auth/unauthorized-domain`.

---

## 3) Previewing locally

Create a `.env` file in the project root (copy `.env.example`) and paste the same 6 values. Then the Lovable preview / local dev will connect to Firebase.

---

## First-run checklist inside the app

1. Sign in.
2. Open **Settings** → fill in your company profile, upload your logo, add bank details. Save.
3. Open **Clients** → **Add Client**.
4. **New Quotation** → pick that client → add stair items with photos → review → **Download PDF** or **Share on WhatsApp**.

That's it. Every quotation is stored under your account and shows up under the client's history.
