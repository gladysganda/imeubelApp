// screens/CustomerDetailScreen.js
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { db } from "../firebase";

function money(n) {
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

export default function CustomerDetailScreen({ route }) {
  const { customerId, name } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!customerId) return;
    const qy = query(
      collection(db, "salesOrders"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.log("customer orders error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [customerId]);

  const totalSpent = useMemo(
    () => orders.reduce((a, o) => a + Number(o?.totals?.subTotal || 0), 0),
    [orders]
  );

  if (!customerId)
    return (
      <View style={styles.center}>
        <Text>No customer id.</Text>
      </View>
    );
  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading…</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name || "Customer"}</Text>
      <Text style={{ marginBottom: 8 }}>
        Total orders: {orders.length} • Sum: {money(totalSpent)}
      </Text>

      <FlatList
        data={orders}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.orderTitle}>
              #{item.id.slice(0, 6)} — {item.status || "pending"}
            </Text>
            {item.shipmentDate ? <Text>Shipment: {item.shipmentDate}</Text> : null}
            {item.paymentType ? <Text>Payment: {item.paymentType}</Text> : null}

            {/* Items table */}
            <Text style={{ marginTop: 6, fontWeight: "700" }}>Items</Text>
            <View style={styles.table}>
              <View style={[styles.row, styles.header]}>
                <Text style={[styles.cell, { flex: 2 }]}>Product</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>Qty</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>Price</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>Subtotal</Text>
              </View>
              {(item.items || []).map((it, idx) => (
                <View key={idx} style={styles.row}>
                  <Text style={[styles.cell, { flex: 2 }]}>
                    {it.productName}
                    {it.size ? ` (${it.size})` : ""}
                  </Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>
                    {it.qty}
                  </Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>
                    {money(it.price)}
                  </Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>
                    {money(it.subtotal)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Shipments per item */}
            {(item.items || []).map((it, idx) =>
              Array.isArray(it.shipments) && it.shipments.length > 0 ? (
                <View key={`ship-${idx}`} style={{ marginTop: 6 }}>
                  <Text style={{ fontWeight: "700" }}>
                    Shipments for {it.productName}
                  </Text>
                  {it.shipments.map((s, j) => (
                    <Text key={j} style={{ fontSize: 12, color: "#444" }}>
                      {s.date} • Qty: {s.qty} • {s.status}
                    </Text>
                  ))}
                </View>
              ) : null
            )}

            {/* Payments history */}
            {Array.isArray(item.payments) && item.payments.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontWeight: "700" }}>Payments</Text>
                {item.payments.map((p, idx) => (
                  <Text key={idx} style={{ fontSize: 12, color: "#444" }}>
                    {p.date} • {p.type} • {money(p.amount)}
                  </Text>
                ))}
              </View>
            )}

            <Text style={{ marginTop: 6 }}>
              Sub total: {money(item?.totals?.subTotal)}
            </Text>
            <Text>Down payment: {money(item?.totals?.downPayment)}</Text>
            <Text>Remaining: {money(item?.totals?.remaining)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  orderTitle: { fontWeight: "700" },
  table: { marginTop: 6, borderWidth: 1, borderColor: "#eee", borderRadius: 8 },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  header: { backgroundColor: "#fafafa" },
  cell: { fontSize: 12 },
});
