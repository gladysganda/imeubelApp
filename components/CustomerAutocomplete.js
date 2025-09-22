// components/CustomerAutocomplete.js
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { collection, getDocs, limit, orderBy, query, startAt, endAt } from "firebase/firestore";
import { db } from "../firebase";

export default function CustomerAutocomplete({ value, onChangeName, addressValue, onChangeAddress, onPicked, placeholder = "Customer name" }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);

  const name = value ?? "";
  const address = addressValue ?? "";

  useEffect(() => {
    const s = name.trim().toLowerCase();
    if (!s) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const col = collection(db, "customers");
        const qy = query(col, orderBy("nameLower"), startAt(s), endAt(s + "\uf8ff"), limit(10));
        const snap = await getDocs(qy);
        if (cancelled) return;
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setResults(arr);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(false);
      }
    })();
    return () => { cancelled = true; };
  }, [name]);

  const pick = (c) => {
    onChangeName?.(c.name || "");
    onChangeAddress?.(c.address || "");
    onPicked?.(c);
    setOpen(false);
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(t) => { onChangeName?.(t); }}
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
                <Text style={styles.itemTitle}>{item.name}</Text>
                {!!item.phone && <Text style={styles.itemMeta}>{item.phone}</Text>}
                {!!item.address && <Text style={styles.itemMeta} numberOfLines={1}>{item.address}</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      )}
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={(t) => onChangeAddress?.(t)}
        placeholder="Customer address"
        autoCapitalize="sentences"
      />
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
