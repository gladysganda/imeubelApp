// screens/CreateSaleScreen.js
import React, { useMemo, useState } from "react";
import {
  Alert, Button, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  addDoc, collection, doc, getDoc, serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../firebase";
import CustomerAutocomplete from "../components/CustomerAutocomplete";
import ProductAutocompleteInput from "../components/ProductAutocompleteInput";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";

function money(n) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);
  } catch {
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
  }
}
function emptyRow() {
  return {
    productId: null,
    productBarcode: null, // NEW: helps reservations show in StockList when listing from inventory
    productName: "",
    isCustom: true,
    qty: "",
    price: "",
    subtotal: 0,
    size: "",
    sizeOptions: [],
  };
}

export default function CreateSaleScreen({ navigation }) {
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPicked, setCustomerPicked] = useState(null);
  const [items, setItems] = useState([emptyRow()]);
  const [downPayment, setDownPayment] = useState("");
  const [paidInFull, setPaidInFull] = useState(false);
  const [reserve, setReserve] = useState(true);

  // NEW: optional shipment date & payment type
  const [shipmentDate, setShipmentDate] = useState(""); // persisted as YYYY-MM-DD
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarValue, setCalendarValue] = useState(new Date());
  const [paymentType, setPaymentType] = useState("");   // "", "cash", "transfer", "qris", etc.

  const updateRow = (idx, patch) => {
    setItems(prev => {
      const next = [...prev];
      const row = { ...next[idx], ...patch };
      const qtyN = Number(row.qty);
      const priceN = Number(row.price);
      row.subtotal =
        Number.isFinite(qtyN) && qtyN > 0 && Number.isFinite(priceN) && priceN >= 0
          ? qtyN * priceN
          : 0;
      next[idx] = row;
      return next;
    });
  };

  const onPickProduct = async (idx, picked) => {
    // picked: { id, name, sizes?, barcode? } depending on your autocomplete
    const raw = (picked.sizes || "").toString();
    const parts = raw
      .split(/[,•|/]/g) // commas, bullets, pipes, slashes
      .map(s => s.trim())
      .filter(Boolean);

    // Try to ensure barcode is available, even if autocomplete didn't pass it
    let productBarcode = picked.barcode || null;
    try {
      if (!productBarcode && picked.id) {
        const snap = await getDoc(doc(db, "products", String(picked.id)));
        if (snap.exists()) {
          const d = snap.data() || {};
          productBarcode = d.barcode || snap.id;
        }
      }
    } catch {}

    updateRow(idx, {
      productId: picked.id,
      productBarcode: productBarcode || null,
      productName: picked.name,
      isCustom: false,
      sizeOptions: parts,
      size: parts[0] || "",
    });
  };

  const onChangeName = (idx, text) => {
    updateRow(idx, { productName: text });
  };

  const totals = useMemo(() => {
    const sub = items.reduce((a, it) => a + (Number(it.subtotal) || 0), 0);
    const dp = Number(downPayment || 0);
    const remaining = Math.max(sub - dp, 0);
    return { sub, dp, remaining };
  }, [items, downPayment]);

  const addAnotherRow = () => setItems(prev => [...prev, emptyRow()]);
  const removeRow = (idx) =>
    setItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const upsertCustomer = async (nm, phone, address) => {
    // Create a basic customer card (duplicates are okay)
    const nameLower = nm.toLowerCase();
    const cRef = await addDoc(collection(db, "customers"), {
      name: nm,
      nameLower,
      phone: phone || null,
      address: address || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || null,
      createdByEmail: auth.currentUser?.email || null,
      updatedBy: auth.currentUser?.uid || null,
      updatedByEmail: auth.currentUser?.email || null,
    });
    return { id: cRef.id, name: nm, nameLower, phone, address };
  };

  const createSale = async () => {
    const name = customerName.trim();
    if (!name) return Alert.alert("Validation", "Customer name required.");
    if (!items.length) return Alert.alert("Validation", "Add at least one item.");

    // normalize items
    const normalized = [];
    for (const it of items) {
      const qtyN = Number(it.qty);
      const priceN = Number(it.price);
      const nm = (it.productName || "").trim();
      if (!nm) return Alert.alert("Validation", "Each item needs a product name.");
      if (!Number.isFinite(qtyN) || qtyN <= 0) return Alert.alert("Validation", "Each item needs qty > 0.");
      if (!Number.isFinite(priceN) || priceN < 0) return Alert.alert("Validation", "Each item needs price ≥ 0.");

      const isCustom = !it.productId;
      normalized.push({
        productId: it.productId || null,
        productBarcode: it.productBarcode || null, // NEW
        productName: nm,
        isCustom,
        qty: qtyN,
        price: priceN,
        size: (it.size || "").trim() || null,
        subtotal: qtyN * priceN,
      });
    }

    try {
      const cust = customerPicked?.id
        ? { id: customerPicked.id, name: customerPicked.name, nameLower: customerPicked.nameLower }
        : await upsertCustomer(name, customerPhone.trim(), customerAddress.trim());

      const payload = {
        customerId: cust?.id || null,
        customerName: name,
        customerNameLower: name.toLowerCase(),
        customerPhone: customerPhone.trim() || null,
        customerAddress: customerAddress.trim() || null,
        items: normalized,
        totals: {
          subTotal: totals.sub,
          downPayment: Number(downPayment || 0),
          remaining: totals.remaining,
          paidInFull: !!paidInFull,
        },
        paymentType: paymentType || null,
        shipmentDate: shipmentDate || null, // optional
        status: "pending",
        reserved: !!reserve,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || null,
        createdByEmail: auth.currentUser?.email || null,
      };

      const orderRef = await addDoc(collection(db, "salesOrders"), payload);

      // Create reservations (pending) so StockList & Shipments can see them
      if (reserve) {
        const masters = normalized.filter(i => !i.isCustom && i.productId && Number(i.qty) > 0);
        for (const it of masters) {
          await addDoc(collection(db, "reservations"), {
            orderId: orderRef.id,
            productId: it.productId,                      // join by products doc id
            productBarcode: it.productBarcode || null,    // ALSO join by barcode if needed
            productName: it.productName,
            qty: Number(it.qty),
            size: it.size || null,
            customerId: payload.customerId,
            customerName: payload.customerName,
            status: "pending",
            shipmentDate: shipmentDate || null,
            createdAt: serverTimestamp(),
          });
        }
      }

      Alert.alert("Saved", "Sale recorded.");
      navigation.goBack();
    } catch (e) {
      console.log("createSale error", e);
      Alert.alert("Error", e?.message || "Failed to save sale.");
    }
  };

  const openCalendar = () => setShowDatePicker(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <FlatList
          ListHeaderComponent={
            <View style={{ padding: 16 }}>
              <Text style={styles.title}>Create Sale</Text>

              <Text style={styles.label}>Customer</Text>
              <CustomerAutocomplete
                value={customerName}
                onChangeName={setCustomerName}
                addressValue={customerAddress}
                onChangeAddress={setCustomerAddress}
                onPicked={(c) => { setCustomerPicked(c); setCustomerPhone(c.phone || ""); }}
              />
              <TextInput style={styles.input} value={customerPhone} onChangeText={setCustomerPhone} placeholder="Customer phone" keyboardType="phone-pad" />

              {/* NEW: shipment date + payment type */}
              <Text style={styles.label}>Shipment date (optional)</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={shipmentDate}
                  placeholder="YYYY-MM-DD"
                  onChangeText={setShipmentDate}
                />
                <Button title="📅" onPress={openCalendar} />
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={calendarValue}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) {
                      setCalendarValue(d);
                      // simple ISO yyyy-mm-dd
                      const iso = d.toISOString().slice(0, 10);
                      setShipmentDate(iso);
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Payment type (optional)</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={paymentType} onValueChange={setPaymentType}>
                  <Picker.Item label="(none)" value="" />
                  <Picker.Item label="Cash" value="cash" />
                  <Picker.Item label="Transfer" value="transfer" />
                  <Picker.Item label="QRIS" value="qris" />
                </Picker>
              </View>

              <View style={styles.hr} />
              <Text style={styles.section}>Items</Text>
            </View>
          }
          data={items}
          keyExtractor={(_, idx) => String(idx)}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <Text style={styles.rowTitle}>Item {index + 1}</Text>

              <ProductAutocompleteInput
                value={item.productName}
                onChangeText={(t) => onChangeName(index, t)}
                onPickProduct={(p) => onPickProduct(index, p)}
              />

              {item.sizeOptions?.length > 0 ? (
                <>
                  <Text style={styles.label}>Size</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={item.size || ""} onValueChange={(v) => updateRow(index, { size: v })}>
                      {item.sizeOptions.map(s => <Picker.Item key={s} label={s} value={s} />)}
                    </Picker>
                  </View>
                </>
              ) : null}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={String(item.qty)} onChangeText={(v) => updateRow(index, { qty: v })} placeholder="Qty" keyboardType="numeric" />
                <TextInput style={[styles.input, { flex: 1 }]} value={String(item.price)} onChangeText={(v) => updateRow(index, { price: v })} placeholder="Price" keyboardType="numeric" />
              </View>

              <Text style={styles.subtotal}>Subtotal: {money(item.subtotal)}</Text>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title="Remove" onPress={() => removeRow(index)} />
                {index === items.length - 1 ? <Button title="Add another item" onPress={addAnotherRow} /> : null}
              </View>
            </View>
          )}
          ListFooterComponent={
            <View style={{ padding: 16 }}>
              <View style={styles.hr} />
              <Text style={styles.section}>Payment</Text>
              <Text style={styles.total}>Total: {money(totals.sub)}</Text>
              <TextInput style={styles.input} value={downPayment} onChangeText={setDownPayment} placeholder="Down Payment (optional)" keyboardType="numeric" />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Button title={paidInFull ? "Paid in full ✓" : "Mark paid in full"} onPress={() => setPaidInFull(v => !v)} />
                <Button title={reserve ? "Reserve stock ✓" : "Do not reserve"} onPress={() => setReserve(v => !v)} />
              </View>
              <Button title="Save Sale" onPress={createSale} />
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  section: { fontSize: 16, fontWeight: "700", marginVertical: 8 },
  label: { fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff", marginBottom: 8 },
  hr: { height: 1, backgroundColor: "#eee", marginVertical: 10 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: "#fff" },
  rowTitle: { fontWeight: "700", marginBottom: 6 },
  subtotal: { fontWeight: "600", marginTop: 2, marginBottom: 6 },
  total: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", marginBottom: 8 },
});
