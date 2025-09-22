// screens/ScanOutgoingScreen.js
import { useEffect, useState } from "react";
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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { CameraView, useCameraPermissions } from "expo-camera";
import { db, auth } from "../firebase";
import CustomerAutocomplete from "@/components/CustomerAutocomplete";
import { decQtyPatch } from "../utils/inventory";

// staff names
const STAFF_NAMES = ["Annie", "Riri", "Yuni", "Agus", "Salman"];

// payment types
const PAYMENT_TYPES = ["Cash", "BNI", "BRI", "BCA", "BSI", "Mandiri"];

function fmt(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function ScanOutgoingScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();

  // customer + orders
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [orderItems, setOrderItems] = useState([]);

  // scanning modal
  const [showScanner, setShowScanner] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);

  // scanned/checked state
  const [scannedItems, setScannedItems] = useState({}); // {productId: {scanned: bool, fromWarehouse: bool}}

  // staff + payment
  const [staffName, setStaffName] = useState(STAFF_NAMES[0]);
  const [paymentType, setPaymentType] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  // load orders when customer chosen
  useEffect(() => {
    (async () => {
      if (!customer?.id) {
        setOrders([]);
        setOrderId("");
        return;
      }
      const qy = query(
        collection(db, "salesOrders"),
        where("customerId", "==", String(customer.id)),
        where("status", "==", "pending")
      );
      const snap = await getDocs(qy);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(arr);
    })();
  }, [customer]);

  // set items when order chosen
  useEffect(() => {
    if (!orderId) {
      setOrderItems([]);
      return;
    }
    const found = orders.find((o) => o.id === orderId);
    setOrderItems(found?.items || []);
  }, [orderId, orders]);

  const handleBarcodeScanned = async ({ data }) => {
    setShowScanner(false);
    if (!scanningFor) return;
    try {
      const ref = doc(db, "products", String(data));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert("Not found", `No product with barcode ${data}`);
        return;
      }
      const p = snap.data();
      if (p.id !== scanningFor.productId && p.barcode !== scanningFor.barcode) {
        Alert.alert("Mismatch", "This scan does not match the selected product.");
        return;
      }
      setScannedItems((m) => ({
        ...m,
        [scanningFor.productId]: { scanned: true, fromWarehouse: false },
      }));
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to scan");
    }
  };

  const toggleFromWarehouse = (it) => {
    setScannedItems((m) => ({
      ...m,
      [it.productId]: { scanned: false, fromWarehouse: !(m[it.productId]?.fromWarehouse) },
    }));
  };

  const confirmShipment = async () => {
    if (!orderId) return Alert.alert("Pick order", "Please choose an order first");

    const selectedOrder = orders.find((o) => o.id === orderId);
    if (!selectedOrder) return;

    try {
      for (const it of orderItems) {
        const scan = scannedItems[it.productId];
        if (!scan?.scanned && !scan?.fromWarehouse) {
          Alert.alert("Incomplete", `Please scan or mark warehouse for ${it.productName}`);
          return;
        }

        // decrement stock only if scanned (from store)
        if (scan.scanned && !scan.fromWarehouse) {
          const ref = doc(db, "products", String(it.productId));
          await updateDoc(ref, {
            ...decQtyPatch("store", it.qty),
            lastUpdatedAt: serverTimestamp(),
            lastUpdatedBy: auth.currentUser?.uid || null,
            lastUpdatedByEmail: auth.currentUser?.email || null,
          });
        }

        // log stock outgoing
        await addDoc(collection(db, "stockLogs"), {
          type: "outgoing",
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          staffName,
          fromWarehouse: !!scan.fromWarehouse,
          orderId,
          customerId: customer?.id || null,
          customerName: customer?.name || "",
          timestamp: serverTimestamp(),
        });
      }

      // update salesOrder
      const paid = Number(paymentAmount || 0);
      const newRemaining = Math.max((selectedOrder?.totals?.remaining || 0) - paid, 0);

      await updateDoc(doc(db, "salesOrders", orderId), {
        status: "done",
        shipments: arrayUnion({
          at: serverTimestamp(),
          by: staffName,
          items: orderItems,
          paymentType,
          paymentAmount: paid,
        }),
        "totals.remaining": newRemaining,
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Shipment confirmed and logged");
      navigation.goBack();
    } catch (e) {
      console.log("Shipment error", e);
      Alert.alert("Error", e?.message || "Failed to confirm shipment");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Scan Outgoing Shipment</Text>

        {/* Step 1: Customer */}
        <Text style={styles.label}>Customer</Text>
        <CustomerAutocomplete
          value={customer?.name || ""}
          onChangeName={(n) => setCustomer((c) => ({ ...c, name: n }))}
          addressValue={customer?.address || ""}
          onChangeAddress={(a) => setCustomer((c) => ({ ...c, address: a }))}
          onPicked={setCustomer}
        />

        {/* Step 2: Orders */}
        <Text style={styles.label}>Pending Orders</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={orderId} onValueChange={setOrderId}>
            <Picker.Item label="-- choose order --" value="" />
            {orders.map((o) => (
              <Picker.Item
                key={o.id}
                label={`#${o.id.slice(0, 6)} • Remain ${fmt(o?.totals?.remaining || 0)}`}
                value={o.id}
              />
            ))}
          </Picker>
        </View>

        {/* Order Table */}
        {orderItems.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Product</Text>
              <Text style={styles.th}>Qty</Text>
              <Text style={styles.th}>Price</Text>
              <Text style={styles.th}>Subtotal</Text>
              <Text style={styles.th}>Action</Text>
            </View>
            {orderItems.map((it, idx) => {
              const scan = scannedItems[it.productId] || {};
              return (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{it.productName}</Text>
                  <Text style={styles.td}>{it.qty}</Text>
                  <Text style={styles.td}>{fmt(it.price)}</Text>
                  <Text style={styles.td}>{fmt(it.subtotal)}</Text>
                  <View style={{ flex: 2 }}>
                    {scan.scanned ? (
                      <Text style={{ color: "green" }}>✅ Scanned</Text>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.scanBtn}
                          onPress={() => { setScanningFor(it); setShowScanner(true); }}
                        >
                          <Text style={{ color: "#fff" }}>Scan QR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.checkBtn}
                          onPress={() => toggleFromWarehouse(it)}
                        >
                          <Text style={{ color: scan.fromWarehouse ? "green" : "#444" }}>
                            {scan.fromWarehouse ? "✓ From Warehouse" : "From Warehouse"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Step 3: Staff */}
        <Text style={styles.label}>Staff in Charge</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={staffName} onValueChange={setStaffName}>
            {STAFF_NAMES.map((n) => <Picker.Item key={n} label={n} value={n} />)}
          </Picker>
        </View>

        {/* Step 4: Payment */}
        <Text style={styles.label}>Payment Type</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={paymentType} onValueChange={setPaymentType}>
            <Picker.Item label="-- choose --" value="" />
            {PAYMENT_TYPES.map((p) => <Picker.Item key={p} label={p} value={p} />)}
          </Picker>
        </View>
        <Text style={styles.label}>Payment Amount</Text>
        <TextInput
          style={styles.input}
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="numeric"
          placeholder="0"
        />

        <View style={{ height: 20 }} />
        <Button title="Confirm Shipment" onPress={confirmShipment} color="#1976D2" />
      </ScrollView>

      {/* Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "code128", "upc_a"],
            }}
          />
          <Button title="Cancel" onPress={() => setShowScanner(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  label: { fontWeight: "600", marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    padding: 10, backgroundColor: "#fff",
  },
  pickerWrapper: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    overflow: "hidden", backgroundColor: "#fff",
  },
  table: { marginTop: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#fafafa", padding: 6 },
  th: { flex: 1, fontWeight: "700" },
  td: { flex: 1, fontSize: 13 },
  tableRow: { flexDirection: "row", padding: 6, borderTopWidth: 1, borderTopColor: "#eee" },
  scanBtn: { backgroundColor: "#1976D2", padding: 6, borderRadius: 6, marginBottom: 4 },
  checkBtn: { padding: 4 },
});
