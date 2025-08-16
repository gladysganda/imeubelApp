// screens/StockListScreen.js
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { auth, db } from "../firebase";

// ⬇️ NEW: dropdown  options
import { Picker } from "@react-native-picker/picker";
import { BRAND_OPTIONS_BY_CATEGORY, CATEGORY_OPTIONS } from "../constants/options";

export default function StockListScreen({ route, navigation }) {
    // role comes from navigate('StockListScreen', { role: 'owner' | 'staff' })
    const role = route?.params?.role || "staff";

    const [loading, setLoading] = useState(true);

    // Which collection the list is showing (products by default, fall back to inventory if empty)
    const [fromCollection, setFromCollection] = useState("products");
    const [items, setItems] = useState([]);

    const unsubRef = useRef(null);

    // ⬇️ NEW: filters
    const [categoryFilter, setCategoryFilter] = useState("");
    const [brandFilter, setBrandFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // --- Live subscription to products; fallback to inventory if products empty ---
    useEffect(() => {
        const unsubProducts = onSnapshot(
            collection(db, "products"),
            async (snap) => {
                const prodList = snap.docs.map((d) => ({ id: d.id, __col: "products", ...d.data() }));
                if (prodList.length > 0) {
                    setItems(prodList);
                    setLoading(false);
                    return;
                }

                // fallback to inventory one-time read
                try {
                    const invSnap = await getDocs(collection(db, "inventory"));
                    const invList = invSnap.docs.map((d) => ({ id: d.id, __col: "inventory", ...d.data() }));
                    setItems(invList);
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
        return () => {
            if (unsubRef.current) unsubRef.current();
        };
    }, []);

    // ⬇️ NEW: when category changes, clear brand if it’s not valid for the new category
    useEffect(() => {
        if (!categoryFilter) {
            setBrandFilter("");
            return;
        }
        const allowed = BRAND_OPTIONS_BY_CATEGORY[categoryFilter] || [];
        if (!allowed.includes(brandFilter)) {
            setBrandFilter("");
        }
    }, [categoryFilter, brandFilter]);

    const confirmAsync = (title, message) => {
        if (Platform.OS === "web") {
            // window.confirm returns true/false
            return Promise.resolve(window.confirm(`${title}\n\n${message}`));
        }
        return new Promise((resolve) => {
            Alert.alert(title, message, [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ]);
        });
    };

    // ⬇️ NEW: apply filters to items (memoized)
    const filteredItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return items.filter((item) => {
            const matchesCategory = !categoryFilter || item.category === categoryFilter;
            const matchesBrand = !brandFilter || item.brand === brandFilter;

            if (!q) return matchesCategory && matchesBrand;

            // fields we’ll search through
            const haystack = [
                item.name,
                item.product,
                item.brand,
                item.category,
                item.barcode,
                item.material,
                item.sizes,
                item.colors,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch = haystack.includes(q);
            return matchesCategory && matchesBrand && matchesSearch;
        });
    }, [items, categoryFilter, brandFilter, searchQuery]);

    const handleDelete = async (id, itemCol) => {
        try {
            if (!id || !itemCol) {
                Alert.alert("Error", "Missing id or collection.");
                return;
            }

            const uid = auth?.currentUser?.uid || null;
            if (!uid) {
                Alert.alert("Not signed in", "You must be signed in to delete.");
                return;
            }

            const targetRef = doc(db, itemCol, String(id));
            const targetSnap = await getDoc(targetRef);
            if (!targetSnap.exists()) {
                Alert.alert("Not found", `No document at /${itemCol}/${id}`);
                return;
            }

            const ok = await confirmAsync(
                "Delete",
                `Delete "${targetSnap.data().name || id}"?\n\nPath: /${itemCol}/${id}`
            );
            if (!ok) return;

            try {
                await deleteDoc(targetRef);

                // Also try removing a duplicate in the other collection (migration safety)
                const otherCol = itemCol === "products" ? "inventory" : "products";
                try {
                    const otherRef = doc(db, otherCol, String(id));
                    const otherSnap = await getDoc(otherRef);
                    if (otherSnap.exists()) {
                        await deleteDoc(otherRef);
                        console.log(`[DELETE] Also removed duplicate at /${otherCol}/${id}`);
                    }
                } catch { }

                // Optimistic UI
                setItems((prev) => prev.filter((x) => !(x.id === id && x.__col === itemCol)));
                Alert.alert("Deleted", `/${itemCol}/${id}`);

                // If your list came from inventory fallback, refresh it
                const hasAnyInventory = items.some((x) => x.__col === "inventory");
                if (hasAnyInventory) {
                    await refreshInventoryList();
                }
            } catch (e) {
                console.log("[DELETE ERROR]", {
                    code: e?.code,
                    message: e?.message,
                    path: `/${itemCol}/${id}`,
                    uid,
                    email,
                });
                let msg = e?.message || "Failed to delete item.";
                Alert.alert("Delete failed", msg);
            }

        } catch (outer) {
            console.log("[DELETE OUTER ERROR]", outer);
            Alert.alert("Error", outer?.message || "Unexpected error.");
        }
    };

    // put this helper below the handler (same file)
    const refreshInventoryList = async () => {
        try {
            const invSnap = await getDocs(collection(db, "inventory"));
            const invList = invSnap.docs.map(d => ({ id: d.id, __col: "inventory", ...d.data() }));
            setItems(invList);
        } catch (e) {
            console.log("Inventory refresh error:", e);
        }
    };

    const renderItem = ({ item }) => (

        <View style={styles.card}>
            <Text style={styles.name}>{item.name || item.product || "Unnamed Product"}</Text>
            {role === "owner" && item.price != null && <Text>Price: {item.price}</Text>}
            <Text>
                Stock:{" "}
                {item.quantity != null ? item.quantity : item.stock != null ? item.stock : 0}
            </Text>
            {item.category ? <Text>Category: {item.category}</Text> : null}
            {item.brand ? <Text>Brand: {item.brand}</Text> : null}
            {item.sizes ? <Text> Size: {item.sizes}</Text> : null}
            {item.material ? <Text>Material: {item.material}</Text> : null}

            {role === "owner" && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() =>
                            navigation.navigate("EditItemScreen", {
                                product: item,
                                fromCollection: item.__col, // pass exact collection
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
                </View>
            )}
        </View>
    );

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
            <View style={{ marginBottom: 8 }}>
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search name, brand, barcode, category…"
                    style={styles.searchInput}
                    returnKeyType="search"
                />
            </View>
            {/* ⬇️ NEW: Filters */}
            <View style={{ marginBottom: 8 }}>
                {/* Category filter */}
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={categoryFilter}
                        onValueChange={(v) => setCategoryFilter(v)}
                    >
                        <Picker.Item label="All Categories" value="" />
                        {CATEGORY_OPTIONS.map((c) => (
                            <Picker.Item key={c} label={c} value={c} />
                        ))}
                    </Picker>
                </View>

                {/* Brand filter (depends on category) */}
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={brandFilter}
                        onValueChange={(v) => setBrandFilter(v)}
                        enabled={!!categoryFilter}
                    >
                        <Picker.Item
                            label={categoryFilter ? "All Brands" : "Select category first"}
                            value=""
                        />
                        {categoryFilter &&
                            (BRAND_OPTIONS_BY_CATEGORY[categoryFilter] || []).map((b) => (
                                <Picker.Item key={b} label={b} value={b} />
                            ))}
                    </Picker>
                </View>
            </View>

            <FlatList
                data={filteredItems}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 12, backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
    subtitle: { fontSize: 12, color: "#555", marginBottom: 8 },
    card: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#eee",
        padding: 14,
        borderRadius: 10,
        marginBottom: 10,
    },
    name: { fontSize: 18, fontWeight: "600", marginBottom: 6 },
    actions: { flexDirection: "row", marginTop: 10, gap: 8 },
    editButton: { backgroundColor: "#4CAF50", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
    deleteButton: { backgroundColor: "#E53935", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
    buttonText: { color: "#fff", fontWeight: "600" },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#fff",
        marginBottom: 10,
    },
    searchInput: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#fff",
    },
});
