// screens/HomeScreen.js
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../firebase";

export default function HomeScreen({ navigation }) {
  const [role, setRole] = useState(null);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch user role from Firestore
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await getDocs(collection(db, "users"));
        userDoc.forEach((docu) => {
          if (docu.id === auth.currentUser.uid) {
            setRole(docu.data().role);
          }
        });
      } catch (error) {
        console.error("Failed to fetch user role:", error);
      }
    };

    fetchUserRole();
  }, []);

  // Fetch stock from Firestore
  useEffect(() => {
    const fetchStock = async () => {
      try {
        const snapshot = await getDocs(collection(db, "stock"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setStock(data);
      } catch (error) {
        console.error("Error fetching stock:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, []);

  const handleDelete = async (id) => {
    Alert.alert("Delete Item", "Are you sure you want to delete this item?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          await deleteDoc(doc(db, "stock", id));
          setStock(stock.filter((item) => item.id !== id));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {role}</Text>

      <FlatList
        data={stock}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text>Category: {item.category}</Text>
            <Text>Stock: {item.quantity}</Text>
            {role === "owner" && <Text>Price: Rp {item.price}</Text>}

            {role === "owner" && (
              <View style={styles.row}>
                <TouchableOpacity onPress={() => navigation.navigate("EditStock", { item })}>
                  <Text style={styles.edit}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Text style={styles.delete}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("AddStock")}
      >
        <Text style={styles.buttonText}>Add New Stock</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  card: { backgroundColor: "#f9f9f9", padding: 15, borderRadius: 8, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: "bold" },
  row: { flexDirection: "row", marginTop: 10 },
  edit: { color: "blue", marginRight: 15 },
  delete: { color: "red" },
  button: {
    backgroundColor: "#008080",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
