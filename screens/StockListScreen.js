// screens/StockListScreen.js
import { Picker } from "@react-native-picker/picker";
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BRAND_OPTIONS_BY_CATEGORY, CATEGORY_OPTIONS } from "../constants/options";
import { auth, db } from "../firebase";

/** ----- Small helper: SafeSelect -----
 * iOS: uses ActionSheet (no Picker crash)
 * Android/Web: uses Picker
 */

const platformConfirm = async (title, message) => {
  if (Platform.OS === "web") {
    // Simple blocking confirm on web
    return window.confirm(`${title}\n\n${message}`);
  }
  // On native, emulate Alert with a Promise
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
};

function SafeSelect({ label, value, onChange, options, placeholder = "Select...", enabled = true }) {
  const safeValue = value ?? ""; // never undefined

  if (!enabled) {
    return (
      <View style={[styles.input, styles.disabledBox]}>
        <Text style={{ color: "#888" }}>{placeholder}</Text>
      </View>
    );
  }

  if (Platform.OS === "ios") {
    const currentLabel =
      (options.find((o) => o.value === safeValue)?.label) || (safeValue ? safeValue : placeholder);

    const openSheet = () => {
      const sheetOptions = [placeholder, ...options.map((o) => o.label), "Cancel"];
      ActionSheetIOS.showActionSheetWithOptions(
        { options: sheetOptions, cancelButtonIndex: sheetOptions.length - 1 },
        (idx) => {
          if (idx === 0 || idx === sheetOptions.length - 1) return; // placeholder or cancel
          const chosen = options[idx - 1]; // because placeholder at 0
          if (chosen) onChange(chosen.value);
        }
      );
    };

    return (
      <TouchableOpacity onPress={openSheet} activeOpacity={0.7} style={[styles.input, styles.selector]}>
        <Text style={{ color: safeValue ? "#111" : "#888" }}>
          {label ? `${label}: ` : ""}{currentLabel}
        </Text>
      </TouchableOpacity>
    );
  }

  // Android / Web: Picker
  return (
    <View style={styles.pickerWrapper}>
      <Picker selectedValue={safeValue} onValueChange={(v) => onChange(v)}>
        <Picker.Item label={placeholder} value="" />
        {options.map((o) => (
          <Picker.Item key={String(o.value)} label={String(o.label)} value={String(o.value)} />
        ))}
      </Picker>
    </View>
  );
}

