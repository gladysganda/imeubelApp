// screens/StaffHomeScreen.js
import { Ionicons } from "@expo/vector-icons";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../firebase";

export default function StaffHomeScreen({ navigation }) {
  const signOut = async () => {
    try {
      await auth.signOut();
      navigation.replace("Login");
    } catch (e) {
      Alert.alert("Sign out failed", e?.message || "Unexpected error");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Staff Dashboard</Text>

      <TouchableOpacity style={styles.buttonGreen} onPress={() => navigation.navigate("StockListScreen", { role: "staff" })}>
        <Ionicons name="cube-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>View Stock</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonBlue} onPress={() => navigation.navigate("AddItemScreen", { role: "staff" })}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Add New Product</Text>
      </TouchableOpacity>

      {/* <TouchableOpacity style={styles.buttonPurple} onPress={() => navigation.navigate("ScanIncomingScreen", { role: "staff" })}>
        <Ionicons name="barcode-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Scan Incoming Stock</Text>
      </TouchableOpacity> */}

      <TouchableOpacity
        style={styles.buttonPurple}
        onPress={() => navigation.navigate("LookupProductScreen", { role: "owner" })}
      >
        <Ionicons name="search-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Lookup Product</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonOrange} onPress={() => navigation.navigate("ScanOutgoingScreen", { role: "staff" })}>
        <Ionicons name="qr-code-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Scan Outgoing Stock</Text>
      </TouchableOpacity>

      {/* 👇 NEW: pick a paired Bluetooth printer on Android */}
      <TouchableOpacity
        style={[styles.buttonBlue, { backgroundColor: "#1565C0" }]}
        onPress={() => navigation.navigate("PrinterSelectScreen", { backTo: "PrintLabelScreen" })}
      >
        <Ionicons name="bluetooth-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Select Bluetooth Printer</Text>
      </TouchableOpacity>

      <View style={{ height: 16 }} />
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  buttonGreen: { flexDirection: "row", alignItems: "center", backgroundColor: "#4CAF50", padding: 15, borderRadius: 8, marginBottom: 10 },
  buttonBlue: { flexDirection: "row", alignItems: "center", backgroundColor: "#2196F3", padding: 15, borderRadius: 8, marginBottom: 10 },
  buttonPurple: { flexDirection: "row", alignItems: "center", backgroundColor: "#9C27B0", padding: 15, borderRadius: 8, marginBottom: 10 },
  buttonOrange: { flexDirection: "row", alignItems: "center", backgroundColor: "#FF9800", padding: 15, borderRadius: 8, marginBottom: 10 },
  signOutButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#455A64", padding: 15, borderRadius: 8 },
  buttonText: { color: "#fff", fontSize: 16, marginLeft: 10 },
});
