// screens/SalesDetailScreen.js
import React, { useEffect, useState, useMemo } from "react";
import { Alert, ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from "react-native";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";

function money(n) {
  const v = Number(n) || 0;
  try { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v); }
  catch { return `Rp ${Math.round(v).toLocaleString("id-ID")}`; }
}

export default function SalesDetailScreen({ route, navigation }) {
  const { saleId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (!saleId) return;
        const snap = await getDoc(doc(db, "salesOrders", String(saleId)));
        if (snap.exists()) {
          setSale({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.log("load sale error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  const totals = useMemo(() => {
    const sub = Number(sale?.totals?.subTotal || 0);
    const dp = Number(sale?.totals?.downPayment || 0);
    const remaining = Number(sale?.totals?.remaining ?? Math.max(sub - dp, 0));
    return { sub, dp, remaining };
  }, [sale]);

  const markCompleted = async () => {
    try {
      if (!sale?.id) return;
      // 1) Update order status
      await updateDoc(doc(db, "salesOrders", sale.id), {
        status: "completed",
        updatedAt: serverTimestamp(),
      });
      // 2) Close all reservations of this order
      const qy = query(collection(db, "reservations"), where("orderId", "==", sale.id), where("status", "==", "pending"));
      const snap = await getDocs(qy);
      const batchUpdates = [];
      for (const d of snap.docs) {
        batchUpdates.push(updateDoc(doc(db, "reservations", d.id), { status: "fulfilled", updatedAt: serverTimestamp() }));
      }
      await Promise.all(batchUpdates);
      Alert.alert("Done", "Order marked completed and reservations fulfilled.");
      navigation.goBack();
    } catch (e) {
      console.log("complete error", e);
      Alert.alert("Error", e?.message || "Failed to mark completed.");
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /><Text>Loading sale…</Text></View>;
  }
  if (!sale) {
    return <View style={styles.center}><Text>Sale not found.</Text></View>;
  }

  const when =
    sale.createdAt?.toDate?.() instanceof Date
      ? sale.createdAt.toDate()
      : sale.createdAt?.seconds
      ? new Date(sale.createdAt.seconds * 1000)
      : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sale #{String(sale.id).slice(-6).toUpperCase()}</Text>
      <Text>Status: {sale.status || "pending"}</Text>
      {when ? <Text>Time: {when.toLocaleString?.() || String(when)}</Text> : null}

      <View style={styles.hr} />
      <Text style={styles.section}>Customer</Text>
      <Text>{sale.customerName}</Text>
      {!!sale.customerPhone && <Text>📱 {sale.customerPhone}</Text>}
      {!!sale.customerAddress && <Text>🏠 {sale.customerAddress}</Text>}

      <View style={styles.hr} />
      <Text style={styles.section}>Items</Text>
      <FlatList
        data={Array.isArray(sale.items) ? sale.items : []}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.productName}{item.size ? ` • ${item.size}` : ""}</Text>
            <Text>Qty: {item.qty}  •  Price: {money(item.price)}</Text>
            <Text>Subtotal: {money(Number(item.subtotal || (item.qty * item.price)))}</Text>
            {item.isCustom ? <Text style={{ color: "#8D6E63" }}>Custom item</Text> : null}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <View style={styles.hr} />
      <Text style={styles.section}>Payment</Text>
      <Text>Total: {money(totals.sub)}</Text>
      <Text>Down Payment: {money(totals.dp)}</Text>
      <Text>Remaining: {money(totals.remaining)}</Text>

      <View style={{ height: 10 }} />
      {sale.status !== "completed" ? (
        <Button title="Mark Completed (fulfill reservations)" onPress={markCompleted} />
      ) : (
        <Text style={{ fontWeight: "700", color: "#2E7D32" }}>Completed ✓</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  hr: { height: 1, backgroundColor: "#eee", marginVertical: 10 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 10, backgroundColor: "#fff" },
  name: { fontWeight: "700", marginBottom: 2 },
});
