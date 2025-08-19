// utils/logs.js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Logs an incoming stock event to /stockLogs
 * @param {object} p - { productId, productName, quantity, handledById, handledByEmail, note }
 */
export async function logIncomingStock(p) {
  const payload = {
    ...p,
    type: "incoming",
    timestamp: serverTimestamp(),
  };
  await addDoc(collection(db, "stockLogs"), payload);
}

/**
 * Logs an outgoing stock event to /stockLogs
 * @param {object} p - { productId, productName, quantity, clientName, handledById, handledByEmail, note }
 */
export async function logOutgoingStock(p) {
  const payload = {
    ...p,
    type: "outgoing",
    timestamp: serverTimestamp(),
  };
  await addDoc(collection(db, "stockLogs"), payload);
}
