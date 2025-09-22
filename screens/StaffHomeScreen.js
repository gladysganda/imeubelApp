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

  const go = (name, params) => navigation.navigate(name, params);

  const tiles = [
    {
      label: "View Stock",
      color: "#4CAF50",
      icon: "cube-outline",
      onPress: () => go("StockListScreen", { role: "staff" }),
    },
    {
      label: "Add New Product",
      color: "#2196F3",
      icon: "add-circle-outline",
      onPress: () => go("AddItemScreen", { role: "staff" }),
    },
    {
      label: "Lookup Product",
      color: "#9C27B0",
      icon: "search-outline",
      onPress: () => go("LookUpProductScreen", { mode: "lookup", role: "staff" }),
    },
    {
      label: "Scan Outgoing Stock",
      color: "#FF9800",
      icon: "qr-code-outline",
      onPress: () => go("ScanOutgoingScreen", { role: "staff", mode: "outgoing" }),
    },
    {
      label: "Select Bluetooth Printer",
      color: "#1565C0",
      icon: "bluetooth-outline",
      onPress: () => go("PrinterSelectScreen", { backTo: "PrintLabelScreen" }),
    },
    // --- Customer / Sales for staff ---
    {
      label: "Customers",
      color: "#5C6BC0",
      icon: "people-outline",
      onPress: () => go("CustomerListScreen"),
    },
    {
      label: "Create Sale",
      color: "#8BC34A",
      icon: "cash-outline",
      onPress: () => go("CreateSaleScreen"),
    },
    {
      label: "Sales List",               // 👈 ADDED
      color: "#607D8B",
      icon: "receipt-outline",
      onPress: () => go("SalesListScreen"),
    },
    {
      label: "Pending Reservations",
      color: "#795548",
      icon: "time-outline",
      onPress: () => go("PendingReservationsScreen"),
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Staff Dashboard</Text>

      <View style={styles.grid}>
        {tiles.map((t) => (
          <TouchableOpacity
            key={t.label}
            style={[styles.tile, { backgroundColor: t.color }]}
            onPress={t.onPress}
          >
            <Ionicons name={t.icon} size={22} color="#fff" />
            <Text style={styles.tileText}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.tile, styles.signOut]} onPress={signOut}>
        <Ionicons name="log-out-outline" size={22} color="#fff" />
        <Text style={styles.tileText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 14 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  tile: {
    width: "48%",                // two per row, responsive
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    elevation: 1,
  },
  tileText: { color: "#fff", fontSize: 15, fontWeight: "600", flexShrink: 1 },
  signOut: { backgroundColor: "#455A64", width: "100%", justifyContent: "center" },
});
