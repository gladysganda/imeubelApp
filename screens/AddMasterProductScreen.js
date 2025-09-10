// screens/AddMasterProductScreen.js
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

import {
  BRAND_OPTIONS_BY_CATEGORY as RAW_BRANDS,
  CATEGORY_OPTIONS as RAW_CATS,
  OTHER_VALUE as OTHER, // if you don't have OTHER_VALUE, remove related bits
} from "../constants/options";

const CATEGORY_OPTIONS = Array.isArray(RAW_CATS) ? RAW_CATS.filter(Boolean).map(String) : [];
const BRANDS_BY_CAT = RAW_BRANDS && typeof RAW_BRANDS === "object" ? RAW_BRANDS : {};

function getBrandsFor(cat) {
  const arr = BRANDS_BY_CAT[cat];
  return Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
}

export default function AddMasterProductScreen({ route, navigation }) {
  const role = route?.params?.role || "staff";
  const isOwner = role === "owner";

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [sizes, setSizes] = useState("");     // comma-separated: "90x200, 100x200"
  const [material, setMaterial] = useState("");
  const [colors, setColors] = useState("");
  const [aliases, setAliases] = useState(""); // comma-separated alt spellings

  const brandsForCategory = useMemo(() => getBrandsFor(category), [category]);

  useEffect(() => {
    if (!brandsForCategory.includes(brand) && brand !== OTHER) {
      setBrand("");
      setCustomBrand("");
    }
  }, [category]); // eslint-disable-line

  if (!isOwner) {
    return (
      <View style={styles.center}>
        <Text>Owner permission required.</Text>
      </View>
    );
  }

  const onSave = async () => {
    const nm = name.trim();
    if (!nm) return Alert.alert("Validation", "Name is required.");

    const finalBrand = brand === OTHER ? customBrand.trim() : brand.trim();

    const sizeList = sizes.split(",").map(s => s.trim()).filter(Boolean);
    const aliasList = aliases.split(",").map(s => s.trim()).filter(Boolean);

    const docBody = {
      name: nm,
      nameLower: nm.toLowerCase(),
      category: category || null,
      brand: finalBrand || null,
      sizes: sizeList,                 // array of strings
      material: material.trim() || null,
      colors: colors.trim() || null,
      aliases: aliasList,              // helps fuzzy searches
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || null,
      createdByEmail: auth.currentUser?.email || null,
    };

    try {
      await addDoc(collection(db, "masterProducts"), docBody);
      Alert.alert("Saved", "Master product created.");
      navigation.goBack();
    } catch (e) {
      console.error("Add master product failed:", e);
      Alert.alert("Error", e?.message || "Failed to create master product.");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create Master Product</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Canonical product name" />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={category} onValueChange={setCategory}>
            <Picker.Item label="-- Select Category --" value="" />
            {CATEGORY_OPTIONS.map(c => <Picker.Item key={c} label={c} value={c} />)}
          </Picker>
        </View>

        <Text style={styles.label}>Brand</Text>
        <View style={styles.pickerWrapper}>
          <Picker enabled={!!category} selectedValue={brand} onValueChange={setBrand}>
            <Picker.Item label={category ? "-- Select Brand --" : "Select category first"} value="" />
            {brandsForCategory.map(b => <Picker.Item key={b} label={b} value={b} />)}
            {!!category && OTHER ? <Picker.Item label="Other…" value={OTHER} /> : null}
          </Picker>
        </View>

        {brand === OTHER && (
          <>
            <Text style={styles.label}>Type Brand</Text>
            <TextInput style={styles.input} value={customBrand} onChangeText={setCustomBrand} placeholder="Custom brand name" />
          </>
        )}

        <Text style={styles.label}>Sizes (comma-separated)</Text>
        <TextInput style={styles.input} value={sizes} onChangeText={setSizes} placeholder="e.g. 90x200, 100x200, 160x200" />

        <Text style={styles.label}>Material (optional)</Text>
        <TextInput style={styles.input} value={material} onChangeText={setMaterial} placeholder="e.g. Kayu, Besi" />

        <Text style={styles.label}>Colors (optional)</Text>
        <TextInput style={styles.input} value={colors} onChangeText={setColors} placeholder="e.g. Walnut, Black" />

        <Text style={styles.label}>Aliases (optional, comma-separated)</Text>
        <TextInput style={styles.input} value={aliases} onChangeText={setAliases} placeholder="World Endorsed, WorldEndorsed" />

        <View style={{ height: 12 }} />
        <Button title="Save Master Product" onPress={onSave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" },
});
