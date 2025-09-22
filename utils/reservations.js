// utils/reservations.js
import { collection, getDocs, query, updateDoc, where, doc } from "firebase/firestore";
import { db } from "../firebase";

export async function fulfillReservationsForOrder(orderId) {
  const qy = query(collection(db, "reservations"), where("orderId", "==", orderId), where("status", "==", "pending"));
  const snap = await getDocs(qy);
  await Promise.all(snap.docs.map(d => updateDoc(doc(db, "reservations", d.id), { status: "fulfilled" })));
}

export async function cancelReservationsForOrder(orderId) {
  const qy = query(collection(db, "reservations"), where("orderId", "==", orderId), where("status", "==", "pending"));
  const snap = await getDocs(qy);
  await Promise.all(snap.docs.map(d => updateDoc(doc(db, "reservations", d.id), { status: "cancelled" })));
}
