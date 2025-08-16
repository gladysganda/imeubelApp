// screens/EditItemScreen.js
import { Picker } from "@react-native-picker/picker";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
    BRAND_OPTIONS_BY_CATEGORY,
    CATEGORY_OPTIONS,
    OTHER_VALUE,
} from "../constants/options";
import { db } from "../firebase";

export default function EditItemScreen({ route, navigation }) {
  // Route can pass either { product } or { productId }, and optional { fromCollection }
  const productFromRoute = route?.params?.product || null;
  const productIdFromRoute = route?.params?.productId || productFromRoute?.id || null;
  const fromCollection = route?.params?.fromCollection || "products";
  const passedRole = route?.params?.role || "owner"; // default owner for edit
  const isOwner = passedRole === "owner";

  // -------------------------
  // Form state (DECLARE FIRST)
  // -------------------------
  const [loading, setLoading] = useState(!productFromRoute); // if we need to fetch
  const [docId, setDocId] = useState(productIdFromRoute || ""); // actual document id

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState(""); // if you use barcode as doc id, usually don’t change it here
  const [quantity, setQuantity] = useState("");
  const [material, setMaterial] = useState("");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");

  // Dependent dropdowns
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customBrand, setCustomBrand] = useState("");

  // Owner-only fields
  const [price, setPrice] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // -------------------------
  // Effects (AFTER declarations)
  // -------------------------

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

  // Hydrate from route product or Firestore
  useEffect(() => {
    const hydrate = (prod, id) => {
      setDocId(id || prod?.id || "");
      setName(prod?.name || "");
      setBarcode(prod?.barcode || "");
      setQuantity(String(prod?.quantity ?? prod?.stock ?? 0));
      setMaterial(prod?.material || "");
      setSizes(prod?.sizes || "");
      setColors(prod?.colors || "");
      setSelectedCategory(prod?.category || "");
      setSelectedBrand(prod?.brand || "");
      setPrice(prod?.price != null ? String(prod.price) : "");
      setBuyPrice(prod?.buyPrice != null ? String(prod.buyPrice) : "");
      setSellPrice(prod?.sellPrice != null ? String(prod.sellPrice) : "");
    };

    const loadIfNeeded = async () => {
      if (productFromRoute) {
        hydrate(productFromRoute, productFromRoute.id);
        setLoading(false);
        return;
      }
      if (!productIdFromRoute) {
        Alert.alert("Error", "No product id provided.");
        navigation.goBack();
        return;
      }
      try {
        const ref = doc(db, fromCollection, productIdFromRoute);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          hydrate({ id: snap.id, ...snap.data() }, snap.id);
        } else {
          Alert.alert("Error", "Product not found.");
          navigation.goBack();
        }
      } catch (e) {
        console.error("Failed to load product:", e);
        Alert.alert("Error", "Failed to load product.");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadIfNeeded();
  }, [productFromRoute, productIdFromRoute, fromCollection, navigation]);

  const submittingText = useMemo(() => "Save Changes", []);

  const onSave = async () => {
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

    // Validation
    if (!name.trim()) return Alert.alert("Validation", "Name is required");
    if (!finalCategory)
      return Alert.alert("Validation", "Please select or enter a category.");
    if (!finalBrand)
      return Alert.alert("Validation", "Please select or enter a brand.");
    if (isNaN(qty) || qty < 0)
      return Alert.alert("Validation", "Quantity must be a non-negative number");

    // Build update payload
    const updates = {
      name: name.trim(),
      category: finalCategory,
      brand: finalBrand,
      barcode: barcode.trim() || null,
      quantity: qty,
      material: material.trim() || null,
      sizes: sizes.trim() || null,
      colors: colors.trim() || null,
      updatedAt: new Date(),
    };

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
      updates.price = p;
      updates.buyPrice = bp;
      updates.sellPrice = sp;
    }

    try {
      if (!docId) {
        Alert.alert("Error", "Missing document id.");
        return;
      }
      await updateDoc(doc(db, fromCollection, docId), updates);
      Alert.alert("Success", "Item updated.");
      navigation.goBack();
    } catch (e) {
      console.error("Update failed:", e);
      const msg =
        e?.code === "permission-denied"
          ? "Permission denied. Only owners can edit price fields or modify items."
          : e?.message || "Failed to update item.";
      Alert.alert("Error", msg);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Item ({isOwner ? "Owner" : "Staff"})</Text>

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

        {/* Brand depends on Category */}
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
          placeholder="Barcode (optional)"
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
        <Button title={submittingText} onPress={onSave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
