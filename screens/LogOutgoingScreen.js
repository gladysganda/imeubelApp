// screens/LogOutgoingScreen.js
import React, { useState } from "react";
import { Alert, Button, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebase";

// Edit the names here if you like
const STAFF_NAMES = ["Annie", "Riri", "Yuni", "Agus", "Salman"];

/**
 * Try to find a product by code:
 * 1) products/{code} (doc id == barcode)
 * 2) products where barcode == code
 */
async function findProductByBarcode(code) {
  const id = String(code);
  const ref = doc(db, "products", id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, data: snap.data() };

  const q = query(collection(db, "products"), where("barcode", "==", id));
  const qs = await getDocs(q);
  let first = null;
  qs.forEach((d) => {
    if (!first) first = { id: d.id, data: d.data() };
  });
  return first; // can be null
}

/**
 * OPTIONAL unique-per-unit support:
 * Lookup a serial in a top-level "units" collection (recommended shape below).
 * If found and status == 'in', return { unit, product }.
 *
 * Suggested "units" fields:
 * - serial: string (document id == serial is even better)
 * - productId: string
 * - productName, brand, category, sizes (cached for convenience)
 * - status: 'in' | 'out'
 * - createdAt, lastMovedAt...
 */
async function findUnitSerial(code) {
  const serial = String(code);

  // Try "units/{serial}" first
  const ref = doc(db, "units", serial);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const u = snap.data();
    if (u?.status === "in" && u?.productId) {
      const pRef = doc(db, "products", String(u.productId));
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        return { unit: { id: serial, ...u }, product: { id: pSnap.id, data: pSnap.data() } };
      }
    }
    return null; // found but not in stock or missing parent
  }

  // Fallback query by serial field (if you don't use docId == serial)
  const q = query(collection(db, "units"), where("serial", "==", serial), where("status", "==", "in"));
  const qs = await getDocs(q);
  let u = null;
  qs.forEach((d) => { if (!u) u = { id: d.id, ...d.data() }; });
  if (!u || !u.productId) return null;

  const pRef = doc(db, "products", String(u.productId));
  const pSnap = await getDoc(pRef);
  if (!pSnap.exists()) return null;

  return { unit: u, product: { id: pSnap.id, data: pSnap.data() } };
}

export default function LogOutgoingScreen({ route, navigation }) {
  const productIdFromRoute = route?.params?.productId || route?.params?.product?.id || "";
  const [barcodeOrSerial, setBarcodeOrSerial] = useState(""); // allow SKU barcode or unit serial
  const [quantity, setQuantity] = useState("1");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [note, setNote] = useState("");
  const [staffName, setStaffName] = useState(STAFF_NAMES[0]);

  async function handleOutgoing() {
    const code = (barcodeOrSerial || productIdFromRoute || "").trim();
    const qty = Number(quantity);

    if (!code) return Alert.alert("Missing", "Scan or type a barcode/serial.");
    if (!clientName.trim()) return Alert.alert("Missing", "Client name is required.");
    if (Number.isNaN(qty) || qty <= 0) return Alert.alert("Invalid", "Quantity must be a positive number.");

    try {
      // 1) Try as PRODUCT barcode (aggregate stock)
      let product = await findProductByBarcode(code);

      // 2) If not a product, try as UNIT serial (unique label)
      let usedUnit = null;
      if (!product) {
        const unitHit = await findUnitSerial(code);
        if (!unitHit) {
          Alert.alert("Not found", "No product or unit with that code.");
          return;
        }
        product = unitHit.product; // {id, data}
        usedUnit = unitHit.unit;   // {id: serial, ...}
      }

      const pData = product.data || {};
      const current = Number(pData.quantity ?? pData.stock ?? 0) || 0;

      // If this is a unit-serial flow, force qty = 1 for safety
      const finalQty = usedUnit ? 1 : qty;

      if (finalQty > current) {
        Alert.alert("Not enough stock", `Available: ${current}`);
        return;
      }

      // Update product quantity
      await updateDoc(doc(db, "products", product.id), {
        quantity: current - finalQty,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
        updatedByEmail: auth.currentUser?.email || null,
      });

      // If unit serial was used, mark it "out"
      if (usedUnit) {
        await updateDoc(doc(db, "units", usedUnit.id), {
          status: "out",
          lastMovedAt: serverTimestamp(),
          lastMovedBy: auth.currentUser?.uid || null,
          lastMovedByEmail: auth.currentUser?.email || null,
          movedNote: `Outgoing → ${clientName}`,
        });
      }

      // Log outgoing
      await addDoc(collection(db, "stockLogs"), {
        type: "outgoing",
        productId: product.id,
        productName: pData.name || "",
        barcode: pData.barcode || product.id,
        unitSerial: usedUnit ? usedUnit.id : null,     // captured if per-unit path
        category: pData.category || null,
        brand: pData.brand || null,
        sizes: pData.sizes || null,
        quantity: finalQty,
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim() || null,
        staffName: staffName,                          // who handled
        handledById: auth.currentUser?.uid || null,
        handledByEmail: auth.currentUser?.email || null,
        note: note.trim() || null,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Success", usedUnit ? "Unit checked-out." : "Outgoing stock logged.");
      navigation.goBack();
    } catch (e) {
      console.error("Outgoing error:", e);
      Alert.alert("Error", e?.message || "Failed to log outgoing stock.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.container}>
        <Text style={styles.label}>Staff</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={staffName} onValueChange={setStaffName}>
            {STAFF_NAMES.map((n) => <Picker.Item key={n} label={n} value={n} />)}
          </Picker>
        </View>

        <Text style={styles.label}>Barcode / Serial *</Text>
        <TextInput
          style={styles.input}
          value={barcodeOrSerial}
          onChangeText={setBarcodeOrSerial}
          placeholder="Scan or type code"
          autoCapitalize="none"
        />

        <Text style={styles.note}>
          • Scan a product barcode (SKU) for normal outgoing, or scan a unique unit serial if you use per-unit labels.
        </Text>

        <Text style={styles.label}>Quantity {/** auto-forced to 1 for serials */}</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="1"
        />

        <Text style={styles.label}>Client Name *</Text>
        <TextInput
          style={styles.input}
          value={clientName}
          onChangeText={setClientName}
          placeholder="Customer name"
        />

        <Text style={styles.label}>Client Address (optional)</Text>
        <TextInput
          style={styles.input}
          value={clientAddress}
          onChangeText={setClientAddress}
          placeholder="Address"
        />

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={note}
          onChangeText={setNote}
          placeholder="Remarks / order ref"
          multiline
        />

        <View style={{ height: 10 }} />
        <Button title="Log Outgoing Stock" onPress={handleOutgoing} />
        <View style={{ height: 8 }} />
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  label: { fontWeight: "bold", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 8, marginTop: 5, backgroundColor: "#fff" },
  note: { color: "#666", marginTop: 6 },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", marginTop: 5 },
});
