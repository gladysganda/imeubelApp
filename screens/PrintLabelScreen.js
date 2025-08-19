import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

export default function PrintLabelScreen({ route }) {
  const product = route?.params?.product || {};
  const barcode = String(product.barcode || product.id || "");

  const labelTop = (product.name || "").trim();
  const labelBottom = [product.brand, product.sizes].filter(Boolean).join(" · ");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Label Preview</Text>

      {barcode ? (
        <View style={styles.qrWrap}>
          {/* key forces re-render if barcode changes */}
          <QRCode
            key={barcode}
            value={barcode}
            size={200}
            backgroundColor="white"
          />
        </View>
      ) : (
        <Text style={{ color: "red" }}>No barcode value.</Text>
      )}

      {!!labelTop && <Text style={styles.topText}>{labelTop}</Text>}
      {!!labelBottom && <Text style={styles.bottomText}>{labelBottom}</Text>}

      {Platform.OS === "web" && (
        <Text style={styles.hint}>Use the browser’s Print to print this label.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  qrWrap: {
    padding: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topText: { marginTop: 10, fontSize: 16, fontWeight: "600", textAlign: "center" },
  bottomText: { marginTop: 4, fontSize: 14, color: "#555", textAlign: "center" },
  hint: { marginTop: 16, color: "#666" },
});
