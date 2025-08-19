// screens/EditItemScreen.js
import { Picker } from "@react-native-picker/picker";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
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

// 🔒 Safe guards
const CATEGORY_OPTIONS = Array.isArray(RAW_CATEGORY_OPTIONS) ? RAW_CATEGORY_OPTIONS : [];
const BRAND_OPTIONS_BY_CATEGORY =
  RAW_BRAND_OPTIONS_BY_CATEGORY && typeof RAW_BRAND_OPTIONS_BY_CATEGORY === "object"
    ? RAW_BRAND_OPTIONS_BY_CATEGORY
    : {};

export default function EditItemScreen({ route, navigation }) {
  const { product, fromCollection = "products", role = "staff" } = route.params || {};
  const isOwner = role === "owner";

  if (!product) {
    return (
      <View style={styles.center}>
        <Text>No product data provided.</Text>
      </View>
    );
  }

  // Initial form state
  const [name, setName] = useState(product.name || product.product || "");
  const [quantity, setQuantity] = useState(
    product.quantity != null ? String(product.quantity) :
    product.stock != null ? String(product.stock) : ""
  );

  const barcodeOrId = String(product.barcode || product.id || "");

  const [selectedCategory, setSelectedCategory] = useState(String(product.category || ""));
  const allowedForInitial =
    Array.isArray(BRAND_OPTIONS_BY_CATEGORY[selectedCategory])
      ? BRAND_OPTIONS_BY_CATEGORY[selectedCategory]
      : [];
  const initialBrandInList = product.brand && allowedForInitial.includes(product.brand);
  const [selectedBrand, setSelectedBrand] = useState(
    initialBrandInList ? String(product.brand) : product.brand ? OTHER_VALUE : ""
  );
  const [customBrand, setCustomBrand] = useState(selectedBrand === OTHER_VALUE ? String(product.brand || "") : "");

  const [material, setMaterial] = useState(String(product.material || ""));
  const [sizes, setSizes] = useState(String(product.sizes || ""));
  const [colors, setColors] = useState(String(product.colors || ""));

  // Owner-only
  const [price, setPrice] = useState(product.price != null ? String(product.price) : "");
  const [buyPrice, setBuyPrice] = useState(product.buyPrice != null ? String(product.buyPrice) : "");
  const [sellPrice, setSellPrice] = useState(product.sellPrice != null ? String(product.sellPrice) : "");

  // Keep brand valid when category changes
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

  const submittingText = useMemo(() => "Save Changes", []);

  const onSave = async () => {
    const qty = Number(quantity);
    if (!name.trim()) return Alert.alert("Validation", "Name is required.");
    if (Number.isNaN(qty) || qty < 0) return Alert.alert("Validation", "Quantity must be a non-negative number.");

    // Resolve brand safely
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
      category: selectedCategory || null,
      brand: brandToSave || null,
      material: material.trim() || null,
      sizes: sizes.trim() || null,
      colors: colors.trim() || null,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
      updatedByEmail: auth.currentUser?.email || null,
      barcode: barcodeOrId || null,
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
    } else {
      delete payload.price;
      delete payload.buyPrice;
      delete payload.sellPrice;
    }

    try {
      const docId = String(product.id || barcodeOrId);
      await updateDoc(doc(db, fromCollection, docId), payload);
      Alert.alert("Success", "Item updated.");
      navigation.goBack();
    } catch (e) {
      console.error("Update failed:", e);
      const msg =
        e?.code === "permission-denied"
          ? "Permission denied by Firestore rules. Only owners can edit price fields or delete."
          : e?.message || "Failed to update item.";
      Alert.alert("Error", msg);
    }
  };

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
        <Text style={styles.title}>Edit Item ({isOwner ? "Owner" : "Staff"})</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Product name" />

        <Text style={styles.label}>Barcode / ID</Text>
        <TextInput
          style={[styles.inputMono, { backgroundColor: "#f3f4f6" }]}
          value={barcodeOrId}
          editable={false}
        />

        <Text style={styles.label}>Quantity *</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedCategory ?? ""}
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
            {selectedCategory ? <Picker.Item label="Other…" value={OTHER_VALUE} /> : null}
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
        <Button title={submittingText} onPress={onSave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
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
