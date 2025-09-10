import { BarCodeScanner } from 'expo-barcode-scanner';
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { db } from "../firebase";

export default function ScanBarcodeScreen({ navigation, route }) {
  const { staffName } = route.params; // Passed from login or context
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);

    // Fetch product from Firestore by barcode
    const productRef = doc(db, "products", data);
    const productSnap = await getDoc(productRef);

    if (productSnap.exists()) {
      setProduct({ id: productSnap.id, ...productSnap.data() });
    } else {
      alert("Product not found!");
      setScanned(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setProduct(null);
  };

  if (hasPermission === null) return <Text>Requesting camera permission...</Text>;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  return (
    <View style={styles.container}>
      {!scanned ? (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      ) : product ? (
        <View style={styles.details}>
          <Text style={styles.title}>{product.name}</Text>
          <Text>Price: {product.price}</Text>
          <Text>Material: {product.material}</Text>
          <Text>Sizes: {product.sizes}</Text>
          <Text>Colors: {product.colors}</Text>
          <Text>Stock: {product.quantity}</Text>

          <Button
            title="Go to Stock Actions"
            onPress={() =>
              navigation.navigate("ProductActionScreen", { product, staffName })
            }
          />
          <Button title="Scan Again" onPress={resetScanner} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  details: { flex: 1, padding: 20 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
});
