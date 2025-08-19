// screens/LogIncomingScreen.js
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../firebase";

export default function LogIncomingScreen({ route, navigation }) {
  // Expect route.params: { productId } or { product: { id, ... } }
  const productId = route?.params?.productId || route?.params?.product?.id;
  const user = auth.currentUser; // signed-in user
  const staffName = user?.email || "Unknown User";

  const [quantity, setQuantity] = useState("");

  const handleIncoming = async () => {
    const qty = Number(quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter a positive number.");
      return;
    }
    if (!productId) {
      Alert.alert("Error", "Missing product id.");
      return;
    }

    try {
      const productRef = doc(db, "products", String(productId));
      const snap = await getDoc(productRef);
      if (!snap.exists()) {
        Alert.alert("Error", "Product not found.");
        return;
      }
      const data = snap.data();
      const current = data.quantity ?? data.stock ?? 0;

      await updateDoc(productRef, {
        quantity: current + qty,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "stockLogs"), {
        productId: String(productId),
        productName: data.name || "",
        type: "incoming",
        quantity: qty,
        handledBy: staffName,
        handledById: user?.uid || null,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Success", "Incoming stock logged.");
      navigation.goBack();
    } catch (e) {
      console.error("Incoming error:", e);
      Alert.alert("Error", e?.message || "Failed to log incoming stock.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quantity</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
        placeholder="Enter quantity"
      />
      <View style={{ height: 10 }} />
      <Button title="Log Incoming Stock" onPress={handleIncoming} />
      <View style={{ height: 8 }} />
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  label: { fontWeight: "bold", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, marginTop: 5 },
});
