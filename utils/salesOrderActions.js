// utils/salesOrderActions.js
import {
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
  getDoc,
} from "firebase/firestore";

/**
 * Set shipment date on an order
 */
export async function setShipmentDate(db, orderId, dateStr) {
  if (!orderId) throw new Error("Missing orderId");
  const ref = doc(db, "salesOrders", String(orderId));
  await updateDoc(ref, {
    shipmentDate: dateStr,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark order done (force complete)
 */
export async function markOrderDone(db, orderId, dateStr = null) {
  if (!orderId) throw new Error("Missing orderId");
  const ref = doc(db, "salesOrders", String(orderId));
  await updateDoc(ref, {
    status: "done",
    sentDate: dateStr || null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Add a payment (installment) to an order.
 * Automatically decreases totals.remaining.
 *
 * @param {Firestore} db
 * @param {string} orderId
 * @param {object} payment { amount, type, date }
 */
export async function addPayment(db, orderId, { amount, type, date }) {
  if (!orderId) throw new Error("Missing orderId");
  const ref = doc(db, "salesOrders", String(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");

  const order = snap.data() || {};
  const oldRem = Number(order?.totals?.remaining || 0);
  const amt = Number(amount || 0);

  const newRemaining = Math.max(oldRem - amt, 0);

  await updateDoc(ref, {
    payments: arrayUnion({
      amount: amt,
      type: type || "unknown",
      date: date || new Date().toISOString().slice(0, 10),
    }),
    "totals.remaining": newRemaining,
    status: newRemaining === 0 ? "done" : "partial",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Recalculate totals.remaining from payments[] (safety helper).
 * Can be used during migration or sanity checks.
 */
export async function recalcRemaining(db, orderId) {
  if (!orderId) throw new Error("Missing orderId");
  const ref = doc(db, "salesOrders", String(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");

  const order = snap.data() || {};
  const subTotal = Number(order?.totals?.subTotal || 0);
  const payments = Array.isArray(order?.payments) ? order.payments : [];

  const paidSum = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const newRemaining = Math.max(subTotal - paidSum, 0);

  await updateDoc(ref, {
    "totals.remaining": newRemaining,
    status: newRemaining === 0 ? "done" : "partial",
    updatedAt: serverTimestamp(),
  });
}
