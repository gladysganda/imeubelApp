import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ScannerView({ onScanned, barcodeTypes = ["code128", "qr"], hint = "Point camera at barcode" }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef(0);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted]);

  const handleScan = useCallback(
    (res) => {
      // expo-camera (CameraView) returns { data, type } in SDK 53
      const now = Date.now();
      if (now - lastScanRef.current < 1200) return; // throttle double-fires
      lastScanRef.current = now;

      const data = res?.data || res?.raw?.[0]?.data || null;
      if (data) {
        onScanned?.(data);
      }
    },
    [onScanned]
  );

  if (!permission) {
    return <View style={styles.center}><Text>Requesting camera permission…</Text></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: "center", marginBottom: 12 }}>
          We need your permission to use the camera.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes }}
        onBarcodeScanned={handleScan}
      />
      <View style={styles.overlayTop}>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <View style={styles.overlayBottom}>
        <TouchableOpacity style={styles.torchBtn} onPress={() => setTorch((t) => !t)}>
          <Ionicons name={torch ? "flashlight" : "flashlight-outline"} size={20} color="#fff" />
          <Text style={{ color: "#fff", marginLeft: 6 }}>{torch ? "Torch ON" : "Torch OFF"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  hint: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  overlayTop: { position: "absolute", top: 40, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8 },
  overlayBottom: { position: "absolute", bottom: 40, alignSelf: "center" },
  torchBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  permBtn: { backgroundColor: "#007AFF", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});