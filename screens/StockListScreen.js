// screens/StockListScreen.js
import { Picker } from "@react-native-picker/picker";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BRAND_OPTIONS_BY_CATEGORY,
  CATEGORY_OPTIONS,
} from "../constants/options";
import { auth, db } from "../firebase";

/** Confirm helper: Alert (native) / window.confirm (web) */
const platformConfirm = async (title, message) => {
  if (Platform.OS === "web") {
    return window.confirm(`${title}\n\n${message}`);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
};

/** Cross-platform selector */
function SafeSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  enabled = true,
}) {
  const safeValue = value ?? "";
  if (!enabled) {
    return (
      <View style={[styles.input, styles.disabledBox]}>
        <Text style={{ color: "#888" }}>{placeholder}</Text>
      </View>
    );
  }

  if (Platform.OS === "ios") {
    const currentLabel =
      options.find((o) => o.value === safeValue)?.label ||
      (safeValue ? safeValue : placeholder);

    const openSheet = () => {
      const sheetOptions = [placeholder, ...options.map((o) => o.label), "Cancel"];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: sheetOptions,
          cancelButtonIndex: sheetOptions.length - 1,
        },
        (idx) => {
          if (idx === 0 || idx === sheetOptions.length - 1) return;
          const chosen = options[idx - 1];
          if (chosen) onChange(chosen.value);
        }
      );
    };

    return (
      <TouchableOpacity
        onPress={openSheet}
        activeOpacity={0.7}
        style={[styles.input, styles.selector]}
      >
        <Text style={{ color: safeValue ? "#111" : "#888" }}>
          {label ? `${label}: ` : ""}
          {currentLabel}
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
          <Picker.Item
            key={String(o.value)}
            label={String(o.label)}
            value={String(o.value)}
          />
        ))}
      </Picker>
    </View>
  );
}

