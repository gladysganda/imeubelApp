// screens/ProductActionScreen.js
import { Button, StyleSheet, Text, View } from "react-native";

export default function ProductActionScreen({ route, navigation }) {
  // Expect route.params: { product }  (with id)
  const product = route?.params?.product;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Product</Text>
      <Text style={styles.subtitle}>{product?.name || product?.id || "Unknown"}</Text>

      <View style={{ height: 10 }} />
      <Button
        title="Log Incoming"
        onPress={() => navigation.navigate("LogIncomingScreen", { product })}
      />
      <View style={{ height: 10 }} />
      <Button
        title="Log Outgoing"
        onPress={() => navigation.navigate("LogOutgoingScreen", { product })}
      />
      <View style={{ height: 10 }} />
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "bold" },
  subtitle: { marginTop: 6, color: "#555" },
});
