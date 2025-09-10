// screens/AddItemScreen.js
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Pressable,
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

// staff dropdown (edit anytime)
const STAFF_NAMES = ["Ani", "Riri", "Yuni", "Gladys", "Agus", "Salman"];

// categories/brands (safe)
const CATEGORY_OPTIONS = Array.isArray(RAW_CATS) ? RAW_CATS.filter(Boolean).map(String) : [];
const BRANDS_BY_CAT = RAW_BRANDS && typeof RAW_BRANDS === "object" ? RAW_BRANDS : {};

// which categories must use fixed size options?
const SIZE_REQUIRED_FOR = new Set(["Matras", "Divan"]);
const SIZE_OPTIONS = ["90x200", "100x200", "120x200", "160x200", "180x200", "200x200"];

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

  // staff picker
  const [staffName, setStaffName] = useState(STAFF_NAMES[0]);

  // core fields
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");

  // category / brand / size
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [sizes, setSizes] = useState("");
  const brandList = brandsFor(selectedCategory);
  const mustChooseSize = SIZE_REQUIRED_FOR.has(selectedCategory);

  // extras
  const [material, setMaterial] = useState("");
  const [colors, setColors] = useState("");

  // owner prices
  const [price, setPrice] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // master suggestions
  const [suggestions, setSuggestions] = useState([]);
  const typeTimer = useRef(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // search masterProducts while typing name (debounced)
  useEffect(() => {
    if (typeTimer.current) clearTimeout(typeTimer.current);
    const term = name.trim().toLowerCase();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    typeTimer.current = setTimeout(async () => {
      try {
        const qy = query(
          collection(db, "masterProducts"),
          where("nameLower", ">=", term),
          where("nameLower", "<=", term + "\uf8ff"),
          limit(6)
        );
        const snap = await getDocs(qy);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSuggestions(list);
      } catch (e) {
        console.log("master suggest error:", e);
        // don’t alert; just hide suggestions on error
        setSuggestions([]);
      }
    }, 180);
  }, [name]);

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
    const finalBrand = selectedBrand === OTHER_VALUE ? customBrand.trim() : selectedBrand.trim();
    const sizeStr = (sizes || "").trim();

    // validation
    if (!nm) return Alert.alert("Validation", "Name is required.");
    if (!cat) return Alert.alert("Validation", "Please choose a category.");
    if (!finalBrand) return Alert.alert("Validation", "Please choose a brand.");
    if (Number.isNaN(qty) || qty < 0) return Alert.alert("Validation", "Quantity must be non-negative.");
    if (mustChooseSize && !SIZE_OPTIONS.includes(sizeStr)) {
      return Alert.alert("Validation", "Please choose a valid size.");
    }

    // common body
    const baseBody = {
      name: nm,
      quantity: qty,
      barcode: barcode.trim() || null,
      category: cat,
      brand: finalBrand || null,
      material: material.trim() || null,
      sizes: sizeStr || null,
      colors: colors.trim() || null,

      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || null,
      createdByEmail: auth.currentUser?.email || null,
      createdByName: staffName,
      staffNameAddedBy: staffName,
    };

    // owner price fields
    if (isOwner) {
      const p = price === "" ? null : Number(price);
      const bp = buyPrice === "" ? null : Number(buyPrice);
      const sp = sellPrice === "" ? null : Number(sellPrice);
      if (p !== null && (Number.isNaN(p) || p < 0)) return Alert.alert("Validation", "Price must be non-negative.");
      if (bp !== null && (Number.isNaN(bp) || bp < 0)) return Alert.alert("Validation", "Buy price must be non-negative.");
      if (sp !== null && (Number.isNaN(sp) || sp < 0)) return Alert.alert("Validation", "Sell price must be non-negative.");
      baseBody.price = p;
      baseBody.buyPrice = bp;
      baseBody.sellPrice = sp;
    }

    try {
      // 1) Merge with existing (name+category+brand+sizes)
      const qy = query(
        collection(db, "products"),
        where("name", "==", nm),
        where("category", "==", cat),
        where("brand", "==", finalBrand || null),
        where("sizes", "==", sizeStr || null),
        limit(1)
      );
      const snap = await getDocs(qy);

      if (!snap.empty) {
        const d = snap.docs[0];
        const existing = d.data() || {};
        await updateDoc(doc(db, "products", d.id), {
          quantity: increment(qty),
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: auth.currentUser?.uid || null,
          lastUpdatedByEmail: auth.currentUser?.email || null,
        });

        Alert.alert("Merged", `Added ${qty} to ${existing.name || d.id}`);

        const wantPrint = await askPrintConfirm();
        if (wantPrint) {
          const codeForPrint = existing.barcode || d.id;
          navigation.navigate("PrintLabelScreen", {
            product: {
              barcode: codeForPrint,
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

      // 2) Create new
      const finalBarcode = barcode.trim() || generateBarcode();
      const body = { ...baseBody, barcode: finalBarcode };

      if (!isOwner) {
        delete body.price;
        delete body.buyPrice;
        delete body.sellPrice;
      }

      await setDoc(doc(db, "products", finalBarcode), body, { merge: false });

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add New Item ({isOwner ? "Owner" : "Staff"})</Text>

          {/* Staff name */}
          <Text style={styles.label}>Staff Name</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={staffName} onValueChange={setStaffName}>
              {STAFF_NAMES.map((n) => (
                <Picker.Item key={n} label={n} value={n} />
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
                brandsFor(selectedCategory).map((b) => <Picker.Item key={b} label={b} value={b} />)}
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
            onChangeText={setName}
            placeholder="Product name"
            autoCapitalize="words"
          />
          {suggestions.length > 0 && (
            <View style={styles.suggestBox}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setName(s.name || "");
                    setSelectedCategory(s.category || "");
                    setSelectedBrand(s.brand || "");
                    // if master has sizes array, pick first by default
                    if (Array.isArray(s.sizes) && s.sizes.length > 0) {
                      setSizes(String(s.sizes[0]));
                    } else {
                      setSizes(s.sizes ? String(s.sizes) : "");
                    }
                    setSuggestions([]);
                  }}
                  style={({ pressed }) => [styles.suggestRow, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.suggestName}>{s.name}</Text>
                  <Text style={styles.suggestMeta}>
                    {s.brand ? `Brand: ${s.brand}` : ""} {s.category ? ` • ${s.category}` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

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
            style={styles.inputMono}
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
  inputMono: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" },
  suggestBox: {
    borderWidth: 1, borderColor: "#eee", borderRadius: 8, overflow: "hidden", marginTop: 6,
    backgroundColor: "#fafafa",
  },
  suggestRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  suggestName: { fontWeight: "700" },
  suggestMeta: { color: "#555", marginTop: 4 },
});
