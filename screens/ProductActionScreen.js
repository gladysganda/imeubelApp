import { addDoc, collection, doc, Timestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { db } from "../firebase";

export default function ProductActionScreen({ route, navigation }) {
  const { product, staffName } = route.params;
  const [quantity, setQuantity] = useState("");
  const [clientName, setClientName] = useState("");
  const [actionType, setActionType] = useState(null); // "incoming" or "outgoing"

  const handleStockUpdate = async () => {
    if (!quantity || isNaN(quantity) || parseInt(quantity) <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    let newQuantity = product.quantity;
    if (actionType === "incoming") {
      newQuantity += parseInt(quantity);
    } else if (actionType === "outgoing") {
      if (!clientName.trim()) {
        alert("Please enter client name");
        return;
      }
      if (parseInt(quantity) > product.quantity) {
        alert("Not enough stock available");
        return;
      }
      newQuantity -= parseInt(quantity);
    }

    // Update stock in Firestore
    const productRef = doc(db, "products", product.id);
    await updateDoc(productRef, { quantity: newQuantity });

    // Log the action in Firestore
    await addDoc(collection(db, "stockLogs"), {
      productId: product.id,
      productName: product.name,
      action: actionType,
      quantity: parseInt(quantity),
      staffName,
      clientName: actionType === "outgoing" ? clientName.trim() : "",
      date: Timestamp.now()
    });

    alert("Stock updated successfully!");
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{product.name}</Text>
      <Text>Current Stock: {product.quantity}</Text>
      <View style={styles.buttonRow}>
        <Button
          title="Incoming Stock"
          onPress={() => setActionType("incoming")}
          color={actionType === "incoming" ? "green" : undefined}
        />
        <Button
          title="Outgoing Stock"
          onPress={() => setActionType("outgoing")}
          color={actionType === "outgoing" ? "red" : undefined}
        />
      </View>

      {actionType && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Quantity"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
          />
          {actionType === "outgoing" && (
            <TextInput
              style={styles.input}
              placeholder="Client Name"
              value={clientName}
              onChangeText={setClientName}
            />
          )}
          <Button title="Save" onPress={handleStockUpdate} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  buttonRow: { flexDirection: "row", justifyContent: "space-around", marginVertical: 15 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginVertical: 5 }
});
