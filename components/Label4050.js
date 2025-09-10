// components/Label4050.js
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import QRCode from "react-native-qrcode-svg"; // ✅ default import

/**
 * 50mm x 40mm label content (portrait)
 * props:
 *  - barcode (string)  -> QR contents
 *  - name (string)
 *  - sizes (string)
 *  - brand (string)
 */
export default function Label4050({ barcode = "", name = "", sizes = "", brand = "" }) {
  // ~23mm QR on a 50x40mm label ≈ 85–100px depending on DPI. 90 is a good middle ground.
  const qrSizePx = 90;

  return (
    <View style={styles.card}>
      <View style={styles.qrRow}>
        <View style={styles.qrBox}>
          {/* react-native-qrcode-svg renders on native + web via react-native-svg */}
          {!!barcode && <QRCode value={String(barcode)} size={qrSizePx} />}
        </View>
      </View>

      <View style={styles.textCol}>
        {!!name && <Text style={styles.name} numberOfLines={2}>{name}</Text>}
        {!!sizes && <Text style={styles.meta}>{sizes}</Text>}
        {!!brand && <Text style={styles.meta}>{brand}</Text>}
        {!!barcode && <Text style={styles.code}>{barcode}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // This “card” is our 50mm x 40mm content box (visual framing in-app).
  // Actual paper sizing on web is handled with @page in PrintLabelScreen.
  card: {
    width: 260,   // visual preview only; printing uses CSS in PrintLabelScreen
    height: 208,  // 50x40mm-ish preview (not exact mm here)
    padding: 8,
    backgroundColor: "#fff",
    borderWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "#ddd",
    justifyContent: "flex-start",
  },
  qrRow: { alignItems: "center", marginBottom: 6 },
  qrBox: { justifyContent: "center", alignItems: "center" },
  textCol: { marginTop: 2 },
  name: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12, color: "#333" },
  code: { fontSize: 12, marginTop: 2 },
});
