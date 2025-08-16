// navigation/AppNavigator.js
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AddItemScreen from "../screens/AddItemScreen";
import EditItemScreen from "../screens/EditItemScreen";
import LoginScreen from "../screens/LoginScreen";
import OwnerHomeScreen from "../screens/OwnerHomeScreen";
import RegisterScreen from "../screens/RegisterScreen";
import StaffHomeScreen from "../screens/StaffHomeScreen";
import BarcodeTestScreen from "./screens/BarcodeTestScreen";
import ScanIncomingScreen from "./screens/ScanIncomingScreen";
import ScanOutgoingScreen from "./screens/ScanOutgoingScreen";

// import HomeScreen from "../screens/HomeScreen"; // replace this as needed

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={({ navigation }) => ({
                    headerShown: true,
                    headerTitleAlign: 'center',
                    headerLeft: ({ canGoBack }) =>
                        canGoBack ? (
                            <Button title="← Back" onPress={() => navigation.goBack()} />
                        ) : null,
                })}
            >
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="StaffHomeScreen" component={StaffHomeScreen} />
                <Stack.Screen name="OwnerHomeScreen" component={OwnerHomeScreen} />
                <Stack.Screen name="ProductActionScreen" component={ProductActionScreen} />
                <Stack.Screen name="LogIncomingScreen" component={LogIncomingScreen} />
                <Stack.Screen name="LogOutgoingScreen" component={LogOutgoingScreen} />
                <Stack.Screen name="AddItemScreen" component={AddItemScreen} />
                <Stack.Screen name="EditItemScreen" component={EditItemScreen} />
                <Stack.Screen name="BarcodeTestScreen" component={BarcodeTestScreen} options={{ title: "Scan Test" }} />
                <Stack.Screen name="ScanIncomingScreen" component={ScanIncomingScreen} options={{ title: "Scan Incoming" }} />
                <Stack.Screen name="ScanOutgoingScreen" component={ScanOutgoingScreen} options={{ title: "Scan Outgoing" }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
