import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

export default function PrintLabelsSheetScreen({ route }) {
  const products = Array.isArray(route?.params?.products) ? route.params.products : [];

  const rows = products.flatMap(p => {
    const copies = Math.max(1, Number(p.copies) || 1);
    const barcode = String(p.barcode || p.id || "");
    const labelTop = (p.name || "").trim();
    const labelBottom = [p.brand, p.sizes].filter(Boolean).join(" · ");
    return Array.from({ length: copies }).map((_, i) => ({
      key: `${barcode}-${i}`,
      barcode,
      labelTop,
      labelBottom,
    }));
  });

  const renderItem = ({ item }) => (
    <View style={styles.cell}>
      {item.barcode ? (
        <QRCode key={item.key} value={item.barcode} size={110} backgroundColor="white" />
      ) : (
        <Text style={{ color: "red" }}>No barcode</Text>
      )}
      {!!item.labelTop && <Text style={styles.topText}>{item.labelTop}</Text>}
      {!!item.labelBottom && <Text style={styles.bottomText}>{item.labelBottom}</Text>}
    </View>
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(it) => it.key}
        numColumns={3}
        contentContainerStyle={styles.grid}
      />
      {Platform.OS === "web" && <Text style={styles.hint}>Use browser print.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  grid: { padding: 12, gap: 12 },
  cell: {
    width: "31%", // approx 3 per row with gaps
    aspectRatio: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    margin: "1%",
  },
  topText: { marginTop: 8, fontWeight: "600", textAlign: "center" },
  bottomText: { marginTop: 3, color: "#666", textAlign: "center", fontSize: 12 },
  hint: { textAlign: "center", marginVertical: 10, color: "#666" },
});