export default function StockListScreen({ route, navigation }) {
  const role = route?.params?.role || "staff"; // "owner" | "staff"
  const isOwner = role === "owner";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [fromCollection, setFromCollection] = useState("products");

  // filters + search
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [search, setSearch] = useState("");

  // sheet selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set()); // keys like "${__col}:${id}"

  const unsubRef = useRef(null);

  // ---------- Live subscription to products; fallback to inventory ----------
  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, "products"),
      async (snap) => {
        const prodList = snap.docs.map((d) => ({ id: d.id, __col: "products", ...d.data() }));
        if (prodList.length > 0) {
          setItems(prodList);
          setFromCollection("products");
          setLoading(false);
          return;
        }
        // fallback to inventory (one-time)
        try {
          const invSnap = await getDocs(collection(db, "inventory"));
          const invList = invSnap.docs.map((d) => ({ id: d.id, __col: "inventory", ...d.data() }));
          setItems(invList);
          setFromCollection("inventory");
        } catch (e) {
          console.log("Inventory fallback error:", e);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.log("onSnapshot(products) error:", err);
        setLoading(false);
      }
    );

    unsubRef.current = unsubProducts;
    return () => unsubRef.current && unsubRef.current();
  }, []);

  // keep brand valid when category changes
  useEffect(() => {
    const allowed = (BRAND_OPTIONS_BY_CATEGORY && BRAND_OPTIONS_BY_CATEGORY[categoryFilter]) || [];
    if (!categoryFilter) {
      setBrandFilter("");
      return;
    }
    if (!allowed.includes(brandFilter)) {
      setBrandFilter("");
    }
  }, [categoryFilter, brandFilter]);

  // Options for SafeSelect
  const categoryOptions = useMemo(
    () => (Array.isArray(CATEGORY_OPTIONS) ? CATEGORY_OPTIONS : []).map((c) => ({ label: c, value: c })),
    []
  );

  const brandOptions = useMemo(() => {
    if (!categoryFilter) return [];
    const arr = (BRAND_OPTIONS_BY_CATEGORY && BRAND_OPTIONS_BY_CATEGORY[categoryFilter]) || [];
    return arr.map((b) => ({ label: b, value: b }));
  }, [categoryFilter]);

  // filtering + search
  const filteredItems = useMemo(() => {
    const key = (s) => (s || "").toString().toLowerCase();
    const q = key(search);

    return items.filter((it) => {
      const matchesCategory = !categoryFilter || it.category === categoryFilter;
      const matchesBrand = !brandFilter || it.brand === brandFilter;
      const matchesSearch =
        !q ||
        key(it.name).includes(q) ||
        key(it.product).includes(q) ||
        key(it.brand).includes(q) ||
        String(it.barcode || it.id).includes(q);
      return matchesCategory && matchesBrand && matchesSearch;
    });
  }, [items, categoryFilter, brandFilter, search]);

  // ----- Delete (owner only) -----
  const handleDelete = async (id, itemCol) => {
    try {
      if (!id || !itemCol) {
        Alert.alert("Error", "Missing id or collection.");
        return;
      }

      const uid = auth?.currentUser?.uid || null;
      const email = auth?.currentUser?.email || null;
      console.log("[DELETE] path ->", `/${itemCol}/${id}`, "uid:", uid, "email:", email);

      const targetRef = doc(db, itemCol, String(id));

      // Try to read once to get a friendly name for the confirm dialog
      let nameForMsg = id;
      try {
        const snap = await getDoc(targetRef);
        if (!snap.exists()) {
          Alert.alert("Not found", `No document at /${itemCol}/${id}`);
          return;
        }
        nameForMsg = snap.data()?.name || snap.data()?.product || id;
      } catch (readErr) {
        console.log("[DELETE READ ERROR]", readErr);
      }

      // Confirm (web uses window.confirm)
      const ok = await platformConfirm(
        "Delete",
        `Delete "${nameForMsg}"?\n\nPath: /${itemCol}/${id}`
      );
      if (!ok) return;

      // Perform delete
      await deleteDoc(targetRef);

      // Optimistic UI; onSnapshot will also update
      setItems((prev) => prev.filter((x) => !(x.id === id && x.__col === itemCol)));

      Alert.alert("Deleted", `/${itemCol}/${id}`);
    } catch (e) {
      console.log("[DELETE ERROR]", {
        code: e?.code,
        message: e?.message,
        path: `/${itemCol}/${id}`,
        err: e,
      });
      let msg = e?.message || "Failed to delete item.";
      if (e?.code === "permission-denied") {
        msg =
          "Permission denied by Firestore rules.\n" +
          "• Only owners can delete.\n" +
          "• Ensure users/{uid}.role == 'owner' on this device and that rules are published.";
      }
      Alert.alert("Delete failed", msg);
    }
  };
  // ----- QR actions -----
  const viewQr = (item) => {
    if (!isOwner) return;
    navigation.navigate("PrintLabelScreen", {
      product: {
        barcode: item.barcode || item.id,
        name: item.name || item.product || "",
        sizes: item.sizes || "",
        brand: item.brand || "",
      },
      immediatePrint: false,
    });
  };

  const printSingle = (item) => {
    if (!isOwner) return;
    navigation.navigate("PrintLabelScreen", {
      product: {
        barcode: item.barcode || item.id,
        name: item.name || item.product || "",
        sizes: item.sizes || "",
        brand: item.brand || "",
      },
      immediatePrint: true,
    });
  };

  const toggleSelect = (item) => {
    const key = `${item.__col}:${item.id}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addSelectedToSheet = () => {
    if (!isOwner) return;
    if (selectedIds.size === 0) {
      Alert.alert("Nothing selected", "Select one or more items first.");
      return;
    }
    const productsForSheet = [];
    for (const key of selectedIds) {
      const [col, id] = key.split(":");
      const item = items.find((x) => x.__col === col && x.id === id);
      if (!item) continue;
      productsForSheet.push({
        barcode: item.barcode || item.id,
        name: item.name || item.product || "",
        sizes: item.sizes || "",
        brand: item.brand || "",
        copies: 1,
      });
    }
    navigation.navigate("PrintLabelsSheetScreen", { products: productsForSheet });
  };

  const renderItem = ({ item }) => {
    const inSelection = selectionMode && isOwner; // selection mode only relevant for owner
    const key = `${item.__col}:${item.id}`;
    const checked = selectedIds.has(key);

    const quantity =
      item.quantity != null ? item.quantity : item.stock != null ? item.stock : 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => isOwner && setSelectionMode((s) => !s)}
        onPress={() => (inSelection ? toggleSelect(item) : undefined)}
        style={[
          styles.card,
          inSelection && checked ? { borderColor: "#2196F3", borderWidth: 2 } : null,
        ]}
      >
        <Text style={styles.name}>{item.name || item.product || "Unnamed Product"}</Text>
        <Text>Stock: {quantity}</Text>
        {item.category ? <Text>Category: {item.category}</Text> : null}
        {item.brand ? <Text>Brand: {item.brand}</Text> : null}
        {item.material ? <Text>Material: {item.material}</Text> : null}

        <View style={styles.actions}>
          {/* Owner QR actions */}
          {isOwner && (
            <>
              <TouchableOpacity style={styles.qrButton} onPress={() => viewQr(item)}>
                <Text style={styles.buttonText}>View QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.qrButton} onPress={() => printSingle(item)}>
                <Text style={styles.buttonText}>Print QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qrButton, { backgroundColor: "#6A1B9A" }]}
                onPress={() => {
                  const k = `${item.__col}:${item.id}`;
                  setSelectedIds((prev) => new Set(prev).add(k));
                  setSelectionMode(true);
                }}
              >
                <Text style={styles.buttonText}>Add to Sheet</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Owner edit/delete */}
          {isOwner && (
            <>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  navigation.navigate("EditItemScreen", {
                    product: item,
                    fromCollection: item.__col,
                    role: "owner",
                  })
                }
              >
                <Text style={styles.buttonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id, item.__col)}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ---------- Render ----------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading stock…</Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.center}>
        <Text>No products found in “products” or “inventory”.</Text>
        <Text style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
          Make sure you’re logged in and Firestore rules allow read.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top row: collection label + (owner) selection toggle */}
      <View style={styles.topRow}>
        <Text style={styles.subtitle}>Showing from: {fromCollection}</Text>

        {isOwner && (
          <TouchableOpacity
            style={[styles.toggleSel, selectionMode ? styles.toggleSelOn : null]}
            onPress={() => setSelectionMode((s) => !s)}
          >
            <Text style={styles.toggleSelText}>
              {selectionMode ? "Selection: ON" : "Selection: OFF"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search bar (always bordered) */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, brand, or barcode…"
        autoCapitalize="none"
        style={styles.search}
      />

      {/* Filters */}
      <SafeSelect
        label="Category"
        value={categoryFilter}
        onChange={setCategoryFilter}
        options={categoryOptions}
        placeholder="All Categories"
        enabled={true}
      />

      <SafeSelect
        label="Brand"
        value={brandFilter}
        onChange={setBrandFilter}
        options={brandOptions}
        placeholder={categoryFilter ? "All Brands" : "Select category first"}
        enabled={!!categoryFilter}
      />

      {/* List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: isOwner && selectionMode ? 70 : 12 }}
      />

      {/* Selection bar (owner only) */}
      {isOwner && selectionMode && (
        <View style={styles.sheetBar}>
          <Text style={{ color: "#fff" }}>Selected: {selectedIds.size}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: "#FF7043" }]}
              onPress={() => setSelectedIds(new Set())}
            >
              <Text style={styles.sheetBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: "#00C853" }]}
              onPress={addSelectedToSheet}
            >
              <Text style={styles.sheetBtnText}>Print Sheet</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subtitle: { fontSize: 12, color: "#555", marginBottom: 8 },

  // Always-bordered search bar
  search: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },

  // inputs / pickers
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, backgroundColor: "#fff", marginBottom: 10,
  },
  disabledBox: { backgroundColor: "#f6f7f9" },
  selector: { justifyContent: "center" },
  pickerWrapper: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", marginBottom: 10,
  },

  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: "600", marginBottom: 6 },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  qrButton: { backgroundColor: "#1976D2", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  editButton: { backgroundColor: "#4CAF50", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  deleteButton: { backgroundColor: "#E53935", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },

  toggleSel: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#9E9E9E" },
  toggleSelOn: { backgroundColor: "#1565C0" },
  toggleSelText: { color: "#fff", fontWeight: "600" },

  sheetBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#263238",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  sheetBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  sheetBtnText: { color: "#fff", fontWeight: "700" },
});
