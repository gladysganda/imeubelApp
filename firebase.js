// firebase.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";
import { Platform } from "react-native";

// ---- Firebase Web config (must match your project) ----
const firebaseConfig = {
  apiKey: "AIzaSyBodnkyPwEhRjXZ_ZaOsOhJB2TK7tnP5fo",
  authDomain: "imeubel-inventory-2-4b600.firebaseapp.com",
  projectId: "imeubel-inventory-2-4b600",
  // If you ever use Storage, Firebase expects .appspot.com here:
  storageBucket: "imeubel-inventory-2-4b600.appspot.com",
  messagingSenderId: "430514528790",
  appId: "1:430514528790:web:db6bbf0dcf8abc57000b37",
};

// Single app instance (safe across fast refresh)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// -------- Auth (persist on native, standard on web) --------
let auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  // On native, prefer initializeAuth with AsyncStorage persistence.
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // If already initialized due to fast refresh, fall back to getAuth
    auth = getAuth(app);
  }
}

// -------- Firestore (force long polling on native) --------
let db;
if (Platform.OS === "web") {
  db = getFirestore(app);
} else {
  // Long polling is more reliable under Expo Go networks
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
}

export { app, auth, db };

