// firebase.js

// Import Firebase core
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
    getAuth,
    getReactNativePersistence,
    initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBodnkyPwEhRjXZ_ZaOsOhJB2TK7tnP5fo",
  authDomain: "imeubel-inventory-2-4b600.firebaseapp.com",
  projectId: "imeubel-inventory-2-4b600",
  storageBucket: "imeubel-inventory-2-4b600.firebasestorage.app",
  messagingSenderId: "430514528790",
  appId: "1:430514528790:web:db6bbf0dcf8abc57000b37"
};

// Ensure we only initialize once (hot reload safe)
const appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth:
// - Web -> getAuth(app)
// - Native (Expo Go) -> initializeAuth(app, AsyncStorage persistence)
//   Guard with try/catch to avoid “already initialized” on fast refresh
let authInstance;
if (Platform.OS === "web") {
  authInstance = getAuth(appInstance);
} else {
  try {
    authInstance = initializeAuth(appInstance, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // if already initialized (fast refresh), fall back
    authInstance = getAuth(appInstance);
  }
}

// Firestore
const dbInstance = getFirestore(appInstance);

// ✅ Export all three so other files can import what they need
export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;