// screens/MasterHomeScreen.js
import React from "react";
import { View, Text, StyleSheet, Button } from "react-native";

export default function MasterHomeScreen({ navigation, route }) {
  // we’ll pass role via navigation (owner only)
  const role = route?.params?.role || "staff";
  const isOwner = role === "owner";

  if (!isOwner) {
    return (
      <View style={styles.center}>
        <Text style={{ fontWeight: "600" }}>
          You don’t have permission to access Master menu.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Master Home</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Master Catalog</Text>
        <Button
          title="Create Master Product"
          onPress={() => navigation.navigate("AddMasterProductScreen", { role: "owner" })}
        />
        <View style={{ height: 10 }} />
        <Button
          title="Manage Master Products"
          onPress={() => navigation.navigate("MasterProductListScreen", { role: "owner" })}
        />
      </View>

      <View style={{ height: 16 }} />
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  card: { padding: 14, borderWidth: 1, borderColor: "#eee", borderRadius: 10, backgroundColor: "#fff" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
});
