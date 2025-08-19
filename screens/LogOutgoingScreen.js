// screens/LogOutgoingScreen.js
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../firebase";

export default function LogOutgoingScreen({ route, navigation }) {
  const productId = route?.params?.productId || route?.params?.product?.id;
  const user = auth.currentUser;
  const staffName = user?.email || "Unknown User";

  const [quantity, setQuantity] = useState("");
  const [clientName, setClientName] = useState("");

  const handleOutgoing = async () => {
    const qty = Number(quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid number.");
      return;
    }
    if (!clientName.trim()) {
      Alert.alert("Missing Client Name", "Please enter the client name.");
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

      if (qty > current) {
        Alert.alert("Not Enough Stock", "You cannot deduct more than available.");
        return;
      }

      await updateDoc(productRef, {
        quantity: current - qty,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'stockLogs'), {
        productId,
        type: 'outgoing',
        quantity,
        clientName,
        handledBy: displayNameOrEmail,
        handledById: auth.currentUser.uid,
        timestamp: serverTimestamp()
      });

      Alert.alert("Success", "Outgoing stock logged.");
      navigation.goBack();
    } catch (e) {
      console.error("Outgoing error:", e);
      Alert.alert("Error", e?.message || "Failed to log outgoing stock.");
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
      <Text style={styles.label}>Client Name</Text>
      <TextInput
        style={styles.input}
        value={clientName}
        onChangeText={setClientName}
        placeholder="Enter client name"
      />
      <View style={{ height: 10 }} />
      <Button title="Log Outgoing Stock" onPress={handleOutgoing} />
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
