// components/Label7030.js
import React from "react";
import { Platform, View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";

/**
 * Exact 70mm x 30mm label component
 * - QR on the left
 * - Text on the right
 *
 * Web uses real mm units so printing matches the sticker size.
 * Native uses pixel equivalents (300dpi ≈ 827x354px) so it looks the same on screen.
 */

const MM_TO_PX_300DPI = (mm) => Math.round((mm / 25.4) * 300);

const SIZE = {
  widthMM: 70,
  heightMM: 30,
  // Safe content padding
  padMM: 2, // 2mm all sides
  // QR size
  qrMM: 26, // 26mm square (fits with padding + text block)
};

const WEB = Platform.OS === "web";

// For native screens we render in ~300dpi pixels so the proportions are identical
const PX = {
  width: MM_TO_PX_300DPI(SIZE.widthMM),
  height: MM_TO_PX_300DPI(SIZE.heightMM),
  pad: MM_TO_PX_300DPI(SIZE.padMM),
  qr: MM_TO_PX_300DPI(SIZE.qrMM),
};

export default function Label7030({ barcode, name, sizes, brand }) {
  const containerStyle = WEB
    ? [
        styles.container,
        {
          width: `${SIZE.widthMM}mm`,
          height: `${SIZE.heightMM}mm`,
          padding: `${SIZE.padMM}mm`,
        },
      ]
    : [
        styles.container,
        {
          width: PX.width,
          height: PX.height,
          padding: PX.pad,
        },
      ];

  const qrSize = WEB ? `${SIZE.qrMM}mm` : PX.qr;

  return (
    <View style={containerStyle}>
      {/* Left: QR */}
      <View style={styles.qrCol}>
        <QRCode value={String(barcode || "")} size={qrSize} />
      </View>

      {/* Right: Text block */}
      <View style={styles.textCol}>
        {/* Product name (max 2 lines) */}
        <Text numberOfLines={2} style={styles.name}>
          {name || "-"}
        </Text>

        {/* Row 1: Brand (hide if empty) */}
        {!!brand && (
          <Text numberOfLines={1} style={styles.meta}>
            {brand}
          </Text>
        )}

        {/* Row 2: Sizes (hide if empty) */}
        {!!sizes && (
          <Text numberOfLines={1} style={styles.meta}>
            {sizes}
          </Text>
        )}

        {/* Barcode in monospace for operators */}
        <Text numberOfLines={1} style={styles.barcodeMono}>
          {String(barcode || "")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // White background, hairline border for visual alignment
    backgroundColor: "#fff",
    borderColor: "#000",
    borderWidth: Platform.OS === "web" ? 0 : StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
    // Prevent any scaling weirdness
    transform: [{ scale: 1 }],
  },
  qrCol: {
    // QR column: fixed width (just fits QR) + a tiny gap
    marginRight: Platform.OS === "web" ? "2mm" : MM_TO_PX_300DPI(2),
    justifyContent: "center",
    alignItems: "center",
  },
  textCol: {
    flex: 1,
    justifyContent: "center",
  },

  // Typography sizes chosen to fit 30mm height comfortably.
  name: {
    fontWeight: "700",
    // ~3.2mm font
    fontSize: Platform.OS === "web" ?  "3.2mm" :  Math.round((3.2/25.4)*300),
    lineHeight: Platform.OS === "web" ? "4.2mm" :  Math.round((4.2/25.4)*300),
  },
  meta: {
    // ~2.6mm font
    color: "#111",
    fontSize: Platform.OS === "web" ?  "2.6mm" :  Math.round((2.6/25.4)*300),
    lineHeight: Platform.OS === "web" ? "3.6mm" :  Math.round((3.6/25.4)*300),
  },
  barcodeMono: {
    marginTop: Platform.OS === "web" ? "1mm" : MM_TO_PX_300DPI(1),
    // monospace + slightly smaller
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    // ~2.8mm font
    fontSize: Platform.OS === "web" ?  "2.8mm" :  Math.round((2.8/25.4)*300),
    lineHeight: Platform.OS === "web" ? "3.6mm" :  Math.round((3.6/25.4)*300),
  },
});
