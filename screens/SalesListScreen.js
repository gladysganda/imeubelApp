// screens/SalesListScreen.js
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "../firebase";
import {
  setShipmentDate,
  markOrderDone,
  addPayment,
} from "../utils/salesOrderActions";

function fmt(n) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
  }
}

export default function SalesListScreen() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all"); // NEW: tabs
  const [reservationsByOrder, setReservationsByOrder] = useState({});

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Shipment modal state
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [shipmentQty, setShipmentQty] = useState("");
  const [shipmentDate, setShipmentDate] = useState(new Date());
  const [showShipDatePicker, setShowShipDatePicker] = useState(false);

  // --- Load orders live ---
  useEffect(() => {
    const qy = query(collection(db, "salesOrders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(arr);
    });
    return () => unsub();
  }, []);

  // --- Load reservations grouped by order ---
  useEffect(() => {
    const loadReservations = async () => {
      const snap = await getDocs(collection(db, "reservations"));
      const m = {};
      snap.forEach((d) => {
        const r = d.data();
        const oid = r.orderId;
        if (!oid) return;
        if (!m[oid]) m[oid] = [];
        m[oid].push({ id: d.id, ...r });
      });
      setReservationsByOrder(m);
    };
    loadReservations();
  }, [orders]);

  // --- Filter ---
  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase();
    const todayStr = new Date().toISOString().slice(0, 10);

    return orders.filter((o) => {
      const txt = [
        o.customerName || "",
        ...(Array.isArray(o.items) ? o.items.map((i) => i.productName || "") : []),
      ]
        .join(" ")
        .toLowerCase();
      if (q && !txt.includes(q)) return false;

      if (category === "pending" && o.status === "pending") return true;
      if (category === "shippedToday" && o.shipmentDate === todayStr) return true;
      if (category === "future" && o.shipmentDate > todayStr) return true;
      if (category === "done" && o.status === "done") return true;
      if (category === "all") return true;

      return false;
    });
  }, [orders, search, category]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const o of filtered) {
      const key = o.customerName || "Unknown";
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(o);
    }
    return Array.from(m.entries());
  }, [filtered]);

  // --- Payment Handlers ---
  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    setPaymentAmount("");
    setPaymentType("");
    setPaymentDate(new Date());
    setShowPaymentModal(true);
  };

  const confirmAddPayment = async () => {
    if (!selectedOrder) return;
    const amt = Number(paymentAmount || 0);
    if (!amt || amt <= 0) {
      Alert.alert("Validation", "Enter valid amount");
      return;
    }
    try {
      await addPayment(db, selectedOrder.id, {
        amount: amt,
        type: paymentType || "cash",
        date: paymentDate.toISOString().slice(0, 10),
      });
      setShowPaymentModal(false);
      Alert.alert("Success", "Payment added");
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to add payment");
    }
  };

  // --- Shipment Handlers ---
  const openShipmentModal = (order, item) => {
    setSelectedOrder(order);
    setSelectedItem(item);
    setShipmentQty("");
    setShipmentDate(new Date());
    setShowShipmentModal(true);
  };

  const confirmAddShipment = async () => {
    if (!selectedOrder || !selectedItem) return;
    const qty = Number(shipmentQty || 0);
    if (!qty || qty <= 0) {
      Alert.alert("Validation", "Enter valid shipment qty");
      return;
    }

    try {
      const ref = doc(db, "salesOrders", selectedOrder.id);
      const newShip = {
        qty,
        date: shipmentDate.toISOString().slice(0, 10),
        status: "pending",
      };
      const updatedItems = (selectedOrder.items || []).map((it) => {
        if (it.productId === selectedItem.productId) {
          const current = Array.isArray(it.shipments) ? it.shipments : [];
          return { ...it, shipments: [...current, newShip] };
        }
        return it;
      });
      await updateDoc(ref, {
        items: updatedItems,
        updatedAt: serverTimestamp(),
        shipmentDate: newShip.date, // NEW: top-level date for category filter
      });

      await addDoc(collection(db, "reservations"), {
        orderId: selectedOrder.id,
        customerId: selectedOrder.customerId || null,
        customerName: selectedOrder.customerName || "",
        productId: selectedItem.productId,
        productName: selectedItem.productName,
        qty,
        shipmentDate: newShip.date,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setShowShipmentModal(false);
      Alert.alert("Success", "Shipment scheduled");
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to add shipment");
    }
  };

  // --- Render ---
  const renderOrder = (o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const reservations = reservationsByOrder[o.id] || [];
    const allFulfilled = reservations.length
      ? reservations.every((r) => r.status === "fulfilled" || r.status === "shipped")
      : false;

    return (
      <View key={o.id} style={styles.orderCard}>
        <Text style={styles.orderTitle}>
          Order #{o.id.slice(0, 6)} — {o.status || "pending"}
        </Text>
        {o.shipmentDate ? <Text>Shipment date: {o.shipmentDate}</Text> : null}

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Product</Text>
          <Text style={styles.th}>Qty</Text>
          <Text style={styles.th}>Price</Text>
          <Text style={styles.th}>Subtotal</Text>
        </View>
        {items.map((it, idx) => (
          <View key={idx} style={[styles.tableRow, { alignItems: "center" }]}>
            <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
              {it.productName}
              {it.size ? ` (${it.size})` : ""}
            </Text>
            <Text style={styles.td}>{it.qty}</Text>
            <Text style={styles.td}>{fmt(it.price)}</Text>
            <Text style={styles.td}>{fmt(it.subtotal)}</Text>
            <TouchableOpacity
              style={styles.shipBtn}
              onPress={() => openShipmentModal(o, it)}
            >
              <Text style={{ color: "#fff", fontSize: 12 }}>Add Shipment</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={{ flex: 1 }} />
          <Text style={{ fontWeight: "700" }}>
            Total: {fmt(o?.totals?.subTotal || 0)}
          </Text>
        </View>
        <Text>Down Payment: {fmt(o?.totals?.downPayment || 0)}</Text>
        <Text>Remaining: {fmt(o?.totals?.remaining || 0)}</Text>

        {Array.isArray(o.payments) && o.payments.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontWeight: "700" }}>Payments:</Text>
            {o.payments.map((p, idx) => (
              <Text key={idx} style={{ fontSize: 12, color: "#444" }}>
                {p.date} • {p.type} • {fmt(p.amount)}
              </Text>
            ))}
          </View>
        )}

        <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
          <Button title="Add Payment" onPress={() => openPaymentModal(o)} color="#4CAF50" />
          {allFulfilled ? (
            <Button
              title="Mark Done"
              onPress={() => markOrderDone(db, o.id, o.shipmentDate || null)}
            />
          ) : (
            <Text style={{ color: "#999", marginTop: 6 }}>
              (Order has pending reservations)
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* NEW: Category Tabs */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", padding: 10 }}>
        {["all", "pending", "shippedToday", "future", "done"].map((c) => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)}>
            <Text style={{ fontWeight: category === c ? "700" : "400" }}>
              {c === "all"
                ? "All"
                : c === "pending"
                ? "Pending"
                : c === "shippedToday"
                ? "Today"
                : c === "future"
                ? "To Be Shipped"
                : "Done"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={{ padding: 16 }}>
            <Text style={styles.title}>Sales</Text>
            <TextInput
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              placeholder="Search customer or product…"
              autoCapitalize="none"
            />
          </View>
        }
        data={grouped}
        keyExtractor={([name]) => name || "unknown"}
        renderItem={({ item: [customer, list] }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={styles.customer}>{customer}</Text>
            {list.map(renderOrder)}
          </View>
        )}
      />

      {/* Shipment Modal */}
      <Modal visible={showShipmentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Shipment</Text>
            <TextInput
              style={styles.input}
              placeholder="Quantity"
              keyboardType="numeric"
              value={shipmentQty}
              onChangeText={setShipmentQty}
            />
            <Button
              title={shipmentDate.toLocaleDateString()}
              onPress={() => setShowShipDatePicker(true)}
            />
            {showShipDatePicker && (
              <DateTimePicker
                value={shipmentDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_, d) => {
                  setShowShipDatePicker(false);
                  if (d) setShipmentDate(d);
                }}
              />
            )}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <Button title="Cancel" onPress={() => setShowShipmentModal(false)} />
              <Button title="Save" onPress={confirmAddShipment} color="#1976D2" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Payment</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Type (cash, transfer-bca, ...)"
              value={paymentType}
              onChangeText={setPaymentType}
            />
            <Button
              title={paymentDate.toLocaleDateString()}
              onPress={() => setShowDatePicker(true)}
            />
            {showDatePicker && (
              <DateTimePicker
                value={paymentDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setPaymentDate(d);
                }}
              />
            )}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <Button title="Cancel" onPress={() => setShowPaymentModal(false)} />
              <Button title="Save" onPress={confirmAddPayment} color="#4CAF50" />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  customer: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  orderCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  orderTitle: { fontWeight: "700", marginBottom: 6 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: "row", paddingVertical: 4 },
  th: { flex: 1, fontWeight: "700" },
  td: { flex: 1 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 4,
  },
  shipBtn: {
    marginLeft: 8,
    backgroundColor: "#1976D2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "90%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
});

