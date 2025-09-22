// screens/PendingReservationsScreen.js
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { collection, getDocs, orderBy, query, where, startAt, endAt, limit } from "firebase/firestore";
import { db } from "../firebase";

export default function PendingReservationsScreen({ route, navigation }) {
  const initialProductId = route?.params?.productId || "";
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [qtext, setQtext] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const col = collection(db, "reservations");
      let qy = query(col, where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(200));
      // Basic filtering by product
      const all = await getDocs(qy);
      const list = all.docs.map(d => ({ id: d.id, ...d.data() }));
      const s = qtext.trim().toLowerCase();

      const filtered = list.filter(r => {
        if (initialProductId && String(r.productId) !== String(initialProductId)) return false;
        if (!s) return true;
        const hay =
          (r.productName || "") + " " +
          (r.customerName || "") + " " +
          (r.size || "") + " " +
          (r.orderId || "");
        return hay.toLowerCase().includes(s);
      });

      setRows(filtered);
    } catch (e) {
      console.log("pending reservations load error", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [initialProductId]); // reload when navigating with a different product

  const openSale = (orderId) => {
    if (!orderId) return;
    navigation.navigate("SalesDetailScreen", { saleId: orderId });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Pending Reservations</Text>

      <TextInput
        style={styles.input}
        value={qtext}
        onChangeText={setQtext}
        placeholder="Search product / customer / order id…"
        autoCapitalize="none"
        onSubmitEditing={load}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator /><Text>Loading…</Text></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openSale(item.orderId)}>
              <Text style={styles.name}>{item.productName}{item.size ? ` • ${item.size}` : ""}</Text>
              <Text>Customer: {item.customerName || "-"}</Text>
              <Text>Qty: {item.qty}</Text>
              {!!item.orderId && <Text>Order: #{String(item.orderId).slice(-6).toUpperCase()}</Text>}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<Text style={{ color: "#666" }}>No pending reservations found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff", padding: 16 },
  center: { alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff", marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, backgroundColor: "#fff" },
  name: { fontWeight: "700", marginBottom: 4 },
});
