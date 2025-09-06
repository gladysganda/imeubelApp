// utils/androidLabelPrint.android.js
import { Alert, PermissionsAndroid, Platform } from "react-native";
import BluetoothSerial from "react-native-bluetooth-serial-next";
import { buildTspl50x40 } from "./tspl";

/**
 * Native Android TSPL printing via SPP/RFCOMM using react-native-bluetooth-serial-next
 * Params:
 *   - product: { name, sizes, brand, barcode }
 *   - printerMac?: string  (preferred exact MAC)
 *   - printerNameHint?: string (fallback name contains, e.g. "LP-T368BT")
 */
export async function printAndroidLabel({ product, printerMac, printerNameHint = "LP-T368" }) {
  if (Platform.OS !== "android") {
    Alert.alert("Not supported", "Android-only printing method.");
    return;
  }

  try {
    // 1) Ask runtime permissions (Android 12+ needs CONNECT/SCAN)
    const need = [];
    if (Platform.Version >= 31) { // Android 12+
      need.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );
    } else {
      need.push(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION // needed by many BT scans pre-12
      );
    }
    const results = await PermissionsAndroid.requestMultiple(need);
    const denied = Object.entries(results).filter(([, v]) => v !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied.length) {
      Alert.alert("Permissions", "Bluetooth permissions are required to print.");
      return;
    }

    // 2) Ensure Bluetooth is enabled
    const isEnabled = await BluetoothSerial.isEnabled();
    if (!isEnabled) {
      const ok = await BluetoothSerial.enable();
      if (!ok) throw new Error("Bluetooth not enabled");
    }

    // 3) Find the printer (by MAC if provided, else by name hint in paired devices)
    let targetId = printerMac || null;

    if (!targetId) {
      const paired = await BluetoothSerial.list(); // [{id, name, ...}]
      if (!Array.isArray(paired) || paired.length === 0) {
        Alert.alert("No printer", "Pair your label printer in Android Bluetooth Settings first.");
        return;
      }
      const guess = paired.find(
        d =>
          (d?.id && typeof d.id === "string" && d.id.includes(":")) || // MAC-like
          (d?.name && typeof d.name === "string" && d.name.toLowerCase().includes(printerNameHint.toLowerCase()))
      ) || paired[0];

      targetId = guess?.id;
      if (!targetId) {
        Alert.alert("Printer not found", "Couldn’t resolve a device id (MAC). Please select one by MAC.");
        return;
      }
    }

    // 4) Connect
    // If already connected to something else, disconnect
    try { await BluetoothSerial.disconnect(); } catch {}
    const ok = await BluetoothSerial.connect(targetId);
    if (!ok) throw new Error("Could not connect to printer");

    // 5) Build & send TSPL
    const tspl = buildTspl50x40(product);
    // Write as text; many TSPL printers accept plain ASCII
    await BluetoothSerial.write(tspl);

    Alert.alert("Printed", "Label sent to printer.");
    try { await BluetoothSerial.disconnect(); } catch {}
  } catch (e) {
    console.log("[printAndroidLabel] error:", e);
    Alert.alert("Print failed", e?.message || "Could not print to Bluetooth printer.");
    try { await BluetoothSerial.disconnect(); } catch {}
  }
}
