import { useNavigation } from '@react-navigation/native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext'; // Assuming you have AuthContext for user role
import { db } from '../firebase';

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { user } = useAuth(); // To check role

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);
    setLoading(true);
    try {
      const docRef = doc(db, 'products', data);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert('Not Found', 'No product found with this barcode.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch product.');
    }
    setLoading(false);
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission...</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      {!scanned && (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {scanned && (
        <View style={styles.resultContainer}>
          {loading ? (
            <ActivityIndicator size="large" />
          ) : product ? (
            <>
              <Text style={styles.title}>{product.name}</Text>
              <Text>Brand: {product.brand}</Text>
              <Text>Stock: {product.stock}</Text>
              {user.role === 'owner' && <Text>Price: {product.price}</Text>}
              <Text>Material: {product.material || 'N/A'}</Text>
              <Text>Sizes: {product.sizes || 'N/A'}</Text>
              <Text>Colors: {product.colors || 'N/A'}</Text>

              <Button
                title="Log Incoming Stock"
                onPress={() => navigation.navigate('LogIncomingScreen', { productId: product.id })}
              />
              <Button
                title="Log Outgoing Stock"
                onPress={() => navigation.navigate('LogOutgoingScreen', { productId: product.id })}
              />
              <Button title="Scan Again" onPress={() => { setScanned(false); setProduct(null); }} />
            </>
          ) : (
            <Button title="Scan Again" onPress={() => setScanned(false)} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10
  }
});
