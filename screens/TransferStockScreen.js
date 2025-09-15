// screens/TransferStockScreen.js
import React, { useState } from "react";
import { Alert, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { doc, getDoc, serverTimestamp, updateDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../firebase";
import { WAREHOUSES } from "../constants/warehouses";
import { decQtyPatch, incQtyPatch } from "../utils/inventory";

export default function TransferStockScreen() {
  const [barcode, setBarcode] = useState("");
  const [fromWh, setFromWh] = useState("store");
  const [toWh, setToWh] = useState("amplas");
  const [qty, setQty] = useState("");

  const go = async () => {
    const n = Number(qty);
    if (!barcode.trim()) return Alert.alert("Validation", "Enter barcode.");
    if (!n || n <= 0) return Alert.alert("Validation", "Qty must be positive.");
    if (fromWh === toWh) return Alert.alert("Validation", "Pick different warehouses.");

    try {
      const ref = doc(db, "products", barcode.trim());
      const snap = await getDoc(ref);
      if (!snap.exists()) return Alert.alert("Error", "Product not found.");
      const d = snap.data() || {};
      const fromQty = Number(d?.qtyByWh?.[fromWh] ?? 0);
      if (n > fromQty) return Alert.alert("Not enough stock", `Available in ${fromWh}: ${fromQty}`);

      // subtract from 'fromWh' and add to 'toWh' (total net 0)
      await updateDoc(ref, {
        ...decQtyPatch(fromWh, n),
        ...incQtyPatch(toWh, n),
        // decQtyPatch and incQtyPatch both touch 'quantity'; keep total unchanged:
        quantity: Number(d.quantity ?? 0),
        lastUpdatedBy: auth.currentUser?.uid || null,
        lastUpdatedByEmail: auth.currentUser?.email || null,
      });

      await addDoc(collection(db, "stockLogs"), {
        type: "transfer",
        productId: ref.id,
        productName: d.name || "",
        quantity: n,
        fromWarehouse: fromWh,
        toWarehouse: toWh,
        handledById: auth.currentUser?.uid || null,
        handledByEmail: auth.currentUser?.email || null,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Done", `Moved ${n} from ${fromWh} → ${toWh}`);
      setQty("");
    } catch (e) {
      console.log("transfer error:", e);
      Alert.alert("Error", e?.message || "Transfer failed.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Transfer Stock</Text>

          <Text style={styles.label}>Barcode</Text>
          <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Scan or type" autoCapitalize="none" />

          <Text style={styles.label}>From</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={fromWh} onValueChange={setFromWh}>
              {WAREHOUSES.map(w => <Picker.Item key={w.id} label={w.label} value={w.id} />)}
            </Picker>
          </View>

          <Text style={styles.label}>To</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={toWh} onValueChange={setToWh}>
              {WAREHOUSES.map(w => <Picker.Item key={w.id} label={w.label} value={w.id} />)}
            </Picker>
          </View>

          <Text style={styles.label}>Quantity</Text>
          <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="0" />

          <View style={{ height: 12 }} />
          <Button title="Transfer" onPress={go} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" },
});
