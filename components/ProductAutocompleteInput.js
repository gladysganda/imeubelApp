// components/ProductAutocompleteInput.js
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAt, endAt } from "firebase/firestore";
import { db } from "../firebase";

export default function ProductAutocompleteInput({
  value,
  onChangeText,
  onPickProduct,
  placeholder = "Product name",
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    const needle = (value || "").trim();
    const s = needle.toLowerCase();
    let cancelled = false;

    (async () => {
      if (!s) {
        setResults([]);
        setOpen(false);
        return;
      }

      try {
        const out = [];

        // prefix on nameLower
        try {
          const col = collection(db, "products");
          const qy = query(col, orderBy("nameLower"), startAt(s), endAt(s + "\uf8ff"), limit(10));
          const snap = await getDocs(qy);
          snap.forEach(d => out.push({ id: d.id, ...(d.data() || {}) }));
        } catch {}

        // fallback on name
        if (!out.length) {
          try {
            const col = collection(db, "products");
            const qy = query(col, orderBy("name"), startAt(needle), endAt(needle + "\uf8ff"), limit(10));
            const snap = await getDocs(qy);
            snap.forEach(d => out.push({ id: d.id, ...(d.data() || {}) }));
          } catch {}
        }

        // exact id/barcode
        try {
          const byId = await getDoc(doc(db, "products", needle));
          if (byId.exists()) {
            const d = byId.data() || {};
            if (!out.find(x => x.id === byId.id)) out.unshift({ id: byId.id, ...d });
          }
        } catch {}

        if (cancelled) return;
        setResults(out.slice(0, 10));
        setOpen(out.length > 0);
      } catch {
        if (cancelled) return;
        setResults([]);
        setOpen(false);
      }
    })();

    return () => { cancelled = true; };
  }, [value]);

  const pick = (p) => {
    onChangeText?.(p.name || p.id);
    onPickProduct?.({
      id: p.id,
      name: p.name || p.id,
      sizes: p.sizes || "",     // pass sizes up
    });
    setOpen(false);
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => { onChangeText?.(t); }}
        placeholder={placeholder}
        autoCapitalize="words"
      />
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => pick(item)} style={styles.item}>
                <Text style={styles.itemTitle}>{item.name || item.id}</Text>
                {!!item.brand && <Text style={styles.itemMeta}>{item.brand}</Text>}
                {!!item.sizes && <Text style={styles.itemMeta} numberOfLines={1}>Sizes: {String(item.sizes)}</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff", marginBottom: 8 },
  dropdown: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, backgroundColor: "#fff", maxHeight: 220, marginBottom: 8 },
  item: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  itemTitle: { fontWeight: "700" },
  itemMeta: { color: "#555", marginTop: 2 }
});
