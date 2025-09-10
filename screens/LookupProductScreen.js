// screens/LookupProductScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// --- helpers: IDR formatting & field normalization ---
const idrFormatter =
  typeof Intl !== "undefined" && Intl.NumberFormat
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      })
    : null;

function toNumberSafe(val) {
  if (val == null) return null;
  if (typeof val === "number") return val;
  // remove anything not a digit, supports "Rp 1.234.000", "1,234,000", etc.
  const cleaned = String(val).replace(/[^\d]/g, "");
  if (!cleaned) return null;
  return Number(cleaned);
}

function fmtIDR(n) {
  if (n == null) return "-";
  try {
    return idrFormatter ? idrFormatter.format(n) : `Rp ${n.toLocaleString("id-ID")}`;
  } catch {
    return `Rp ${String(n)}`;
  }
}

/**
 * Normalize product object:
 * - expose _buyPriceNum regardless of original field naming:
 *   supports buyPrice, buyprice, hargaModal, modal (add more if needed)
 */
function normalizeProduct(raw) {
  const buyRaw =
    raw?.buyPrice ??
    raw?.buyprice ??
    raw?.hargaModal ??
    raw?.modal ??
    null;
  const buyNum = toNumberSafe(buyRaw);

  return {
    ...raw,
    _buyPriceRaw: buyRaw,
    _buyPriceNum: buyNum,
  };
}

export default function LookupProductScreen({ route, navigation }) {
  const [barcode, setBarcode] = useState(
    route?.params?.scannedBarcode ? String(route.params.scannedBarcode) : ""
  );
  const [loading, setLoading] = useState(false);
  const [prod, setProd] = useState(null);
  const [units, setUnits] = useState([]); // if you later track per-unit serials
  const [error, setError] = useState("");

  const canLookup = useMemo(() => !!barcode.trim(), [barcode]);

  useEffect(() => {
    if (route?.params?.scannedBarcode) {
      const code = String(route.params.scannedBarcode);
      setBarcode(code);
      // auto lookup when returned from scanner
      setTimeout(() => doLookup(code), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.scannedBarcode]);

  async function doLookup(codeOverride) {
    const code = (codeOverride ?? barcode).trim();
    if (!code) return;
    setLoading(true);
    setError("");
    setProd(null);
    setUnits([]);

    try {
      // Primary lookup by docId === barcode
      const snap = await getDoc(doc(db, "products", code));
      if (snap.exists()) {
        setProd(normalizeProduct({ id: snap.id, ...snap.data() }));
      } else {
        // fallback: search by 'barcode' field if your staff sometimes stored under random docId
        const qy = query(
          collection(db, "products"),
          where("barcode", "==", code),
          limit(1)
        );
        const qSnap = await getDocs(qy);
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          setProd(normalizeProduct({ id: d.id, ...d.data() }));
        } else {
          setError("Product not found.");
        }
      }

      // OPTIONAL: if you use per-unit serials table (units collection)
      // const uq = query(collection(db, "units"), where("barcode", "==", code), limit(100));
      // const uSnap = await getDocs(uq);
      // const list = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      // setUnits(list);
    } catch (e) {
      console.log("lookup error", e);
      setError(e?.message || "Failed to lookup product.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Lookup Product</Text>

        <Text style={styles.label}>Barcode</Text>
        <TextInput
          style={styles.inputMono}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Scan or type barcode"
          autoCapitalize="none"
        />

        <View style={{ height: 8 }} />
        <Button
          title={loading ? "Looking up..." : "Lookup"}
          onPress={() => doLookup()}
          disabled={!canLookup || loading}
        />
        <View style={{ height: 8 }} />
        <Button
          title="Scan with Outgoing Scanner"
          onPress={() => navigation.navigate("ScanOutgoingScreen", { mode: "lookup" })}
        />

        {error ? (
          <View style={[styles.card, { borderColor: "#F44336" }]}>
            <Text style={{ color: "#F44336" }}>{error}</Text>
          </View>
        ) : null}

        {prod ? (
          <View style={styles.card}>
            <Text style={styles.big}>
              {prod.name || prod.product || "(no name)"}
            </Text>
            {prod.barcode ? (
              <Text>Barcode: {String(prod.barcode)}</Text>
            ) : (
              <Text>ID: {prod.id}</Text>
            )}
            {prod.category ? <Text>Category: {String(prod.category)}</Text> : null}
            {prod.brand ? <Text>Brand: {String(prod.brand)}</Text> : null}
            {prod.sizes ? <Text>Sizes: {String(prod.sizes)}</Text> : null}
            {prod.material ? <Text>Material: {String(prod.material)}</Text> : null}
            {prod.colors ? <Text>Colors: {String(prod.colors)}</Text> : null}

            <Text>
              Quantity: {Number(prod.quantity ?? prod.stock ?? 0) || 0}
            </Text>

            {/* Harga Modal shown for both owner and staff */}
            <Text>Harga Modal: {fmtIDR(prod._buyPriceNum)}</Text>
            {prod.supplierName ? (
              <Text>Supplier: {String(prod.supplierName)}</Text>
            ) : null}
          </View>
        ) : null}

        {/* OPTIONAL per-unit listing */}
        {units.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Units</Text>
            {units.map((u) => (
              <Text key={u.id}>
                {u.serial} — {u.status || "in"} {u.size ? `(${u.size})` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 6 },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    marginTop: 12,
  },
  big: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  inputMono: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
});
