// screens/LogOutgoingScreen.js
import { addDoc, collection, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where, limit } from "firebase/firestore";
import { useState } from "react";
import { Alert, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../firebase";
import ProductSearchPicker from "../components/ProductSearchPicker";

export default function LogOutgoingScreen({ route, navigation }) {
  // If a product was routed in (e.g., from detail screen), use it.
  const passed = route?.params?.product || null;
  const productId = route?.params?.productId || passed?.barcode || passed?.id;

  const staffEmail = auth.currentUser?.email || "Unknown User";

  // Form state
  const [quantity, setQuantity] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [note, setNote] = useState("");

  // Picker (used when productId is not provided)
  const [pick, setPick] = useState(null); // { brand, category, displayName, name, sizes[], selectedSize, barcodesBySize? }

  const usingPicker = !productId;

  async function resolvePickedProductBarcodeOrDoc() {
    // 1) If master has a fixed barcode per size, use it
    const chosenBarcode = pick?.barcodesBySize?.[pick?.selectedSize || ""] || null;
    if (chosenBarcode) {
      return { id: String(chosenBarcode) };
    }

    // 2) Otherwise, try to find an existing products doc by identity (brand+name+size)
    //    NOTE: This needs a composite index in Firestore the first time it runs.
    const qy = query(
      collection(db, "products"),
      where("brand", "==", pick.brand),
      where("name", "==", (pick.displayName || pick.name)),
      where("sizes", "==", pick.selectedSize),
      limit(1)
    );
    const snap = await getDocs(qy);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { id: docSnap.id, data: docSnap.data() };
  }

  const handleOutgoing = async () => {
    const qty = Number(quantity);
    if (!qty || Number.isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid positive number.");
      return;
    }
    if (!clientName.trim()) {
      Alert.alert("Missing Client Name", "Please enter the client name.");
      return;
    }

    try {
      let targetId = productId ? String(productId) : null;
      let productData = null;

      if (usingPicker) {
        if (!pick || !pick.selectedSize) {
          Alert.alert("Missing selection", "Pick brand → product → size first.");
          return;
        }
        const resolved = await resolvePickedProductBarcodeOrDoc();
        if (!resolved) {
          Alert.alert(
            "Product not found",
            "No matching stock found for this product/size. Make sure it has been added (incoming) first."
          );
          return;
        }
        targetId = resolved.id;
        productData = resolved.data || null;
      }

      // Fetch current product
      const pRef = doc(db, "products", targetId);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists()) {
        Alert.alert("Error", "Product not found.");
        return;
      }
      const data = productData || (pSnap.data() || {});
      const current = Number(data.quantity ?? data.stock ?? 0) || 0;

      if (qty > current) {
        Alert.alert("Not Enough Stock", `Available: ${current}`);
        return;
      }

      // Decrement with increment(-qty) for concurrency safety
      await updateDoc(pRef, {
        quantity: increment(-qty),
        updatedAt: serverTimestamp(),
      });

      // Log OUTGOING
      await addDoc(collection(db, "stockLogs"), {
        type: "outgoing",
        productId: targetId,
        productName: data.name || (pick?.displayName || pick?.name) || "",
        category: data.category || pick?.category || null,
        brand: data.brand || pick?.brand || null,
        sizes: data.sizes || pick?.selectedSize || null,
        quantity: qty,
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim() || null,
        staffName: staffEmail,
        handledById: auth.currentUser?.uid || null,
        handledByEmail: staffEmail,
        note: note.trim() || null,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Success", "Outgoing stock logged.");
      navigation.goBack();
    } catch (e) {
      console.error("Outgoing error:", e);
      Alert.alert("Error", e?.message || "Failed to log outgoing stock.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {usingPicker ? (
          <>
            <ProductSearchPicker value={pick} onChange={setPick} />
          </>
        ) : null}

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="Enter quantity"
        />

        <Text style={styles.label}>Client Name</Text>
        <TextInput
          style={styles.input}
          value={clientName}
          onChangeText={setClientName}
          placeholder="Enter client name"
        />

        <Text style={styles.label}>Client Address (optional)</Text>
        <TextInput
          style={styles.input}
          value={clientAddress}
          onChangeText={setClientAddress}
          placeholder="Enter client address"
        />

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={note}
          onChangeText={setNote}
          placeholder="Remark / reference / order no."
          multiline
        />

        <View style={{ height: 10 }} />
        <Button title="Log Outgoing Stock" onPress={handleOutgoing} />
        <View style={{ height: 8 }} />
        <Button title="Back" onPress={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff" },
  label: { fontWeight: "bold", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, marginTop: 5, backgroundColor: "#fff" },
});
