// screens/AddItemScreen.js  (only key parts changed)
import { Picker } from "@react-native-picker/picker";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, increment } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../firebase";
import ProductSearchPicker from "../components/ProductSearchPicker";
import { pretty, normBrand, normCategory, normName } from "../utils/normalize";

const STAFF_NAMES = ["Annie","Riri","Yuni","Agus","Salman"];

export default function AddItemScreen({ route, navigation }) {
  const role = route?.params?.role || "staff";
  const isOwner = role === "owner";

  // common
  const [quantity, setQuantity] = useState("");

  // staff-only
  const [staffName, setStaffName] = useState(STAFF_NAMES[0]);
  const [pick, setPick] = useState(null); // {brand, productDocId, displayName, sizes[], selectedSize, barcodesBySize, category, name}

  // owner-only (keeps your previous free-typing fields)
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [sizes, setSizes] = useState("");

  const genBarcode = () => `${Date.now()}${Math.floor(100 + Math.random()*900)}`;

  async function saveIncomingForSelection(qty) {
    if (!pick || !pick.selectedSize) {
      Alert.alert("Missing data", "Please pick brand → product → size.");
      return;
    }

    // Decide final barcode
    const chosenBarcode = pick?.barcodesBySize?.[pick.selectedSize] || genBarcode();

    // Prepare product doc (create if missing; otherwise increment)
    const pDoc = doc(db, "products", String(chosenBarcode));
    const snap = await getDoc(pDoc);
    const base = {
      name: pretty(pick.displayName || pick.name),
      brand: pick.brand,
      category: pick.category,
      sizes: pick.selectedSize,
      barcode: String(chosenBarcode),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
      updatedByEmail: auth.currentUser?.email || null,
    };

    if (snap.exists()) {
      await updateDoc(pDoc, {
        ...base,
        quantity: increment(qty),
      });
    } else {
      await setDoc(pDoc, {
        ...base,
        quantity: qty,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || null,
        createdByEmail: auth.currentUser?.email || null,
        createdByName: staffName,
      });
    }

    // Log INCOMING
    await addDoc(collection(db, "stockLogs"), {
      type: "incoming",
      productId: String(chosenBarcode),
      productName: base.name,
      brand: base.brand,
      category: base.category,
      sizes: base.sizes,
      quantity: qty,
      staffName,
      handledById: auth.currentUser?.uid || null,
      handledByEmail: auth.currentUser?.email || null,
      timestamp: serverTimestamp(),
    });

    // Print?
    const want = Platform.OS === "web" ? window.confirm("Print label now?") :
      await new Promise((r)=>Alert.alert("Print label?","Print now?",[{text:"No",style:"cancel",onPress:()=>r(false)},{text:"Yes",onPress:()=>r(true)}]));
    if (want) {
      navigation.navigate("PrintLabelScreen", {
        product: { barcode: chosenBarcode, name: base.name, sizes: base.sizes, brand: base.brand },
        immediatePrint: true,
      });
    } else {
      navigation.replace("StockListScreen", { role });
    }
  }

  async function onSubmit() {
    const qty = Number(quantity);
    if (!qty || Number.isNaN(qty) || qty <= 0) return Alert.alert("Validation","Enter a positive quantity.");

    if (!isOwner) {
      return saveIncomingForSelection(qty);
    }

    // Owner: create a new master product (optional convenience)
    const body = {
      brand: normBrand(brand),
      category: normCategory(category),
      name: normName(name),
      displayName: pretty(name),
      sizes: sizes.split(",").map((s)=>s.trim()).filter(Boolean),
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || null,
      createdByEmail: auth.currentUser?.email || null,
    };
    await addDoc(collection(db, "masterProducts"), body);
    Alert.alert("Saved","Master product created.");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Add New Item ({isOwner ? "Owner" : "Staff"})</Text>

        {!isOwner && (
          <>
            <Text style={styles.label}>Staff Name</Text>
            <View style={styles.picker}>
              <Picker selectedValue={staffName} onValueChange={setStaffName}>
                {STAFF_NAMES.map((n)=> <Picker.Item key={n} label={n} value={n} />)}
              </Picker>
            </View>

            <ProductSearchPicker value={pick} onChange={setPick} />

            <Text style={styles.label}>Quantity *</Text>
            <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="0" />

            <View style={{ height: 12 }} />
            <Button title="Add / Merge & Log Incoming" onPress={onSubmit} />
          </>
        )}

        {isOwner && (
          <>
            <Text style={styles.sectionTitle}>Owner – Create Master Product</Text>
            <Text style={styles.label}>Brand</Text>
            <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="King Koil" />
            <Text style={styles.label}>Category</Text>
            <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Mattress" />
            <Text style={styles.label}>Product Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="World Endorsed" />
            <Text style={styles.label}>Sizes (comma separated)</Text>
            <TextInput style={styles.input} value={sizes} onChangeText={setSizes} placeholder="180x200,160x200" />
            <View style={{ height: 12 }} />
            <Button title="Create Master Product" onPress={onSubmit} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 14 },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  picker: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" },
});
