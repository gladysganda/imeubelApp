// utils/androidLabelPrint.js
import { Alert, Platform } from "react-native";

export async function printAndroidLabel() {
  console.log("printAndroidLabel() called on", Platform.OS, "→ noop");
  if (Platform.OS !== "android") {
    Alert.alert("Not supported", "Bluetooth printing is Android-only in this app.");
  }
}
