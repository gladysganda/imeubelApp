// screens/LogIncomingScreen.js  (only additions)
import ProductSearchPicker from "../components/ProductSearchPicker";

export default function LogIncomingScreen({ route, navigation }) {
  const passed = route?.params?.product || null;
  const productId = route?.params?.productId || passed?.barcode || passed?.id;
  const staffEmail = auth.currentUser?.email || "Unknown User";

  const [quantity, setQuantity] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [pick, setPick] = useState(null); // when no productId passed

  const usingPicker = !productId;

  const handleIncoming = async () => {
    const qty = Number(quantity);
    if (!qty || Number.isNaN(qty) || qty <= 0) return Alert.alert("Invalid quantity","Enter a positive number.");

    try {
      // If productId passed → keep your old logic
      if (!usingPicker) {
        const productRef = doc(db, "products", String(productId));
        const snap = await getDoc(productRef);
        if (!snap.exists()) return Alert.alert("Error","Product not found.");
        const data = snap.data() || {};
        const current = Number(data.quantity ?? data.stock ?? 0) || 0;

        await updateDoc(productRef, { quantity: current + qty, updatedAt: serverTimestamp() });

        await addDoc(collection(db, "stockLogs"), {
          type: "incoming",
          productId: String(productId),
          productName: data.name || "",
          category: data.category || null,
          brand: data.brand || null,
          sizes: data.sizes || null,
          quantity: qty,
          staffName: staffEmail,
          handledById: auth.currentUser?.uid || null,
          handledByEmail: staffEmail,
          supplierName: supplierName.trim() || null,
          note: note.trim() || null,
          timestamp: serverTimestamp(),
        });

        Alert.alert("Success","Incoming stock logged.");
        navigation.goBack();
        return;
      }

      // No product passed → use picker choice, create/increment products doc
      if (!pick || !pick.selectedSize) return Alert.alert("Missing","Pick product and size.");

      const chosenBarcode = pick?.barcodesBySize?.[pick.selectedSize] || `${Date.now()}`;
      const pRef = doc(db, "products", String(chosenBarcode));
      const ps = await getDoc(pRef);
      const base = {
        name: pick.displayName,
        brand: pick.brand,
        category: pick.category,
        sizes: pick.selectedSize,
        barcode: String(chosenBarcode),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
        updatedByEmail: staffEmail,
      };
      if (ps.exists()) {
        await updateDoc(pRef, { ...base, quantity: increment(qty) });
      } else {
        await setDoc(pRef, { ...base, quantity: qty, createdAt: serverTimestamp() });
      }

      await addDoc(collection(db, "stockLogs"), {
        type: "incoming",
        productId: String(chosenBarcode),
        productName: base.name,
        category: base.category,
        brand: base.brand,
        sizes: base.sizes,
        quantity: qty,
        staffName: staffEmail,
        handledById: auth.currentUser?.uid || null,
        handledByEmail: staffEmail,
        supplierName: supplierName.trim() || null,
        note: note.trim() || null,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Success","Incoming stock logged.");
      navigation.goBack();
    } catch (e) {
      console.error("Incoming error:", e);
      Alert.alert("Error", e?.message || "Failed to log incoming stock.");
    }
  };

  return (
    <View style={styles.container}>
      {usingPicker ? (
        <>
          <ProductSearchPicker value={pick} onChange={setPick} />
        </>
      ) : null}

      <Text style={styles.label}>Quantity</Text>
      <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="Enter quantity" />

      <Text style={styles.label}>Supplier (optional)</Text>
      <TextInput style={styles.input} value={supplierName} onChangeText={setSupplierName} placeholder="e.g. PT. Supplier Maju" />

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput style={[styles.input, { height: 80 }]} value={note} onChangeText={setNote} placeholder="Damage, missing parts, box torn, etc." multiline />

      <View style={{ height: 10 }} />
      <Button title="Log Incoming Stock" onPress={handleIncoming} />
      <View style={{ height: 8 }} />
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}
