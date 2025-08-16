// screens/RegisterScreen.js
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../firebase";

export default function RegisterScreen({ navigation }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = async () => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save user to Firestore with a role
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: "staff", // or "owner" — you can customize this
                createdAt: new Date()
            });

            Alert.alert("Registration successful!");
            navigation.navigate("Login");
        } catch (error) {
            if (error.code === "auth/email-already-in-use") {
                Alert.alert("That email is already registered.");
            } else {
                Alert.alert("Registration Error", error.message);
            }
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Register</Text>
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
            <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
            <Button title="Register" onPress={handleRegister} />
            <Text onPress={() => navigation.navigate("Login")} style={styles.link}>Already have an account? Log in</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, marginTop: 100 },
    title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
    input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 10, borderRadius: 5 },
    link: { marginTop: 20, color: "blue", textAlign: "center" }
});
