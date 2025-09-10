// utils/normalize.js
export const norm = (s) =>
  (s ?? "").toString().trim().replace(/\s+/g, " ").toUpperCase();

export const normBrand = norm;
export const normCategory = norm;
export const normName = norm;

export const pretty = (s) =>
  (s ?? "").toString().trim().replace(/\s+/g, " ").replace(/\b([a-z])/gi, (m) => m.toUpperCase());
