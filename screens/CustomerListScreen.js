// screens/CustomerListScreen.js
import React, { useEffect, useState } from "react";
import { Alert, Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, startAt, endAt, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function CustomerListScreen({ navigation }) {
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const s = search.trim().toLowerCase();
    const col = collection(db, "customers");
    let qy;
    if (s) qy = query(col, orderBy("nameLower"), startAt(s), endAt(s + "\uf8ff"), limit(50));
    else qy = query(col, orderBy("nameLower"), limit(50));
    const snap = await getDocs(qy);
    setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const nm = name.trim();
    if (!nm) return Alert.alert("Validation", "Name required");
    const payload = {
      name: nm,
      nameLower: nm.toLowerCase(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
      updatedByEmail: auth.currentUser?.email || null
    };
    if (editingId) {
      await updateDoc(doc(db, "customers", editingId), payload);
    } else {
      await addDoc(collection(db, "customers"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || null,
        createdByEmail: auth.currentUser?.email || null
      });
    }
    setName(""); setPhone(""); setAddress(""); setEditingId(null);
    load();
  };

  const edit = (c) => {
    setEditingId(c.id);
    setName(c.name || "");
    setPhone(c.phone || "");
    setAddress(c.address || "");
  };

  const view = (c) => {
    navigation.navigate("CustomerDetailScreen", { customer: c });
  };

  const cancel = () => { setEditingId(null); setName(""); setPhone(""); setAddress(""); };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Customers</Text>

      <Text style={styles.label}>Search</Text>
      <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Type name..." onSubmitEditing={load} />
      <View style={{ height: 8 }} />
      <Button title="Search" onPress={load} />

      <View style={styles.hr} />

      <Text style={styles.section}>{editingId ? "Edit Customer" : "Add Customer"}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Address" />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Save" onPress={save} />
        {editingId ? <Button title="Cancel" onPress={cancel} /> : null}
      </View>

      <View style={styles.hr} />

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            {!!item.phone && <Text>📱 {item.phone}</Text>}
            {!!item.address && <Text>🏠 {item.address}</Text>}
            <View style={{ height: 6 }} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Edit" onPress={() => edit(item)} />
              <Button title="View" onPress={() => view(item)} />{/* NEW */}
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  label: { fontWeight: "700", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fff", marginBottom: 8 },
  hr: { height: 1, backgroundColor: "#eee", marginVertical: 10 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, backgroundColor: "#fff" },
  name: { fontWeight: "700", marginBottom: 4 }
});
