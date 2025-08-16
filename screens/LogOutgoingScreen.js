import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';

export default function LogOutgoingScreen({ route, navigation }) {
  const { productId } = route.params;
  const { user } = useAuth(); // role, name, uid
  const [quantity, setQuantity] = useState('');
  const [clientName, setClientName] = useState('');

  const handleOutgoing = async () => {
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid number.');
      return;
    }
    if (!clientName.trim()) {
      Alert.alert('Missing Client Name', 'Please enter the client name.');
      return;
    }

    try {
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        Alert.alert('Error', 'Product not found.');
        return;
      }

      const productData = productSnap.data();
      const currentStock = productData.stock || 0;

      if (Number(quantity) > currentStock) {
        Alert.alert('Not Enough Stock', 'You cannot deduct more than available.');
        return;
      }

      // Update stock
      await updateDoc(productRef, {
        stock: currentStock - Number(quantity)
      });

      // Log the outgoing transaction
      const logsRef = collection(db, 'stockLogs');
      await addDoc(logsRef, {
        productId,
        productName: productData.name,
        type: 'outgoing',
        quantity: Number(quantity),
        clientName,
        handledBy: user.name || 'Unknown User',
        handledById: user.uid,
        timestamp: serverTimestamp()
      });

      Alert.alert('Success', 'Outgoing stock logged.');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to log outgoing stock.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quantity</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
        placeholder="Enter quantity"
      />
      <Text style={styles.label}>Client Name</Text>
      <TextInput
        style={styles.input}
        value={clientName}
        onChangeText={setClientName}
        placeholder="Enter client name"
      />
      <Button title="Log Outgoing Stock" onPress={handleOutgoing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginTop: 5
  }
});
