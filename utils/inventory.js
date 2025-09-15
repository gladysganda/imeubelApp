// utils/inventory.js
import { increment } from "firebase/firestore";

/** +n to a specific warehouse and to total */
export function incQtyPatch(whId, n) {
  return {
    [`qtyByWh.${whId}`]: increment(Number(n)),
    quantity: increment(Number(n)),
    lastUpdatedAt: new Date(),
  };
}

/** -n from a specific warehouse and from total */
export function decQtyPatch(whId, n) {
  return incQtyPatch(whId, -Number(n));
}

/** initialize a qtyByWh object on create */
export function initQtyByWh(whId, n) {
  const q = Number(n) || 0;
  return { [whId]: q };
}

/** helper for summing an object of warehouse quantities */
export function sumQtyByWh(qby = {}) {
  return Object.values(qby).reduce((a, b) => a + (Number(b) || 0), 0);
}