/** NEW: Pending reservations table per product */
function PendingTable({ navigation, productId, totalQty }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    const qy = query(
      collection(db, "reservations"),
      where("status", "==", "pending"),
      where("productId", "==", String(productId))
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [productId]);

  if (loading || rows.length === 0) return null;

  const pendingQty = rows.reduce((a, r) => a + Number(r.qty || 0), 0);
  const available = Math.max(Number(totalQty || 0) - pendingQty, 0);

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontWeight: "700" }}>
        Pending: {pendingQty} • Available: {available}
      </Text>

      <View
        style={{
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 8,
          marginTop: 6,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            padding: 8,
            backgroundColor: "#fafafa",
          }}
        >
          <Text style={{ flex: 1, fontWeight: "700" }}>Customer</Text>
          <Text style={{ width: 64, textAlign: "right", fontWeight: "700" }}>
            Qty
          </Text>
          <Text style={{ width: 110, textAlign: "right", fontWeight: "700" }}>
            Ship Date
          </Text>
        </View>
        {rows.map((r) => (
          <View
            key={r.id}
            style={{
              flexDirection: "row",
              padding: 8,
              borderTopWidth: 1,
              borderTopColor: "#eee",
            }}
          >
            <Text style={{ flex: 1 }} numberOfLines={1}>
              {r.customerName || "Unknown"}
              {r.size ? ` • ${r.size}` : ""}
            </Text>
            <Text style={{ width: 64, textAlign: "right" }}>
              {Number(r.qty || 0)}
            </Text>
            <Text style={{ width: 110, textAlign: "right" }}>
              {r.shipmentDate || "-"}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={() =>
          navigation.navigate("PendingReservationsScreen", {
            productId: String(productId),
          })
        }
        style={{ marginTop: 6 }}
      >
        <Text style={{ color: "#1565C0" }}>View pending reservations ›</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function StockListScreen({ route, navigation }) {
  const role = route?.params?.role || "staff";
  const isOwner = role === "owner";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [fromCollection, setFromCollection] = useState("products");

  // filters + search
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [search, setSearch] = useState("");

  // sheet selection (owner only)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const unsubRef = useRef(null);

  // ---------- Live subscription to products; fallback to inventory ----------
  useEffect(() => {
    const qy = query(collection(db, "products"), orderBy("name"));
    const unsubProducts = onSnapshot(
      qy,
      async (snap) => {
        const prodList = snap.docs.map((d) => ({
          id: d.id,
          __col: "products",
          ...d.data(),
        }));
        if (prodList.length > 0) {
          setItems(prodList);
          setFromCollection("products");
          setLoading(false);
          return;
        }
        try {
          const invSnap = await getDocs(collection(db, "inventory"));
          const invList = invSnap.docs.map((d) => ({
            id: d.id,
            __col: "inventory",
            ...d.data(),
          }));
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
    const allowed =
      (BRAND_OPTIONS_BY_CATEGORY &&
        BRAND_OPTIONS_BY_CATEGORY[categoryFilter]) ||
      [];
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
    () =>
      (Array.isArray(CATEGORY_OPTIONS) ? CATEGORY_OPTIONS : []).map((c) => ({
        label: c,
        value: c,
      })),
    []
  );

  const brandOptions = useMemo(() => {
    if (!categoryFilter) return [];
    const arr =
      (BRAND_OPTIONS_BY_CATEGORY &&
        BRAND_OPTIONS_BY_CATEGORY[categoryFilter]) ||
      [];
    return arr.map((b) => ({ label: b, value: b }));
  }, [categoryFilter]);

  // filtering + search
  const filteredItems = useMemo(() => {
    const key = (s) => (s ?? "").toString().toLowerCase();
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
      const targetRef = doc(db, itemCol, String(id));
      let nameForMsg = id;
      try {
        const snap = await getDoc(targetRef);
        if (!snap.exists()) {
          Alert.alert("Not found", `No document at /${itemCol}/${id}`);
          return;
        }
        const data = snap.data() || {};
        nameForMsg = data.name || data.product || id;
      } catch {}
      const ok = await platformConfirm(
        "Delete",
        `Delete "${nameForMsg}"?\n\nPath: /${itemCol}/${id}`
      );
      if (!ok) return;
      await deleteDoc(targetRef);
      setItems((prev) =>
        prev.filter((x) => !(x.id === id && x.__col === itemCol))
      );
      Alert.alert("Deleted", `/${itemCol}/${id}`);
    } catch (e) {
      console.log("[DELETE ERROR]", e);
      let msg = e?.message || "Failed to delete item.";
      if (e?.code === "permission-denied") {
        msg =
          "Permission denied by Firestore rules. Only owners can delete.";
      }
      Alert.alert("Delete failed", msg);
    }
  };

  // ----- QR actions -----
  const viewQr = (item) => {
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
    const productPayload = {
      barcode: item.barcode || item.id,
      name: item.name || item.product || "",
      sizes: item.sizes || "",
      brand: item.brand || "",
    };
    navigation.navigate("PrintLabelScreen", {
      product: productPayload,
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
    navigation.navigate("PrintLabelsSheetScreen", {
      products: productsForSheet,
    });
  };

  const renderItem = ({ item }) => {
    const inSelection = selectionMode && role === "owner";
    const key = `${item.__col}:${item.id}`;
    const checked = selectedIds.has(key);
    const storeQty = Number(item?.qtyByWh?.store ?? 0);
    const amplasQty = Number(item?.qtyByWh?.amplas ?? 0);
    const totalQty =
      Number(item?.quantity ?? storeQty + amplasQty) || storeQty + amplasQty;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() =>
          role === "owner" && setSelectionMode((s) => !s)
        }
        onPress={() => (inSelection ? toggleSelect(item) : undefined)}
        style={[
          styles.card,
          inSelection && checked
            ? { borderColor: "#2196F3", borderWidth: 2 }
            : null,
        ]}
      >
        <Text>
          Store: {storeQty} • Amplas: {amplasQty} • Total: {totalQty}
        </Text>
        <Text style={styles.name}>
          {item.name || item.product || "Unnamed Product"}
        </Text>
        <Text>Barcode: {item.barcode || item.id}</Text>
        <Text>Stock: {totalQty}</Text>
        {item.category ? <Text>Category: {item.category}</Text> : null}
        {item.brand ? <Text>Brand: {item.brand}</Text> : null}
        {item.sizes ? <Text>Sizes: {item.sizes}</Text> : null}
        {item.material ? <Text>Material: {item.material}</Text> : null}
        {item.colors ? <Text>Colors: {item.colors}</Text> : null}

        {/* NEW: Pending reservations summary */}
        <PendingTable
          navigation={navigation}
          productId={item.id || item.barcode}
          totalQty={totalQty}
        />

        <View style={styles.actions}>
          {role === "owner" ? (
            <>
              <TouchableOpacity
                style={styles.qrButton}
                onPress={() => viewQr(item)}
              >
                <Text style={styles.buttonText}>View QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qrButton}
                onPress={() => printSingle(item)}
              >
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
              <TouchableOpacity
                style={[styles.qrButton, { backgroundColor: "#455A64" }]}
                onPress={() =>
                  navigation.navigate("TransferStockScreen", {
                    barcode: item.barcode || item.id,
                  })
                }
              >
                <Text style={styles.buttonText}>Transfer</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.qrButton}
                onPress={() => printSingle(item)}
              >
                <Text style={styles.buttonText}>Print QR</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
      <View style={styles.topRow}>
        <Text style={styles.subtitle}>Showing from: {fromCollection}</Text>
        {role === "owner" && (
          <TouchableOpacity
            style={[
              styles.toggleSel,
              selectionMode ? styles.toggleSelOn : null,
            ]}
            onPress={() => setSelectionMode((s) => !s)}
          >
            <Text style={styles.toggleSelText}>
              {selectionMode ? "Selection: ON" : "Selection: OFF"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, brand, or barcode…"
        autoCapitalize="none"
        style={styles.search}
      />
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
        placeholder={
          categoryFilter ? "All Brands" : "Select category first"
        }
        enabled={!!categoryFilter}
      />
      <FlatList
        data={filteredItems}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingBottom: role === "owner" && selectionMode ? 70 : 12,
        }}
      />
      {role === "owner" && selectionMode && (
        <View style={styles.sheetBar}>
          <Text style={{ color: "#fff" }}>
            Selected: {selectedIds.size}
          </Text>
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtitle: { fontSize: 12, color: "#555", marginBottom: 8 },
  search: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  disabledBox: { backgroundColor: "#f6f7f9" },
  selector: { justifyContent: "center" },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 10,
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
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  qrButton: {
    backgroundColor: "#1976D2",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: "#E53935",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  toggleSel: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#9E9E9E",
  },
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
  sheetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sheetBtnText: { color: "#fff", fontWeight: "700" },
});
