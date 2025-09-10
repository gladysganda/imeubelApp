// screens/ScanOutgoingScreen.js
const STAFF_NAMES = ["Annie", "Riri", "Yuni", "Agus", "Salman"];

import { Picker } from "@react-native-picker/picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth, db } from "../firebase";

// simple IDR formatter (fallbacks to plain number if Intl not available)
function fmtIDR(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);
  } catch {
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
  }
}

export default function ScanOutgoingScreen({ route, navigation }) {
  const role = route?.params?.role || "staff";
  const mode = route?.params?.mode || "outgoing"; // "outgoing" | "lookup"
  const isOwner = role === "owner";

  const [clientAddress, setClientAddress] = useState("");
  const [staffName, setStaffName] = useState(STAFF_NAMES[0]);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState(null);

  const [qty, setQty] = useState("");
  const [clientName, setClientName] = useState("");
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

  const fetchProductByBarcode = async (barcode) => {
    const ref = doc(db, "products", String(barcode));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  };

  const onBarcodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const found = await fetchProductByBarcode(data);
      if (!found) {
        Alert.alert("Not found", `No product with barcode: ${data}`);
        setScanned(false);
        return;
      }
      setProduct(found);
    } catch (e) {
      console.log("Scan error:", e);
      Alert.alert("Error", "Failed to look up product.");
      setScanned(false);
    }
  };

  const resetScan = () => {
    setScanned(false);
    setProduct(null);
    setQty("");
    setClientName("");
    setClientAddress("");
  };

  const confirmOutgoing = async () => {
    const n = Number(qty);
    if (!n || Number.isNaN(n) || n <= 0) {
      Alert.alert("Invalid quantity", "Enter a positive number.");
      return;
    }
    if (!clientName.trim()) {
      Alert.alert("Missing client name", "Please enter client name.");
      return;
    }
    try {
      const ref = doc(db, "products", String(product.barcode || product.id));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert("Error", "Product not found anymore.");
        return;
      }
      const curr = Number(snap.data()?.quantity ?? 0) || 0;
      if (n > curr) {
        Alert.alert("Not enough stock", `Available: ${curr}`);
        return;
      }

      await updateDoc(ref, {
        quantity: curr - n,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: auth.currentUser?.uid || null,
        lastUpdatedByEmail: auth.currentUser?.email || null,
      });

      // If you also log stock-out elsewhere, keep your existing util call here
      // await logOutgoingStock({...})

      Alert.alert("Success", `Deducted ${n} from ${snap.data()?.name || ref.id}`);
      resetScan();
    } catch (e) {
      console.log("Outgoing failed:", e);
      Alert.alert("Error", e?.message || "Failed to log outgoing.");
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permissions…</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>No camera access.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const renderDetails = () => {
    if (!product) {
      return (
        <>
          <Text style={styles.title}>Product not found</Text>
          <Button title="Scan Again" onPress={resetScan} />
        </>
      );
    }

    const stock = Number(product.quantity ?? 0) || 0;
    const code = product.barcode || product.id;

    return (
      <>
        <Text style={styles.title}>
          {mode === "lookup" ? "Product Info" : `Outgoing — ${role}`}
        </Text>

        <Text style={styles.name}>{product.name || "(no name)"}</Text>
        {product.brand ? <Text>Brand: {product.brand}</Text> : null}
        {product.category ? <Text>Category: {product.category}</Text> : null}
        {product.sizes ? <Text>Sizes: {product.sizes}</Text> : null}
        {product.material ? <Text>Material: {product.material}</Text> : null}
        {product.colors ? <Text>Colors: {product.colors}</Text> : null}
        <Text>Barcode: {code}</Text>
        <Text>Stock: {stock}</Text>

        {/* Harga Modal (buyPrice) visible to OWNER only */}
        {product.buyPrice != null ? (
          <Text>Harga Modal: {fmtIDR(product.buyPrice)}</Text>
        ) : null}
        
        {/* Lookup mode: just show details & rescan */}
        {mode === "lookup" ? (
          <>
            <View style={{ height: 12 }} />
            <Button title="Scan Another" onPress={resetScan} />
          </>
        ) : (
          <>
            {/* Outgoing form */}
            <Text style={styles.label}>Quantity to deduct</Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              placeholder="e.g. 1"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Client name</Text>
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={setClientName}
              placeholder="e.g. John Doe"
            />

            <Text style={styles.label}>Client address</Text>
            <TextInput
              style={styles.input}
              value={clientAddress}
              onChangeText={setClientAddress}
              placeholder="Address"
            />

            <Text style={styles.label}>Staff Name</Text>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={staffName} onValueChange={setStaffName}>
                {STAFF_NAMES.map((n) => (
                  <Picker.Item key={n} label={n} value={n} />
                ))}
              </Picker>
            </View>

            <View style={{ height: 10 }} />
            <Button title="Confirm Outgoing" onPress={confirmOutgoing} />
            <View style={{ height: 10 }} />
            <Button title="Scan Another" onPress={resetScan} />
          </>
        )}
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: mode === "lookup" ? "#fff" : "#000" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {!scanned ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={onBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "ean13", "ean8", "code128", "upc_a", "upc_e"],
          }}
        />
      ) : (
        <View style={styles.sheet}>{renderDetails()}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sheet: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  name: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff",
  },
  pickerWrapper: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff",
  },
});
