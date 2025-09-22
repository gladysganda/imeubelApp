// screens/EditItemScreen.js
import { Picker } from "@react-native-picker/picker";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BRAND_OPTIONS_BY_CATEGORY as RAW_BRAND_OPTIONS_BY_CATEGORY,
  CATEGORY_OPTIONS as RAW_CATEGORY_OPTIONS,
  OTHER_VALUE,
} from "../constants/options";
import { auth, db } from "../firebase";
import { WAREHOUSES } from "../constants/warehouses"; // 👈 NEW
import * as FileSystem from "expo-file-system/legacy";

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

  // ===== Base fields (unchanged) =====
  const [name, setName] = useState(product.name || product.product || "");
  const [quantity, setQuantity] = useState(
    product.quantity != null
      ? String(product.quantity)
      : product.stock != null
      ? String(product.stock)
      : ""
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
  const [customBrand, setCustomBrand] = useState(
    selectedBrand === OTHER_VALUE ? String(product.brand || "") : ""
  );
  const [material, setMaterial] = useState(String(product.material || ""));
  const [sizes, setSizes] = useState(String(product.sizes || ""));
  const [colors, setColors] = useState(String(product.colors || ""));
  const [price, setPrice] = useState(product.price != null ? String(product.price) : "");
  const [buyPrice, setBuyPrice] = useState(product.buyPrice != null ? String(product.buyPrice) : "");
  const [sellPrice, setSellPrice] = useState(product.sellPrice != null ? String(product.sellPrice) : "");

  // ===== Owner-only: per-location quantities (Store + Warehouses) =====
  // The app uses qtyByWh.{locationId} and a special "store" bucket.
  const initialQtyByWh = {
    store: Number(product?.qtyByWh?.store ?? 0) || 0,
    ...Object.fromEntries(
      (WAREHOUSES || []).map(w => [w.id, Number(product?.qtyByWh?.[w.id] ?? 0) || 0])
    ),
  };

  // Controlled inputs as strings (for text inputs)
  const [storeQty, setStoreQty] = useState(String(initialQtyByWh.store));
  const [whQtyMap, setWhQtyMap] = useState(
    Object.fromEntries(
      (WAREHOUSES || []).map(w => [w.id, String(initialQtyByWh[w.id] ?? 0)])
    )
  );

  // If category changes, keep brand in sync (unchanged)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const submittingText = useMemo(() => "Save Changes", []);

  function toNumSafe(str) {
    if (str === "" || str == null) return 0;
    const n = Number(str);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  // Detect whether owner edited any per-location values
  function didOwnerEditPerLocation() {
    if (!isOwner) return false;
    const storeN = Number(storeQty);
    if (storeN !== initialQtyByWh.store) return true;
    for (const w of WAREHOUSES || []) {
      const cur = Number(whQtyMap[w.id]);
      if (cur !== initialQtyByWh[w.id]) return true;
    }
    return false;
  }

  const onSave = async () => {
    // Basic validations (existing)
    const qtyInput = Number(quantity);
    if (!name.trim()) return Alert.alert("Validation", "Name is required.");
    if (Number.isNaN(qtyInput) || qtyInput < 0)
      return Alert.alert("Validation", "Quantity must be a non-negative number.");

    let brandToSave = "";
    if (selectedBrand === OTHER_VALUE) {
      if (!customBrand.trim()) {
        return Alert.alert("Validation", "Please type the brand name for 'Other…'");
      }
      brandToSave = customBrand.trim();
    } else {
      brandToSave = selectedBrand || "";
    }

    const oldGlobalQty = Number(product.quantity ?? product.stock ?? 0) || 0;

    // Prepare payload base
    const payload = {
      name: name.trim(),
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
      if (p !== null && (Number.isNaN(p) || p < 0))
        return Alert.alert("Validation", "Price must be a non-negative number.");
      if (bp !== null && (Number.isNaN(bp) || bp < 0))
        return Alert.alert("Validation", "Buy price must be a non-negative number.");
      if (sp !== null && (Number.isNaN(sp) || sp < 0))
        return Alert.alert("Validation", "Sell price must be a non-negative number.");
      payload.price = p;
      payload.buyPrice = bp;
      payload.sellPrice = sp;
    }

    // Owner-only per-location edit handling
    const ownerChangedPerLoc = didOwnerEditPerLocation();

    // Build new qtyByWh if owner changed any per-location values
    let newQtyByWh = null;
    let newGlobalFromPerLoc = null;

    if (isOwner && ownerChangedPerLoc) {
      const storeParsed = toNumSafe(storeQty);
      if (Number.isNaN(storeParsed)) return Alert.alert("Validation", "Store quantity must be a non-negative number.");

      const mapParsed = {};
      for (const w of WAREHOUSES || []) {
        const n = toNumSafe(whQtyMap[w.id]);
        if (Number.isNaN(n)) {
          return Alert.alert("Validation", `Quantity for "${w.label}" must be a non-negative number.`);
        }
        mapParsed[w.id] = n;
      }

      newQtyByWh = { store: storeParsed, ...mapParsed };
      newGlobalFromPerLoc = Object.values(newQtyByWh).reduce((a, b) => a + b, 0);

      payload.qtyByWh = newQtyByWh;
      payload.quantity = newGlobalFromPerLoc; // total becomes sum of per-location values
    } else {
      // No per-location changes → keep the original single quantity behavior
      payload.quantity = qtyInput;
    }

    try {
      const docId = String(product.id || barcodeOrId);
      const ref = doc(db, fromCollection, docId);

      await updateDoc(ref, payload);

      // ===== Logging =====
      // If owner changed per-location values, log per-location adjustments.
      if (isOwner && ownerChangedPerLoc && newQtyByWh) {
        // Old map (fallback to 0)
        const oldStore = Number(product?.qtyByWh?.store ?? 0) || 0;
        const oldByWh = Object.fromEntries((WAREHOUSES || []).map(w => [w.id, Number(product?.qtyByWh?.[w.id] ?? 0) || 0]));

        // Store delta
        const deltaStore = newQtyByWh.store - oldStore;
        if (deltaStore !== 0) {
          await addDoc(collection(db, "stockLogs"), {
            type: "adjustment",
            productId: docId,
            productName: name.trim(),
            barcode: barcodeOrId,
            location: "store",
            quantity: deltaStore, // positive/negative
            oldQuantity: oldStore,
            newQuantity: newQtyByWh.store,
            staffName: auth.currentUser?.email || null,
            handledById: auth.currentUser?.uid || null,
            handledByEmail: auth.currentUser?.email || null,
            note: `manual per-location edit (store)`,
            timestamp: serverTimestamp(),
          });
        }

        // Each warehouse delta
        for (const w of WAREHOUSES || []) {
          const oldVal = oldByWh[w.id] || 0;
          const newVal = newQtyByWh[w.id] || 0;
          const delta = newVal - oldVal;
          if (delta !== 0) {
            await addDoc(collection(db, "stockLogs"), {
              type: "adjustment",
              productId: docId,
              productName: name.trim(),
              barcode: barcodeOrId,
              location: w.id,
              quantity: delta, // positive/negative
              oldQuantity: oldVal,
              newQuantity: newVal,
              staffName: auth.currentUser?.email || null,
              handledById: auth.currentUser?.uid || null,
              handledByEmail: auth.currentUser?.email || null,
              note: `manual per-location edit (${w.label})`,
              timestamp: serverTimestamp(),
            });
          }
        }
        // We do NOT also log a global delta to avoid double-counting.
      } else {
        // Preserve your original global adjustment log behavior
        const newGlobal = Number(payload.quantity ?? 0) || 0;
        if (oldGlobalQty !== newGlobal) {
          await addDoc(collection(db, "stockLogs"), {
            type: "adjustment",
            productId: docId,
            productName: name.trim(),
            barcode: barcodeOrId,
            quantity: newGlobal - oldGlobalQty,
            staffName: auth.currentUser?.email || null,
            handledById: auth.currentUser?.uid || null,
            handledByEmail: auth.currentUser?.email || null,
            note: `manual edit from ${oldGlobalQty} → ${newGlobal}`,
            oldQuantity: oldGlobalQty,
            newQuantity: newGlobal,
            timestamp: serverTimestamp(),
          });
        }
      }

      Alert.alert("Success", "Item updated.");
      navigation.goBack();
    } catch (e) {
      console.error("Update failed:", e);
      Alert.alert("Error", e?.message || "Failed to update item.");
    }
  };

  const brandsForCategory = Array.isArray(BRAND_OPTIONS_BY_CATEGORY[selectedCategory])
    ? BRAND_OPTIONS_BY_CATEGORY[selectedCategory]
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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

          {/* Existing global quantity editor (kept for backward compatibility) */}
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="numeric"
          />

          {/* Owner-only: per-location editors */}
          {isOwner && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Per Location Quantities</Text>

              {/* Store */}
              {/* <Text style={styles.label}>Store</Text>
              <TextInput
                style={styles.input}
                value={storeQty}
                onChangeText={setStoreQty}
                keyboardType="numeric"
                placeholder="0"
              /> */}

              {/* Warehouses */}
              {(WAREHOUSES || []).map((w) => (
                <View key={w.id}>
                  <Text style={styles.label}>{w.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={whQtyMap[w.id]}
                    onChangeText={(v) =>
                      setWhQtyMap((m) => ({ ...m, [w.id]: v }))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              ))}

              {/* Info text */}
              <Text style={{ marginTop: 6, color: "#666" }}>
                If you change any per-location quantity above, the total Quantity will automatically
                be recalculated as the sum of Store + all Warehouses.
              </Text>
            </>
          )}

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
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Owner Prices</Text>
              <Text style={styles.label}>Price</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
              <Text style={styles.label}>Buy Price</Text>
              <TextInput style={styles.input} value={buyPrice} onChangeText={setBuyPrice} keyboardType="numeric" />
              <Text style={styles.label}>Sell Price</Text>
              <TextInput style={styles.input} value={sellPrice} onChangeText={setSellPrice} keyboardType="numeric" />
            </>
          )}

          <View style={{ height: 12 }} />
          <Button title={submittingText} onPress={onSave} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  pickerWrapper: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff",
  },
});
