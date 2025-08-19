// screens/AddItemScreen.js
import { Picker } from "@react-native-picker/picker";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  OTHER_VALUE,
  BRAND_OPTIONS_BY_CATEGORY as RAW_BRAND_OPTIONS_BY_CATEGORY,
  CATEGORY_OPTIONS as RAW_CATEGORY_OPTIONS,
} from "../constants/options";
import { auth, db } from "../firebase";

// 🔒 Safe guards so iOS Picker never sees undefined
const CATEGORY_OPTIONS = Array.isArray(RAW_CATEGORY_OPTIONS) ? RAW_CATEGORY_OPTIONS : [];
const BRAND_OPTIONS_BY_CATEGORY =
  RAW_BRAND_OPTIONS_BY_CATEGORY && typeof RAW_BRAND_OPTIONS_BY_CATEGORY === "object"
    ? RAW_BRAND_OPTIONS_BY_CATEGORY
    : {};

export default function AddItemScreen({ route, navigation }) {
  const passedRole = route?.params?.role || "staff";
  const isOwner = passedRole === "owner";

  // Core fields
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(""); // keep as string for TextInput
  const [barcode, setBarcode] = useState("");   // optional; will auto-generate if blank

  // Categorization
  const [selectedCategory, setSelectedCategory] = useState(""); // always string
  const [selectedBrand, setSelectedBrand] = useState("");       // always string
  const [customBrand, setCustomBrand] = useState("");

  // Extra details
  const [material, setMaterial] = useState("");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");

  // Owner-only prices
  const [price, setPrice] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // Make sure brand stays valid when category changes
  useEffect(() => {
    const allowed = Array.isArray(BRAND_OPTIONS_BY_CATEGORY[selectedCategory])
      ? BRAND_OPTIONS_BY_CATEGORY[selectedCategory]
      : [];
    if (!selectedCategory) {
      setSelectedBrand("");
      setCustomBrand("");
      return;
    }
    if (!allowed.includes(selectedBrand) && selectedBrand !== OTHER_VALUE) {
      setSelectedBrand("");
      setCustomBrand("");
    }
  }, [selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const submittingText = useMemo(() => "Add Item", []);

  const generateBarcode = () => {
    const ts = Date.now().toString(); // numeric, good for Code128/QR content
    const rnd = Math.floor(100 + Math.random() * 900);
    return `${ts}${rnd}`;
  };

  const onSubmit = async () => {
    const qty = Number(quantity);
    if (!name.trim()) return Alert.alert("Validation", "Name is required.");
    if (Number.isNaN(qty) || qty < 0) return Alert.alert("Validation", "Quantity must be a non-negative number.");

    // Resolve brand value safely
    let brandToSave = "";
    if (selectedBrand === OTHER_VALUE) {
      if (!customBrand.trim()) {
        return Alert.alert("Validation", "Please type the brand name for 'Other…'");
      }
      brandToSave = customBrand.trim();
    } else {
      brandToSave = selectedBrand || "";
    }

    const payload = {
      name: name.trim(),
      quantity: qty,
      barcode: (barcode || "").trim() || null,
      category: selectedCategory || null,
      brand: brandToSave || null,
      material: material.trim() || null,
      sizes: sizes.trim() || null,
      colors: colors.trim() || null,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || null,
      createdByEmail: auth.currentUser?.email || null,
    };

    if (isOwner) {
      const p = price === "" ? null : Number(price);
      const bp = buyPrice === "" ? null : Number(buyPrice);
      const sp = sellPrice === "" ? null : Number(sellPrice);
      if (p !== null && (Number.isNaN(p) || p < 0)) return Alert.alert("Validation", "Price must be a non-negative number.");
      if (bp !== null && (Number.isNaN(bp) || bp < 0)) return Alert.alert("Validation", "Buy price must be a non-negative number.");
      if (sp !== null && (Number.isNaN(sp) || sp < 0)) return Alert.alert("Validation", "Sell price must be a non-negative number.");
      payload.price = p;
      payload.buyPrice = bp;
      payload.sellPrice = sp;
    }

    const finalBarcode = (barcode || "").trim() || generateBarcode();

    try {
      await setDoc(doc(db, "products", finalBarcode), { ...payload, barcode: finalBarcode }, { merge: true });
      Alert.alert("Success", "Item added.");
      // As requested: go back to stock list (not print page)
      navigation.replace("StockListScreen", { role: isOwner ? "owner" : "staff" });
    } catch (e) {
      console.error("Add item failed:", e);
      const msg =
        e?.code === "permission-denied"
          ? "Permission denied by Firestore rules. Staff cannot set price fields; only owners can update/delete."
          : e?.message || "Failed to add item.";
      Alert.alert("Error", msg);
    }
  };

  // Safe brand list for the current category
  const brandsForCategory = Array.isArray(BRAND_OPTIONS_BY_CATEGORY[selectedCategory])
    ? BRAND_OPTIONS_BY_CATEGORY[selectedCategory]
    : [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Add New Item ({isOwner ? "Owner" : "Staff"})</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Product name" />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedCategory ?? ""} // always a string
            onValueChange={(v) => setSelectedCategory(String(v ?? ""))}
          >
            <Picker.Item label="-- Select Category --" value="" />
            {CATEGORY_OPTIONS.map((c) => (
              <Picker.Item key={String(c)} label={String(c)} value={String(c)} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Brand</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedBrand ?? ""}
            onValueChange={(v) => setSelectedBrand(String(v ?? ""))}
            enabled={!!selectedCategory}
          >
            <Picker.Item
              label={selectedCategory ? "-- Select Brand --" : "Select category first"}
              value=""
            />
            {selectedCategory &&
              brandsForCategory.map((b) => (
                <Picker.Item key={String(b)} label={String(b)} value={String(b)} />
              ))}
            {selectedCategory && <Picker.Item label="Other…" value={OTHER_VALUE} />}
          </Picker>
        </View>

        {selectedBrand === OTHER_VALUE && (
          <>
            <Text style={styles.label}>Type Brand</Text>
            <TextInput
              style={styles.input}
              value={customBrand}
              onChangeText={setCustomBrand}
              placeholder="Your brand name"
            />
          </>
        )}

        <Text style={styles.label}>Barcode (leave blank to auto-generate)</Text>
        <TextInput
          style={styles.inputMono}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="e.g. 202508181234"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Quantity *</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Material</Text>
        <TextInput style={styles.input} value={material} onChangeText={setMaterial} placeholder="Material" />

        <Text style={styles.label}>Sizes</Text>
        <TextInput style={styles.input} value={sizes} onChangeText={setSizes} placeholder="e.g. 200x160" />

        <Text style={styles.label}>Colors</Text>
        <TextInput style={styles.input} value={colors} onChangeText={setColors} placeholder="e.g. Walnut, Black" />

        {isOwner && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Owner Prices (hidden from staff)</Text>
            <Text style={styles.label}>Price</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="e.g. 1500000" />
            <Text style={styles.label}>Buy Price</Text>
            <TextInput style={styles.input} value={buyPrice} onChangeText={setBuyPrice} keyboardType="numeric" placeholder="e.g. 1000000" />
            <Text style={styles.label}>Sell Price</Text>
            <TextInput style={styles.input} value={sellPrice} onChangeText={setSellPrice} keyboardType="numeric" placeholder="e.g. 1800000" />
          </>
        )}

        <View style={{ height: 12 }} />
        <Button title={submittingText} onPress={onSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff",
  },
  inputMono: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  pickerWrapper: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff",
  },
});
