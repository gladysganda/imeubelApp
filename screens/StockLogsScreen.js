// screens/StockLogsScreen.js
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { db } from "../firebase";

function parseYMD(s) {
  // Accepts "YYYY-MM-DD"
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function StockLogsScreen() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  // filters
  const [typeFilter, setTypeFilter] = useState("all"); // 'all' | 'incoming' | 'outgoing'
  const [fromDate, setFromDate] = useState("");        // YYYY-MM-DD
  const [toDate, setToDate] = useState("");            // YYYY-MM-DD
  const [specificDate, setSpecificDate] = useState(""); // quick exact date

  useEffect(() => {
    const qy = query(collection(db, "stockLogs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.log("logs error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let start = parseYMD(fromDate);
    let end = parseYMD(toDate);
    const exact = parseYMD(specificDate);

    return logs.filter((item) => {
      // type filter
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      // timestamp normalize
      const ts =
        item.timestamp?.toDate?.() instanceof Date
          ? item.timestamp.toDate()
          : item.timestamp?.seconds
          ? new Date(item.timestamp.seconds * 1000)
          : item.timestamp instanceof Date
          ? item.timestamp
          : null;

      if (!ts) return true; // if missing timestamp, keep it visible

      // specific date wins (match same calendar day)
      if (exact) {
        const a = new Date(exact.getFullYear(), exact.getMonth(), exact.getDate());
        const b = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
        if (a.getTime() !== b.getTime()) return false;
        return true;
      }

      // range filter
      if (start && ts < start) return false;
      if (end) {
        // include the whole end day (23:59:59)
        const endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
        if (ts > endInclusive) return false;
      }

      return true;
    });
  }, [logs, typeFilter, fromDate, toDate, specificDate]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading logs…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filters}>
        <View style={styles.row}>
          <Text style={styles.filterLabel}>Type</Text>
          <View style={styles.chips}>
            {["all", "incoming", "outgoing"].map((t) => (
              <Text
                key={t}
                onPress={() => { setTypeFilter(t); setSpecificDate(""); }}
                style={[styles.chip, typeFilter === t && styles.chipOn]}
              >
                {t.toUpperCase()}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.filterLabel}>From (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={fromDate}
            onChangeText={(v) => { setFromDate(v); setSpecificDate(""); }}
            placeholder="e.g. 2025-08-01"
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.filterLabel}>To (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={toDate}
            onChangeText={(v) => { setToDate(v); setSpecificDate(""); }}
            placeholder="e.g. 2025-08-31"
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.filterLabel}>Specific date</Text>
          <TextInput
            style={styles.input}
            value={specificDate}
            onChangeText={(v) => { setSpecificDate(v); }}
            placeholder="e.g. 2025-08-26"
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => {
          const when =
            item.timestamp?.toDate?.() instanceof Date
              ? item.timestamp.toDate()
              : item.timestamp?.seconds
              ? new Date(item.timestamp.seconds * 1000)
              : item.timestamp instanceof Date
              ? item.timestamp
              : null;

          return (
            <View style={styles.card}>
              <Text style={styles.title}>
                {item.type?.toUpperCase()} • {item.productName || item.productId}
              </Text>
              {item.category ? <Text>Category: {item.category}</Text> : null}
              {item.brand ? <Text>Brand: {item.brand}</Text> : null}
              {item.sizes ? <Text>Sizes: {item.sizes}</Text> : null}
              <Text>Qty: {item.quantity}</Text>
              {item.staffName ? <Text>Staff: {item.staffName}</Text> : null}
              {item.handledByEmail ? <Text>By: {item.handledByEmail}</Text> : null}
              {item.clientName ? <Text>Client: {item.clientName}</Text> : null}
              {item.clientAddress ? <Text>Address: {item.clientAddress}</Text> : null}
              {item.supplierName ? <Text>Supplier: {item.supplierName}</Text> : null}
              {item.note ? <Text>Note: {item.note}</Text> : null}
              {when ? <Text>Time: {when.toLocaleString?.() || String(when)}</Text> : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  filters: { marginBottom: 10, padding: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 10 },
  row: { marginBottom: 8 },
  filterLabel: { fontWeight: "700", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, backgroundColor: "#fff" },
  chips: { flexDirection: "row", gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: "#eee", color: "#333", overflow: "hidden" },
  chipOn: { backgroundColor: "#1565C0", color: "#fff" },
  card: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#eee", marginBottom: 10, backgroundColor: "#fff" },
  title: { fontWeight: "700", marginBottom: 6 },
});
