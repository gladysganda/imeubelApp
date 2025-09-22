// screens/AddItemScreen.js
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
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  BRAND_OPTIONS_BY_CATEGORY as RAW_BRANDS,
  CATEGORY_OPTIONS as RAW_CATS,
  OTHER_VALUE,
} from "../constants/options";
import { WAREHOUSES, DEFAULT_WAREHOUSE_ID } from "../constants/warehouses";
import { incQtyPatch, initQtyByWh } from "../utils/inventory";

// Staff dropdown (editable)
const STAFF_NAMES = ["Ani", "Riri", "Yuni", "Gladys", "Agus", "Salman"];

// categories/brands (safe)
const CATEGORY_OPTIONS = Array.isArray(RAW_CATS) ? RAW_CATS.filter(Boolean).map(String) : [];
const BRANDS_BY_CAT = RAW_BRANDS && typeof RAW_BRANDS === "object" ? RAW_BRANDS : {};

// categories that require fixed size options
const SIZE_REQUIRED_FOR = new Set(["Matras", "Divan"]);
const SIZE_OPTIONS = ["90x200", "100x200", "120x200", "160x200", "180x200", "200x200"];

// fuzzy suggestions from masterProducts
async function fetchNameSuggestions({ term, category, brand }) {
  const t = (term || "").toLowerCase().trim();
  if (t.length < 2) return [];
  try {
    const qy = query(
      collection(db, "masterProducts"),
      where("nameLower", ">=", t),
      where("nameLower", "<=", t + "\uf8ff"),
      limit(8)
    );
    const snap = await getDocs(qy);
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Optional narrow by chosen category/brand if provided
    if (category) list = list.filter((x) => (x.category || "") === category);
    if (brand) list = list.filter((x) => (x.brand || "") === brand);
    return list;
  } catch {
    return [];
  }
}

function brandsFor(cat) {
  const arr = BRANDS_BY_CAT[cat];
  return Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
}

function askPrintConfirm() {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      resolve(window.confirm("Print label now?"));
    } else {
      Alert.alert(
        "Print label?",
        "Do you want to print a label for this product?",
        [
          { text: "No", style: "cancel", onPress: () => resolve(false) },
          { text: "Yes", onPress: () => resolve(true) },
        ]
      );
    }
  });
}

