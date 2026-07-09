// Firebase client init. The web config below is public by design — data access
// is enforced by Firestore/Storage security rules, not by hiding these values.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const config = {
  apiKey: "AIzaSyBSfHugjPJ52QBQSuHWt9iGBFhq6wBoh5g",
  authDomain: "hotel-7ac9f.firebaseapp.com",
  projectId: "hotel-7ac9f",
  storageBucket: "hotel-7ac9f.appspot.com",
  messagingSenderId: "102297833385",
  appId: "1:102297833385:web:f5605f4331c2b5f7173eb8",
  measurementId: "G-1TZYLRZXES",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

function ensureApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps()[0] ?? initializeApp(config);
  return _app;
}

export function fbAuth(): Auth {
  if (!_auth) _auth = getAuth(ensureApp());
  return _auth;
}
export function fbDb(): Firestore {
  if (!_db) _db = getFirestore(ensureApp(), "demo");
  return _db;
}
export function fbStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(ensureApp());
  return _storage;
}
