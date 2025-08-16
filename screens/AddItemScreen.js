// screens/AddItemScreen.js
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
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
import { auth, db } from "../firebase";

import { Picker } from "@react-native-picker/picker";
import {
  BRAND_OPTIONS_BY_CATEGORY,
  CATEGORY_OPTIONS,
  OTHER_VALUE,
} from "../constants/options";

export default function AddItemScreen({ route, navigation }) {
  // role can be passed from Home screen; default to "staff" if not provided
  const passedRole = route?.params?.role || "staff";
  const isOwner = passedRole === "owner";

  // -------------------------
  // Form state
  // -------------------------
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState(""); // if you scan first, you can prefill this
  const [quantity, setQuantity] = useState("");
  const [material, setMaterial] = useState("");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");

  // Dependent dropdowns
  const [selectedCategory, setSelectedCategory] = useState(""); // from CATEGORY_OPTIONS or OTHER_VALUE
  const [selectedBrand, setSelectedBrand] = useState(""); // from BRAND_OPTIONS_BY_CATEGORY[selectedCategory] or OTHER_VALUE
  const [customCategory, setCustomCategory] = useState(""); // shown when selectedCategory === OTHER_VALUE
  const [customBrand, setCustomBrand] = useState(""); // shown when selectedBrand === OTHER_VALUE

  // Owner-only fields
  const [price, setPrice] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // When category changes, clear/validate brand
  useEffect(() => {
    if (!selectedCategory) {
      setSelectedBrand("");
      return;
    }
    const allowed = BRAND_OPTIONS_BY_CATEGORY[selectedCategory] || [];
    if (!allowed.includes(selectedBrand) && selectedBrand !== OTHER_VALUE) {
      setSelectedBrand("");
    }
  }, [selectedCategory, selectedBrand]);

  const submittingText = useMemo(() => "Add Item", []);

  const onSubmit = async () => {
    const qty = Number(quantity);

    // derive final values from dropdowns
    const finalCategory =
      selectedCategory === OTHER_VALUE
        ? (customCategory.trim() || "")
        : selectedCategory;

    const finalBrand =
      selectedBrand === OTHER_VALUE
        ? (customBrand.trim() || "")
        : selectedBrand;

    // -------------------------
    // Validation
    // -------------------------
    if (!name.trim()) return Alert.alert("Validation", "Name is required");
    if (!finalCategory)
      return Alert.alert("Validation", "Please select or enter a category.");
    if (!finalBrand)
      return Alert.alert("Validation", "Please select or enter a brand.");
    if (isNaN(qty) || qty < 0)
      return Alert.alert("Validation", "Quantity must be a non-negative number");

    // -------------------------
    // Build payload
    // -------------------------
    const payload = {
      name: name.trim(),
      brand: finalBrand,
      barcode: barcode.trim() || null,
      quantity: qty,
      category: finalCategory,
      material: material.trim() || null,
      sizes: sizes.trim() || null,
      colors: colors.trim() || null,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || null,
      createdByEmail: auth.currentUser?.email || null,
    };

    // Only owners can attach price fields (matches your security rules)
    if (isOwner) {
      const p = price === "" ? null : Number(price);
      const bp = buyPrice === "" ? null : Number(buyPrice);
      const sp = sellPrice === "" ? null : Number(sellPrice);

      if (p !== null && (isNaN(p) || p < 0))
        return Alert.alert("Validation", "Price must be a non-negative number");
      if (bp !== null && (isNaN(bp) || bp < 0))
        return Alert.alert("Validation", "Buy price must be a non-negative number");
      if (sp !== null && (isNaN(sp) || sp < 0))
        return Alert.alert("Validation", "Sell price must be a non-negative number");

      payload.price = p;
      payload.buyPrice = bp;
      payload.sellPrice = sp;
    }

    try {
      // Use "products" unless your data lives in "inventory"
      if (payload.barcode) {
        // Put barcode as the document ID (helps scanning later)
        await setDoc(doc(db, "products", payload.barcode), payload, { merge: true });
      } else {
        await addDoc(collection(db, "products"), payload);
      }

      Alert.alert("Success", "Item added.");
      navigation.goBack();
    } catch (e) {
      console.error("Add item failed:", e);
      const msg =
        e?.code === "permission-denied"
          ? "Permission denied. Staff cannot set price fields, and only owners can update/delete."
          : e?.message || "Failed to add item.";
      Alert.alert("Error", msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Add New Item ({isOwner ? "Owner" : "Staff"})</Text>

        {/* Name */}
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Product name"
        />

        {/* Category */}
        <Text style={styles.label}>Category *</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v)}
          >
            <Picker.Item label="-- Select Category --" value="" />
            {CATEGORY_OPTIONS.map((c) => (
              <Picker.Item key={c} label={c} value={c} />
            ))}
            <Picker.Item label="Other…" value={OTHER_VALUE} />
          </Picker>
        </View>
        {selectedCategory === OTHER_VALUE && (
          <TextInput
            style={styles.input}
            placeholder="Type a new category"
            value={customCategory}
            onChangeText={setCustomCategory}
          />
        )}

        {/* Brand (depends on Category) */}
        <Text style={styles.label}>Brand *</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedBrand}
            onValueChange={(v) => setSelectedBrand(v)}
            enabled={!!selectedCategory}
          >
            <Picker.Item
              label={selectedCategory ? "-- Select Brand --" : "Select category first"}
              value=""
            />
            {selectedCategory &&
              (BRAND_OPTIONS_BY_CATEGORY[selectedCategory] || []).map((b) => (
                <Picker.Item key={b} label={b} value={b} />
              ))}
            {selectedCategory && <Picker.Item label="Other…" value={OTHER_VALUE} />}
          </Picker>
        </View>
        {selectedBrand === OTHER_VALUE && (
          <TextInput
            style={styles.input}
            placeholder="Type a new brand"
            value={customBrand}
            onChangeText={setCustomBrand}
          />
        )}

        {/* Barcode */}
        <Text style={styles.label}>Barcode</Text>
        <TextInput
          style={styles.input}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Scan or type barcode"
        />

        {/* Quantity */}
        <Text style={styles.label}>Quantity *</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0"
          keyboardType="numeric"
        />

        {/* Optional details */}
        <Text style={styles.label}>Material</Text>
        <TextInput
          style={styles.input}
          value={material}
          onChangeText={setMaterial}
          placeholder="Material"
        />

        <Text style={styles.label}>Sizes</Text>
        <TextInput
          style={styles.input}
          value={sizes}
          onChangeText={setSizes}
          placeholder="e.g. 200x160"
        />

        <Text style={styles.label}>Colors</Text>
        <TextInput
          style={styles.input}
          value={colors}
          onChangeText={setColors}
          placeholder="e.g. Walnut, Black"
        />

        {/* Owner-only price section */}
        {isOwner && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
              Owner Prices (hidden from staff)
            </Text>

            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 1500000"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Buy Price</Text>
            <TextInput
              style={styles.input}
              value={buyPrice}
              onChangeText={setBuyPrice}
              placeholder="e.g. 1000000"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Sell Price</Text>
            <TextInput
              style={styles.input}
              value={sellPrice}
              onChangeText={setSellPrice}
              placeholder="e.g. 1800000"
              keyboardType="numeric"
            />
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
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
});
