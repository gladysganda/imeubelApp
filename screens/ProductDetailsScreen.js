import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';

export default function ProductDetailsScreen({ route, navigation }) {
  const { productId } = route.params;
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          setProduct(productSnap.data());
        } else {
          console.log('Product not found.');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text>Product not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {product.imageUrl && (
        <Image source={{ uri: product.imageUrl }} style={styles.image} />
      )}
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.label}>Stock: {product.stock || 0}</Text>
      {user.role === 'owner' && (
        <Text style={styles.label}>Price: {product.price || '-'}</Text>
      )}
      {product.description && (
        <Text style={styles.description}>{product.description}</Text>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title="Log Outgoing Stock"
          onPress={() => navigation.navigate('LogOutgoing', { productId })}
        />
        <Button
          title="Log Incoming Stock"
          color="green"
          onPress={() => navigation.navigate('LogIncoming', { productId })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    marginBottom: 10
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10
  },
  label: {
    fontSize: 16,
    marginBottom: 5
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginTop: 10
  },
  buttonContainer: {
    marginTop: 20,
    gap: 10
  }
});
