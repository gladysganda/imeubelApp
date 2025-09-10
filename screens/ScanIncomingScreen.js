// screens/ScanIncomingScreen.js
import { CameraView, useCameraPermissions } from "expo-camera";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../firebase";
import { logIncomingStock } from "../utils/logs";

export default function ScanIncomingScreen({ route, navigation }) {
  // role is optional; useful for UI text, not required for logic
  const role = route?.params?.role || "staff";

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState(null);

  const [qty, setQty] = useState("");
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

  const fetchProductByBarcode = async (barcode) => {
    // Your products use barcode as document ID (recommended)
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
  };

  const confirmIncoming = async () => {
    const n = Number(qty);
    if (!n || isNaN(n) || n <= 0) {
      Alert.alert("Invalid quantity", "Enter a positive number.");
      return;
    }
    try {
      const ref = doc(db, "products", String(product.barcode || product.id));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert("Error", "Product not found.");
        return;
      }
      const curr = snap.data()?.quantity ?? 0;
      const newQty = curr + n;

      await updateDoc(ref, {
        quantity: newQty,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: auth.currentUser?.uid || null,
        lastUpdatedByEmail: auth.currentUser?.email || null,
      });

      await logIncomingStock({
        productId: ref.id,
        productName: snap.data()?.name || "",
        quantity: n,
        handledById: auth.currentUser?.uid || null,
        handledByEmail: auth.currentUser?.email || null,
        note: `Incoming via scanner`,
      });

      Alert.alert("Success", `Added ${n} to ${snap.data()?.name || ref.id}`);
      resetScan();
    } catch (e) {
      console.log("Incoming failed:", e);
      Alert.alert("Error", e?.message || "Failed to log incoming.");
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#000" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {!scanned ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={onBarcodeScanned}
          barcodeScannerSettings={{
            // Include common formats; add/remove as needed
            barcodeTypes: ["qr", "ean13", "ean8", "code128", "upc_a", "upc_e"],
          }}
        />
      ) : (
        <View style={styles.sheet}>
          {product ? (
            <>
              <Text style={styles.title}>Incoming — {role}</Text>
              <Text style={styles.name}>{product.name || "(no name)"}</Text>
              {product.brand ? <Text>Brand: {product.brand}</Text> : null}
              {product.sizes ? <Text>Sizes: {product.sizes}</Text> : null}
              <Text>Barcode: {product.barcode || product.id}</Text>
              <Text>Stock: {product.quantity ?? 0}</Text>

              <Text style={styles.label}>Quantity to add</Text>
              <TextInput
                style={styles.input}
                value={qty}
                onChangeText={setQty}
                placeholder="e.g. 3"
                keyboardType="numeric"
              />

              <View style={{ height: 10 }} />
              <Button title="Confirm Incoming" onPress={confirmIncoming} />
              <View style={{ height: 10 }} />
              <Button title="Scan Another" onPress={resetScan} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Product not found</Text>
              <Button title="Scan Again" onPress={resetScan} />
            </>
          )}
        </View>
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
});
