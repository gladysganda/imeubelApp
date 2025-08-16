import { addDoc, collection, doc, getDoc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import ScannerView from "../components/ScannerView";
import { auth, db } from "../firebase";

export default function ScanOutgoingScreen() {
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [clientName, setClientName] = useState("");

  const handleScanned = async (barcode) => {
    try {
      const ref = doc(db, "products", String(barcode));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert("Not Found", `No product found for barcode: ${barcode}`);
        return;
      }
      setProduct({ id: snap.id, ...snap.data() });
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to fetch product.");
    }
  };

  const confirmOutgoing = async () => {
    const qty = Number(quantity);
    if (!product) return Alert.alert("Scan first", "Please scan a product.");
    if (!qty || isNaN(qty) || qty <= 0) return Alert.alert("Invalid quantity", "Enter a positive number.");
    if (!clientName.trim()) return Alert.alert("Missing", "Enter client name.");

    const current = product.quantity ?? 0;
    if (qty > current) return Alert.alert("Not enough stock", `Available: ${current}`);

    try {
      await updateDoc(doc(db, "products", product.id), { quantity: increment(-qty) });
      await addDoc(collection(db, "stockLogs"), {
        type: "outgoing",
        productId: product.id,
        productName: product.name || "",
        quantity: qty,
        clientName: clientName.trim(),
        handledBy: auth.currentUser?.email || auth.currentUser?.uid || "unknown",
        timestamp: serverTimestamp(),
      });
      Alert.alert("Success", `Deducted ${qty} from stock.`);
      setProduct(null);
      setQuantity("");
      setClientName("");
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update stock.");
    }
  };

  if (!product) {
    return <ScannerView onScanned={handleScanned} hint="Scan product barcode (Outgoing)" />;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{product.name || "Unnamed Product"}</Text>
      <Text>Current Stock: {product.quantity ?? 0}</Text>
      {!!product.sizes && <Text>Size: {product.sizes}</Text>}
      {!!product.brand && <Text>Brand: {product.brand}</Text>}

      <Text style={styles.label}>Quantity to deduct</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        placeholder="e.g. 1"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Client Name</Text>
      <TextInput
        style={styles.input}
        value={clientName}
        onChangeText={setClientName}
        placeholder="Customer name"
      />

      <View style={{ height: 8 }} />
      <Button title="Confirm Outgoing" onPress={confirmOutgoing} />
      <View style={{ height: 8 }} />
      <Button title="Scan Another" onPress={() => setProduct(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  label: { fontWeight: "600", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
});