import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function StaffHomeScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Staff Dashboard</Text>

      {/* View Stock (Read-only) */}
      <TouchableOpacity
        style={styles.buttonGreen}
        onPress={() => navigation.navigate("StockListScreen", { role: "staff" })}
      >
        <Ionicons name="cube-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>View Stock</Text>
      </TouchableOpacity>

      {/* Add Incoming Stock */}
      <TouchableOpacity
        style={styles.buttonBlue}
        onPress={() => navigation.navigate("AddItemScreen", { role: "staff" })}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Add Incoming Stock</Text>
      </TouchableOpacity>

      {/* Scan Incoming Stock */}
      <TouchableOpacity
        style={styles.buttonPurple}
        onPress={() => navigation.navigate("ScanIncomingScreen", { role: "staff" })}
      >
        <Ionicons name="barcode-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Scan Incoming Stock</Text>
      </TouchableOpacity>

      {/* Scan Outgoing Stock */}
      <TouchableOpacity
        style={styles.buttonOrange}
        onPress={() => navigation.navigate("ScanOutgoingScreen", { role: "staff" })}
      >
        <Ionicons name="qr-code-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Scan Outgoing Stock</Text>
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
  buttonText: { color: "#fff", fontSize: 16, marginLeft: 10 },
});
