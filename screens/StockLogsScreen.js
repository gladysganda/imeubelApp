// screens/StockLogsScreen.js
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "../firebase";

function parseYMD(s) {
  // Accepts "YYYY-MM-DD"
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatYMD(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function StockLogsScreen() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  // existing filters (kept)
  const [typeFilter, setTypeFilter] = useState("all"); // 'all' | 'incoming' | 'outgoing'
  const [fromDate, setFromDate] = useState("");        // YYYY-MM-DD
  const [toDate, setToDate] = useState("");            // YYYY-MM-DD
  const [specificDate, setSpecificDate] = useState(""); // quick exact date

  // NEW: product name search (case-insensitive)
  const [searchName, setSearchName] = useState("");

  // NEW: date pickers
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showSpecificPicker, setShowSpecificPicker] = useState(false);

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
    const needle = searchName.trim().toLowerCase();

    return logs.filter((item) => {
      // type filter (unchanged)
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      // name filter (NEW)
      if (needle) {
        const nameLower =
          (typeof item.productNameLower === "string" && item.productNameLower) ||
          (typeof item.productName === "string" && item.productName.toLowerCase()) ||
          "";
        if (!nameLower.includes(needle)) return false;
      }

      // timestamp normalize (unchanged)
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

      // range filter (unchanged)
      if (start && ts < start) return false;
      if (end) {
        // include the whole end day (23:59:59)
        const endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
        if (ts > endInclusive) return false;
      }

      return true;
    });
  }, [logs, typeFilter, fromDate, toDate, specificDate, searchName]);

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
        {/* NEW: product name search */}
        <View style={styles.row}>
          <Text style={styles.filterLabel}>Search product name</Text>
          <TextInput
            style={styles.input}
            value={searchName}
            onChangeText={setSearchName}
            placeholder="e.g. Lemari Pakaian"
            autoCapitalize="none"
          />
        </View>

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

        {/* From Date with picker */}
        <View style={styles.row}>
          <Text style={styles.filterLabel}>From (YYYY-MM-DD)</Text>
          <View style={styles.hstack}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={fromDate}
              onChangeText={(v) => { setFromDate(v); setSpecificDate(""); }}
              placeholder="e.g. 2025-08-01"
            />
            <View style={{ width: 8 }} />
            <Button title="📅" onPress={() => setShowFromPicker(true)} />
            <View style={{ width: 6 }} />
            <Button title="✖" onPress={() => setFromDate("")} />
          </View>
          {showFromPicker && (
            <DateTimePicker
              value={parseYMD(fromDate) || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, d) => {
                setShowFromPicker(false);
                if (d) {
                  const ymd = formatYMD(d);
                  setFromDate(ymd);
                  setSpecificDate("");
                }
              }}
            />
          )}
        </View>

        {/* To Date with picker */}
        <View style={styles.row}>
          <Text style={styles.filterLabel}>To (YYYY-MM-DD)</Text>
          <View style={styles.hstack}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={toDate}
              onChangeText={(v) => { setToDate(v); setSpecificDate(""); }}
              placeholder="e.g. 2025-08-31"
            />
            <View style={{ width: 8 }} />
            <Button title="📅" onPress={() => setShowToPicker(true)} />
            <View style={{ width: 6 }} />
            <Button title="✖" onPress={() => setToDate("")} />
          </View>
          {showToPicker && (
            <DateTimePicker
              value={parseYMD(toDate) || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, d) => {
                setShowToPicker(false);
                if (d) {
                  const ymd = formatYMD(d);
                  setToDate(ymd);
                  setSpecificDate("");
                }
              }}
            />
          )}
        </View>

        {/* Specific Date with picker */}
        <View style={styles.row}>
          <Text style={styles.filterLabel}>Specific date</Text>
          <View style={styles.hstack}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={specificDate}
              onChangeText={(v) => { setSpecificDate(v); }}
              placeholder="e.g. 2025-08-26"
            />
            <View style={{ width: 8 }} />
            <Button title="📅" onPress={() => setShowSpecificPicker(true)} />
            <View style={{ width: 6 }} />
            <Button title="✖" onPress={() => setSpecificDate("")} />
          </View>
          {showSpecificPicker && (
            <DateTimePicker
              value={parseYMD(specificDate) || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, d) => {
                setShowSpecificPicker(false);
                if (d) {
                  const ymd = formatYMD(d);
                  setSpecificDate(ymd);
                }
              }}
            />
          )}
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
  hstack: { flexDirection: "row", alignItems: "center" }
});
