// screens/LoginScreen.js
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../firebase";

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        const cleanedEmail = email.trim();
        const cleanedPassword = password.trim();

        if (!cleanedEmail || !cleanedPassword) {
            Alert.alert("Please enter both email and password.");
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, cleanedEmail, cleanedPassword);
            const user = userCredential.user;
            console.log("Logged in:", user.email);

            // 🔍 Fetch user role from Firestore
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const role = userData.role;

                console.log("User role:", role);

                if (role === "owner") {
                    navigation.replace("OwnerHomeScreen");
                } else {
                    navigation.replace("StaffHomeScreen");
                }
            } else {
                Alert.alert("User data not found in database.");
            }

        } catch (error) {
            console.error("Login Error:", error.code, error.message);

            if (error.code === "auth/user-not-found") {
                Alert.alert("No user found with that email.");
            } else if (error.code === "auth/wrong-password") {
                Alert.alert("Incorrect password.");
            } else if (error.code === "auth/invalid-email") {
                Alert.alert("Invalid email format.");
            } else {
                Alert.alert("Login failed", error.message);
            }
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Log In</Text>
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
            <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
            <Button title="Login" onPress={handleLogin} />
            <Text onPress={() => navigation.navigate("Register")} style={styles.link}>
                Don't have an account? Register
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, marginTop: 100 },
    title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
    input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 10, borderRadius: 5 },
    link: { marginTop: 20, color: "blue", textAlign: "center" }
});
