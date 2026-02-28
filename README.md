# 🎞 The Reel Board — Deployment Guide

A shared movie recommendation board for up to 10 people,
powered by Firebase Firestore (real-time sync) and deployable to Vercel.

---

## STEP 1 — Create a Firebase Project (free)

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → name it (e.g. "reelboard") → click through the setup
3. Once created, click the **"</>"** (Web) icon to add a web app
4. Name it anything → click **"Register app"**
5. Copy the `firebaseConfig` object shown — you'll need it in Step 3

---

## STEP 2 — Enable Firestore Database

1. In the Firebase Console sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (allows open read/write for 30 days — fine for a private group)
4. Pick any region → click **"Enable"**

> ⚠️ After 30 days, update Firestore Rules to keep it open for your group:
> ```
> rules_version = '2';
> service cloud.firestore {
>   match /databases/{database}/documents {
>     match /{document=**} {
>       allow read, write: if true;
>     }
>   }
> }
> ```

---

## STEP 3 — Add Your Firebase Config

Open `src/firebase.js` and replace the placeholder values
with your actual config from Step 1:

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "reelboard-xxxx.firebaseapp.com",
  projectId:         "reelboard-xxxx",
  storageBucket:     "reelboard-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

---

## STEP 4 — Install & Run Locally (optional test)

Make sure you have Node.js installed, then:

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the app should load and connect to Firebase.

---

## STEP 5 — Deploy to Vercel (free shareable URL)

### Option A: Via Vercel CLI
```bash
npm install -g vercel
vercel
```
Follow the prompts → you'll get a URL like `https://reelboard-xyz.vercel.app`

### Option B: Via GitHub (recommended)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → **"Add New Project"**
3. Import your GitHub repo
4. Leave all settings as default → click **"Deploy"**
5. Done! Share the URL with your group 🎬

---

## Project Structure

```
reelboard/
├── index.html          ← HTML entry point
├── package.json        ← Dependencies
├── vite.config.js      ← Build config
└── src/
    ├── main.jsx        ← React entry point
    ├── App.jsx         ← Main app (all UI + logic)
    └── firebase.js     ← Firebase config ← EDIT THIS
```

---

## How It Works

- All data lives in a single Firestore document: `reelboard/main`
- Firebase `onSnapshot` listener keeps everyone's screen in sync in real time
- No login required — users just click their name bubble to switch identity
- Names can be changed by double-clicking any name bubble

---

## Customising Member Names

The default names (Alex, Blake, Casey…) can be renamed in the app itself
by double-clicking any name bubble. Changes are saved to Firebase immediately.

To change the *default* names before first launch, edit `DEFAULT_NAMES` in `App.jsx`:
```js
const DEFAULT_NAMES = ["Alice","Bob","Charlie","Diana","Ed","Fiona","George","Hannah","Ivan","Jen"];
```