export default function AddItemScreen({ route, navigation }) {
  const role = route?.params?.role || "staff";
  const isOwner = role === "owner";

  // staff & warehouse
  const [staffName, setStaffName] = useState(STAFF_NAMES[0]);
  const [warehouseId, setWarehouseId] = useState(DEFAULT_WAREHOUSE_ID);

  // core
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");

  // cat/brand/sizes
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [sizes, setSizes] = useState("");
  const mustChooseSize = SIZE_REQUIRED_FOR.has(selectedCategory);
  const brandList = brandsFor(selectedCategory);

  // extras
  const [material, setMaterial] = useState("");
  const [colors, setColors] = useState("");

  // prices (owner)
  const [price, setPrice] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // name suggestions (masterProducts)
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);

  // keep brand valid when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setSelectedBrand("");
      setCustomBrand("");
      return;
    }
    if (!brandList.includes(selectedBrand) && selectedBrand !== OTHER_VALUE) {
      setSelectedBrand("");
      setCustomBrand("");
    }
  }, [selectedCategory]); // eslint-disable-line

  // fetch suggestions when typing name (after picking brand/category is best)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!name || name.trim().length < 2) {
        if (!cancelled) setSuggestions([]);
        return;
      }
      const list = await fetchNameSuggestions({
        term: name,
        category: selectedCategory || null,
        brand: selectedBrand && selectedBrand !== OTHER_VALUE ? selectedBrand : null,
      });
      if (!cancelled) setSuggestions(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [name, selectedCategory, selectedBrand]);

  const submittingText = useMemo(() => "Add Item", []);

  const generateBarcode = () => {
    const ts = Date.now().toString();
    const rnd = Math.floor(100 + Math.random() * 900);
    return `${ts}${rnd}`;
  };

  async function onSubmit() {
    const qty = Number(quantity);
    const nm = name.trim();
    const cat = selectedCategory.trim();
    const chosenBrand =
      selectedBrand === OTHER_VALUE ? customBrand.trim() : selectedBrand.trim();
    const sizeStr = (sizes || "").trim();

    // validation checks (unchanged)
    if (!nm) return Alert.alert("Validation", "Name is required.");
    if (!cat) return Alert.alert("Validation", "Please choose a category.");
    if (!chosenBrand) return Alert.alert("Validation", "Please choose a brand.");
    if (Number.isNaN(qty) || qty < 0)
      return Alert.alert("Validation", "Quantity must be non-negative.");
    if (mustChooseSize && !SIZE_OPTIONS.includes(sizeStr))
      return Alert.alert("Validation", "Please choose a valid size.");

    try {
      // Try to merge into existing product
      const qy = query(
        collection(db, "products"),
        where("name", "==", nm),
        where("category", "==", cat),
        where("brand", "==", chosenBrand || null),
        where("sizes", "==", sizeStr || null),
        limit(1)
      );
      const snap = await getDocs(qy);

      if (!snap.empty) {
        const d = snap.docs[0];
        const existing = d.data() || {};
        const ref = doc(db, "products", d.id);

        await updateDoc(ref, {
          ...incQtyPatch(warehouseId, qty),
          lastUpdatedBy: auth.currentUser?.uid || null,
          lastUpdatedByEmail: auth.currentUser?.email || null,
          lastUpdatedByName: staffName,
        });

        // 🔥 Log incoming
        await addDoc(collection(db, "stockLogs"), {
          type: "incoming",
          productId: d.id,
          productName: nm,
          barcode: existing.barcode || d.id,
          category: cat,
          brand: chosenBrand,
          sizes: sizeStr || null,
          quantity: qty,
          staffName,
          handledById: auth.currentUser?.uid || null,
          handledByEmail: auth.currentUser?.email || null,
          note: "Added stock (merged)",
          timestamp: serverTimestamp(),
        });

        Alert.alert("Merged", `Added ${qty} to ${existing.name || d.id}`);

        const wantPrint = await askPrintConfirm();
        if (wantPrint) {
          navigation.navigate("PrintLabelScreen", {
            product: {
              barcode: existing.barcode || d.id,
              name: existing.name || "",
              sizes: existing.sizes || "",
              brand: existing.brand || "",
            },
            immediatePrint: true,
          });
        } else {
          navigation.goBack();
        }
        return;
      }

      // Create new product
      const finalBarcode = barcode.trim() || generateBarcode();
      const body = {
        name: nm,
        category: cat,
        brand: chosenBrand || null,
        sizes: sizeStr || null,
        material: material.trim() || null,
        colors: colors.trim() || null,
        barcode: finalBarcode,
        qtyByWh: initQtyByWh(warehouseId, qty),
        quantity: qty,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || null,
        createdByEmail: auth.currentUser?.email || null,
        createdByName: staffName,
        staffNameAddedBy: staffName,
      };

      if (isOwner) {
        body.price = price === "" ? null : Number(price);
        body.buyPrice = buyPrice === "" ? null : Number(buyPrice);
        body.sellPrice = sellPrice === "" ? null : Number(sellPrice);
      }

      await setDoc(doc(db, "products", finalBarcode), body, { merge: false });

      // 🔥 Log new incoming
      await addDoc(collection(db, "stockLogs"), {
        type: "incoming",
        productId: finalBarcode,
        productName: nm,
        barcode: finalBarcode,
        category: cat,
        brand: chosenBrand,
        sizes: sizeStr || null,
        quantity: qty,
        staffName,
        handledById: auth.currentUser?.uid || null,
        handledByEmail: auth.currentUser?.email || null,
        note: "New product created",
        timestamp: serverTimestamp(),
      });

      Alert.alert("Success", `Item added with barcode: ${finalBarcode}`);

      const wantPrintNew = await askPrintConfirm();
      if (wantPrintNew) {
        navigation.navigate("PrintLabelScreen", {
          product: {
            barcode: finalBarcode,
            name: body.name,
            sizes: body.sizes || "",
            brand: body.brand || "",
          },
          immediatePrint: true,
        });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      console.error("Add item failed:", e);
      Alert.alert("Error", e?.message || "Failed to add item.");
    }
  }
  const onPickSuggestion = (s) => {
    setName(s.name || "");
    if (s.category) setSelectedCategory(String(s.category));
    if (s.brand) setSelectedBrand(String(s.brand));
    if (Array.isArray(s.sizes) && s.sizes.length === 1) setSizes(String(s.sizes[0]));
    setShowSug(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add New Item ({isOwner ? "Owner" : "Staff"})</Text>

          {/* Staff */}
          <Text style={styles.label}>Staff Name</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={staffName} onValueChange={setStaffName}>
              {STAFF_NAMES.map((n) => (
                <Picker.Item key={n} label={n} value={n} />
              ))}
            </Picker>
          </View>

          {/* Warehouse */}
          <Text style={styles.label}>Warehouse *</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={warehouseId} onValueChange={setWarehouseId}>
              {WAREHOUSES.map((w) => (
                <Picker.Item key={w.id} label={w.label} value={w.id} />
              ))}
            </Picker>
          </View>

          {/* Category */}
          <Text style={styles.label}>Category *</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedCategory} onValueChange={setSelectedCategory}>
              <Picker.Item label="-- Select Category --" value="" />
              {CATEGORY_OPTIONS.map((c) => (
                <Picker.Item key={c} label={c} value={c} />
              ))}
            </Picker>
          </View>

          {/* Brand */}
          <Text style={styles.label}>Brand *</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedBrand}
              onValueChange={setSelectedBrand}
              enabled={!!selectedCategory}
            >
              <Picker.Item
                label={selectedCategory ? "-- Select Brand --" : "Select category first"}
                value=""
              />
              {!!selectedCategory &&
                brandList.map((b) => <Picker.Item key={b} label={b} value={b} />)}
              {!!selectedCategory && <Picker.Item label="Other…" value={OTHER_VALUE} />}
            </Picker>
          </View>
          {selectedBrand === OTHER_VALUE && (
            <TextInput
              style={styles.input}
              placeholder="Type brand"
              value={customBrand}
              onChangeText={setCustomBrand}
            />
          )}

          {/* Name + suggestions */}
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => {
              setName(t);
              setShowSug(true);
            }}
            placeholder="Product name"
          />
          {showSug && suggestions.length > 0 ? (
            <View style={styles.suggestBox}>
              {suggestions.map((s) => (
                <TouchableOpacity key={s.id} onPress={() => onPickSuggestion(s)}>
                  <Text style={styles.suggestItem}>
                    {s.name}
                    {s.brand ? ` • ${s.brand}` : ""}
                    {s.category ? ` • ${s.category}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Sizes */}
          <Text style={styles.label}>Sizes{mustChooseSize ? " *" : ""}</Text>
          {mustChooseSize ? (
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={sizes} onValueChange={setSizes}>
                <Picker.Item label="-- Select Size --" value="" />
                {SIZE_OPTIONS.map((s) => (
                  <Picker.Item key={s} label={s} value={s} />
                ))}
              </Picker>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              value={sizes}
              onChangeText={setSizes}
              placeholder="e.g. 200x160"
            />
          )}

          {/* Barcode */}
          <Text style={styles.label}>Barcode (leave blank to auto-generate)</Text>
          <TextInput
            style={styles.input}
            value={barcode}
            onChangeText={setBarcode}
            placeholder="Scan or type barcode"
            autoCapitalize="none"
          />

          {/* Qty */}
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="numeric"
          />

          {/* Optional */}
          <Text style={styles.label}>Material</Text>
          <TextInput style={styles.input} value={material} onChangeText={setMaterial} placeholder="Material" />

          <Text style={styles.label}>Colors</Text>
          <TextInput style={styles.input} value={colors} onChangeText={setColors} placeholder="e.g. Walnut, Black" />

          {/* Owner-only prices */}
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
          <Button title={submittingText} onPress={onSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" },
  suggestBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 6, marginTop: 6, backgroundColor: "#fafafa" },
  suggestItem: { paddingVertical: 6, fontSize: 14 },
});
