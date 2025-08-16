import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Log incoming stock
export const logIncomingStock = async (productId, productName, quantity, handledBy) => {
  try {
    await addDoc(collection(db, "incomingLogs"), {
      productId,
      productName,
      quantity,
      handledBy,
      timestamp: serverTimestamp()
    });
    console.log("Incoming stock logged successfully");
  } catch (error) {
    console.error("Error logging incoming stock:", error);
  }
};

// Log outgoing stock
export const logOutgoingStock = async (productId, productName, quantity, clientName, handledBy) => {
  try {
    await addDoc(collection(db, "outgoingLogs"), {
      productId,
      productName,
      quantity,
      clientName,
      handledBy,
      timestamp: serverTimestamp()
    });
    console.log("Outgoing stock logged successfully");
  } catch (error) {
    console.error("Error logging outgoing stock:", error);
  }
};
