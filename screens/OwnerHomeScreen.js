import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function OwnerHomeScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Owner Dashboard</Text>

      {/* View / Manage Stock */}
      <TouchableOpacity
        style={styles.buttonGreen}
        onPress={() => navigation.navigate("StockListScreen", { role: "owner" })}
      >
        <Ionicons name="cube-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>View / Manage Stock</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.buttonGreen}
        onPress={() => navigation.navigate("BarcodeTestScreen")}
      >
        <Ionicons name="cube-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>View / Manage Stock</Text>
      </TouchableOpacity>
      
      {/* Add Product */}
      <TouchableOpacity
        style={styles.buttonBlue}
        onPress={() => navigation.navigate("AddItemScreen", { role: "owner" })}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Add New Product</Text>
      </TouchableOpacity>

      {/* Incoming Stock (via barcode) */}
      <TouchableOpacity
        style={styles.buttonPurple}
        onPress={() => navigation.navigate("ScanIncomingScreen", { role: "owner" })}
      >
        <Ionicons name="barcode-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Scan Incoming Stock</Text>
      </TouchableOpacity>

      {/* Outgoing Stock (via barcode) */}
      <TouchableOpacity
        style={styles.buttonOrange}
        onPress={() => navigation.navigate("ScanOutgoingScreen", { role: "owner" })}
      >
        <Ionicons name="qr-code-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Scan Outgoing Stock</Text>
      </TouchableOpacity>

      {/* Owner-only sections */}
      <TouchableOpacity
        style={styles.buttonRed}
        onPress={() => navigation.navigate("OrdersScreen")}
      >
        <Ionicons name="receipt-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Orders</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.buttonRed}
        onPress={() => navigation.navigate("UpcomingBillsScreen")}
      >
        <Ionicons name="card-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Upcoming Bills</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  buttonGreen: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonBlue: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonPurple: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9C27B0",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonOrange: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF9800",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonRed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F44336",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: { color: "#fff", fontSize: 16, marginLeft: 10 },
});
