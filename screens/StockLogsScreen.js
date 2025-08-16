import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { db } from "../firebase";

export default function StockLogsScreen() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedLogs = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLogs(fetchedLogs);
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    };

    fetchLogs();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.logItem}>
      <Text style={styles.date}>
        {item.timestamp?.toDate().toLocaleString()}
      </Text>
      <Text style={styles.type}>
        {item.type === "incoming" ? "📦 Incoming" : "🚚 Outgoing"}
      </Text>
      <Text style={styles.product}>Product: {item.productName}</Text>
      <Text>Quantity: {item.quantity}</Text>
      <Text>Staff: {item.staffName}</Text>
      {item.type === "outgoing" && (
        <Text>Client: {item.clientName}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Stock Logs</Text>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  logItem: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  date: { fontSize: 12, color: "#666" },
  type: { fontWeight: "bold", marginTop: 4 },
  product: { marginTop: 4 },
});
