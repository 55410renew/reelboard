// ─────────────────────────────────────────────
//  STEP 1: Replace these values with your own
//  from Firebase Console > Project Settings
// ─────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDvrgv3RrM_SRfoAoTLaTnGPPfCfazMkqk",
  authDomain: "movie-time-2f6ba.firebaseapp.com",
  projectId: "movie-time-2f6ba",
  storageBucket: "movie-time-2f6ba.firebasestorage.app",
  messagingSenderId: "267660018015",
  appId: "1:267660018015:web:f05fc385c066c91a7db6ea",
  measurementId: "G-72T47R59JW"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
