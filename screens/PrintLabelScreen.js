// screens/PrintLabelScreen.js
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, Button, Platform, StyleSheet, Alert } from "react-native";

// Android share-to-RawBT
import ViewShot from "react-native-view-shot";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * route.params:
 *  - product: { barcode, name, sizes, brand }
 *  - immediatePrint?: boolean   (web only — unchanged)
 */
export default function PrintLabelScreen({ route, navigation }) {
  const product = route?.params?.product || {};
  const immediatePrint = !!route?.params?.immediatePrint;

  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [printing, setPrinting] = useState(false); // prevents double-fire
  const firedRef = useRef(false); // prevents duplicate immediate web prints

  // Capture only the visible label (android → RawBT)
  const shotRef = useRef(null);

  const qrUrl = product?.barcode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(
        String(product.barcode)
      )}`
    : null;

  // -------------------- WEB: single perfect page (unchanged idea) --------------------
  function openAndPrintSinglePage(p) {
    const name = (p?.name || "").toString();
    const sizes = (p?.sizes || "").toString();
    const brand = (p?.brand || "").toString();
    const code = (p?.barcode || "").toString();

    const url = code
      ? `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(code)}`
      : `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(name || " ")}`;

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Print Label</title>
<style>
  @page { size: 50mm 40mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 49.7mm; height: 39.7mm; /* tiny undersize avoids page-2 bug */
    overflow: hidden;
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }
  body { display: grid; place-items: center; }
  .safe {
    width: 47mm; height: 37mm;
    display: flex; flex-direction: row;
    align-items: center; justify-content: center;
    gap: 2mm;
  }
  .qrBox { width: 23mm; height: 23mm; display:flex; align-items:center; justify-content:center; }
  .qrBox img { width: 22.2mm; height: 22.2mm; }
  .col {
    max-width: 22mm;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .name { font-weight: 700; font-size: 12px; line-height: 14px; margin-bottom: 1mm; text-align: left; }
  .meta { font-size: 10px; line-height: 12px; margin-bottom: .7mm; text-align: left; }
  .code { font-size: 10px; line-height: 12px; margin-top: .6mm; text-align: left; word-break: break-all; }
  .safe, .qrBox, .col { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="safe">
    <div class="qrBox"><img id="qrImg" alt="QR" src="${url}"></div>
    <div class="col">
      ${name ? `<div class="name">${escapeHtml(name)}</div>` : ""}
      ${sizes ? `<div class="meta">${escapeHtml(sizes)}</div>` : ""}
      ${brand ? `<div class="meta">${escapeHtml(brand)}</div>` : ""}
      ${code ? `<div class="code">${escapeHtml(code)}</div>` : ""}
    </div>
  </div>
  <script>
    function done() {
      setTimeout(function(){ window.print(); setTimeout(function(){ window.close(); }, 300); }, 80);
    }
    var img = document.getElementById('qrImg');
    if (img.complete) { done(); } else { img.onload = done; img.onerror = done; }
  </script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=650,height=500");
    if (!w) {
      alert("Popup blocked. Please allow popups to print the label.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // WEB: auto-print once (prevents duplicate firing)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!immediatePrint) return;
    if (firedRef.current) return;

    const kick = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      openAndPrintSinglePage(product);
    };

    if (!product?.barcode) {
      kick();
      return;
    }
    if (qrLoaded || qrFailed) kick();
  }, [immediatePrint, qrLoaded, qrFailed, product?.barcode]);

  // -------------------- Android: open to RawBT as exact 400×320 PNG --------------------
  async function openInRawBT() {
    if (Platform.OS !== "android") {
      Alert.alert("Android only", "Open in RawBT is Android-only.");
      return;
    }
    if (printing) return;

    try {
      setPrinting(true);

      // Ensure the shot area has exactly the pixels we want to capture.
      // We explicitly set width/height on ViewShot capture — this ignores on-screen scale.
      const tmpPng = await shotRef.current?.capture({
        format: "png",
        quality: 1,
        width: 400,  // 50 mm @ 203 dpi
        height: 320, // 40 mm @ 203 dpi
        result: "tmpfile",
      });
      if (!tmpPng) throw new Error("Failed to capture label image.");

      const target = FileSystem.cacheDirectory + `label_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: tmpPng, to: target });

      await Sharing.shareAsync(target, {
        dialogTitle: "Open with RawBT",
        mimeType: "image/png",
        UTI: "public.png",
      });
    } catch (e) {
      console.log("Share to RawBT failed:", e);
      Alert.alert("Share failed", e?.message || "Could not share image.");
    } finally {
      setTimeout(() => setPrinting(false), 500);
    }
  }

  // Generic Print button — web only (Android uses “Open in RawBT”)
  const handlePrint = async () => {
    if (printing) return;
    try {
      setPrinting(true);
      if (Platform.OS === "web") {
        openAndPrintSinglePage(product);
      } else if (Platform.OS === "android") {
        Alert.alert("Android printing", "Use the 'Open in RawBT' button below.");
      } else {
        Alert.alert("Not supported", "Printing on iOS isn’t wired yet.");
      }
    } finally {
      setTimeout(() => setPrinting(false), 500);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Only the preview box is captured to PNG for RawBT */}
      <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
        <View style={styles.previewCard}>
          <View style={styles.row}>
            <View style={styles.qrBox}>
              {qrUrl ? (
                <Image
                  source={{ uri: qrUrl }}
                  style={styles.qr}
                  onLoad={() => setQrLoaded(true)}
                  onError={() => setQrFailed(true)}
                />
              ) : (
                <View style={[styles.qr, styles.qrFallback]}>
                  <Text style={styles.meta}>No QR</Text>
                </View>
              )}
            </View>

            <View style={styles.col}>
              {!!product?.name && <Text style={styles.name} numberOfLines={2}>{product.name}</Text>}
              {!!product?.sizes && <Text style={styles.meta} numberOfLines={1}>{product.sizes}</Text>}
              {!!product?.brand && <Text style={styles.meta} numberOfLines={1}>{product.brand}</Text>}
              {!!product?.barcode && <Text style={styles.code} numberOfLines={1}>{String(product.barcode)}</Text>}
            </View>
          </View>
        </View>
      </ViewShot>

      <View style={styles.controls}>
        <Button title={printing ? "Working..." : "Print"} onPress={handlePrint} disabled={printing} />
        {Platform.OS === "android" ? (
          <>
            <View style={{ height: 8 }} />
            <Button title={printing ? "Opening…" : "Open in RawBT"} onPress={openInRawBT} disabled={printing} />
          </>
        ) : null}
        <View style={{ height: 8 }} />
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", alignItems: "center", padding: 12 },

  // Visual preview only (capture size is controlled by ViewShot width/height above)
  previewCard: {
    width: 300,         // on-screen preview
    height: 240,        // 5:4 aspect to mimic 50×40mm
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
  },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },

  qrBox: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  qr: { width: 104, height: 104, resizeMode: "contain" },
  qrFallback: { backgroundColor: "#eee", alignItems: "center", justifyContent: "center" },

  col: { flexShrink: 1, maxWidth: 140 },

  name: {
    fontWeight: "700",
    fontSize: Platform.OS === "web" ? 12 : 11,
    lineHeight: 14,
    marginBottom: 4,
    textAlign: "left",
  },
  meta: { fontSize: Platform.OS === "web" ? 10 : 9.5, lineHeight: 12, marginBottom: 2, textAlign: "left" },
  code: { fontSize: Platform.OS === "web" ? 10 : 9.5, lineHeight: 12, marginTop: 2, textAlign: "left" },

  controls: { marginTop: 12, width: 220 },
});
