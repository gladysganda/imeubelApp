// OwnerHomeScreen.js
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db, auth } from "../firebase";
import { addDoc, collection, doc, serverTimestamp } from "firebase/firestore";

export default function OwnerHomeScreen({ navigation }) {
  const go = (name, params) => navigation.navigate(name, params);

  const tiles = [
    {
      label: "View / Manage Stock",
      color: "#4CAF50",
      icon: "cube-outline",
      onPress: () => go("StockListScreen", { role: "owner" }),
    },
    {
      label: "Add New Product",
      color: "#2196F3",
      icon: "add-circle-outline",
      onPress: () => go("AddItemScreen", { role: "owner" }),
    },
    {
      label: "Lookup Product",
      color: "#9C27B0",
      icon: "search-outline",
      onPress: () => go("LookUpProductScreen", { mode: "lookup", role: "owner" }),
    },
    {
      label: "Scan Outgoing Stock",
      color: "#FF9800",
      icon: "qr-code-outline",
      onPress: () => go("ScanOutgoingScreen", { role: "owner", mode: "outgoing" }),
    },
    {
      label: "Transfer Stock",
      color: "#009688",
      icon: "swap-horizontal-outline",
      onPress: () => go("TransferStockScreen"),
    },
    {
      label: "Stock Logs",
      color: "#F44336",
      icon: "list-outline",
      onPress: () => go("StockLogsScreen"),
    },
    // --- Customer / Sales ---
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
    // --- Existing ---
    {
      label: "Upcoming Bills",
      color: "#E91E63",
      icon: "card-outline",
      onPress: () => go("UpcomingBillsScreen"),
    },
  ];

  const doSignOut = async () => {
    try {
      await signOut(auth);
      navigation.replace("Login");
    } catch (e) {
      console.log("signout error", e);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Owner Dashboard</Text>

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

      <TouchableOpacity style={[styles.tile, styles.signOut]} onPress={doSignOut}>
        <Ionicons name="log-out-outline" size={22} color="#fff" />
        <Text style={styles.tileText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

async function debugSalesWriteOnce() {
  console.log("[DEBUG uid]", auth.currentUser?.uid);

  try {
    await addDoc(collection(db, "customers"), { test: true, at: serverTimestamp() });
    console.log("OK customers ✅");
  } catch (e) {
    console.log("FAIL customers ❌", e.code, e.message);
    return;
  }

  try {
    const orderRef = await addDoc(collection(db, "salesOrders"), {
      customerName: "Debug",
      items: [],
      status: "pending",
      createdAt: serverTimestamp(),
    });
    console.log("OK salesOrders ✅", orderRef.id);

    await addDoc(collection(orderRef, "items"), { name: "X", qty: 1, price: 0 });
    console.log("OK salesOrders/items ✅");
  } catch (e) {
    console.log("FAIL salesOrders ❌", e.code, e.message);
    return;
  }

  const productId = "PUT_AN_EXISTING_PRODUCT_ID_HERE"; // replace with a real product id from your products collection
  try {
    await addDoc(collection(doc(db, "products", productId), "reservations"), {
      orderId: "debug",
      qty: 1,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    console.log("OK products/{id}/reservations ✅");
  } catch (e) {
    console.log("FAIL products/{id}/reservations ❌", e.code, e.message);
    return;
  }

  console.log("ALL DEBUG WRITES OK 🎉");
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
    label: "⚡ Debug Write",
    color: "#000000",
    icon: "bug-outline",
    onPress: () => debugSalesWriteOnce(),
  },
  tileText: { color: "#fff", fontSize: 15, fontWeight: "600", flexShrink: 1 },
  signOut: { backgroundColor: "#455A64", width: "100%", justifyContent: "center" },
});
