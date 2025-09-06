// components/ProductSearchPicker.js
import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { collection, getDocs, query, where, orderBy, limit, startAt, endAt } from "firebase/firestore";
import { db } from "../firebase";
import { normBrand, pretty } from "../utils/normalize";

export default function ProductSearchPicker({ value, onChange }) {
  // value = { brand, productDocId, displayName, sizes: [], selectedSize: "" }
  const [brands, setBrands] = useState([]);
  const [brand, setBrand] = useState(value?.brand || "");
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [picked, setPicked] = useState(value || null);
  const [size, setSize] = useState(value?.selectedSize || "");

  // Load distinct brands from masterProducts
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "masterProducts"));
      const setB = new Set();
      snap.forEach((d) => {
        const b = d.data()?.brand;
        if (b) setB.add(b);
      });
      const arr = Array.from(setB).sort();
      setBrands(arr);
    })();
  }, []);

  // Query suggestions when term or brand changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!brand || term.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      const base = collection(db, "masterProducts");
      // Normalized name prefix search: store both name (normalized) and displayName
      const qy = query(
        base,
        where("brand", "==", normBrand(brand)),
        orderBy("name"),                   // normalized field in masterProducts
        startAt(term.toUpperCase()),
        endAt(term.toUpperCase() + "\uf8ff"),
        limit(12)
      );
      const snap = await getDocs(qy);
      if (cancelled) return;
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSuggestions(rows);
    })();
    return () => { cancelled = true; };
  }, [brand, term]);

  function chooseProduct(p) {
    const next = {
      brand: p.brand,
      productDocId: p.id,
      displayName: p.displayName || pretty(p.name),
      sizes: Array.isArray(p.sizes) ? p.sizes : [],
      selectedSize: "",
      barcodesBySize: p.barcodesBySize || null,
      category: p.category || null,
      name: p.name,
    };
    setPicked(next);
    setSize("");
    setSuggestions([]);
    setTerm(next.displayName);
    onChange?.(next);
  }

  function chooseSize(s) {
    setSize(s);
    const next = { ...(picked || {}), selectedSize: s };
    setPicked(next);
    onChange?.(next);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Brand</Text>
      <View style={styles.picker}>
        <Picker selectedValue={brand} onValueChange={(v) => { setBrand(v); setPicked(null); setTerm(""); setSuggestions([]); onChange?.(null); }}>
          <Picker.Item label="-- Select Brand --" value="" />
          {brands.map((b) => <Picker.Item key={b} label={b} value={b} />)}
        </Picker>
      </View>

      <Text style={styles.label}>Product</Text>
      <TextInput
        style={styles.input}
        value={term}
        onChangeText={setTerm}
        placeholder={brand ? "Type to search…" : "Pick brand first"}
        editable={!!brand}
      />
      {suggestions.length > 0 && (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={suggestions}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.suggest} onPress={() => chooseProduct(item)}>
              <Text style={styles.suggestTitle}>{item.displayName || pretty(item.name)}</Text>
              {item.sizes?.length ? <Text style={styles.note}>Sizes: {item.sizes.join(", ")}</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}

      {picked?.sizes?.length ? (
        <>
          <Text style={styles.label}>Size / Variation</Text>
          <View style={styles.picker}>
            <Picker selectedValue={size} onValueChange={chooseSize}>
              <Picker.Item label="-- Select Size --" value="" />
              {picked.sizes.map((s) => <Picker.Item key={s} label={s} value={s} />)}
            </Picker>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  picker: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" },
  suggest: { padding: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 8, backgroundColor: "#fafafa", marginTop: 6 },
  suggestTitle: { fontWeight: "600" },
  note: { color: "#666", marginTop: 2 },
});
