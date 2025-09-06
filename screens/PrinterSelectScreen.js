// screens/PrinterSelectionScreen.js (placeholder)
import { View, Text, Button, StyleSheet } from "react-native";
export default function PrintSelectScreen({ navigation }) {
  return (
    <View style={styles.c}>
      <Text style={styles.t}>
        Bluetooth printers are handled via RawBT. Use “Open in RawBT” from the label screen.
      </Text>
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}
const styles = StyleSheet.create({ c:{flex:1,justifyContent:"center",padding:16}, t:{textAlign:"center"}});
