// navigation/AppNavigator.js
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "react-native";

// Screens (all from ../screens since this file is in /navigation)
import AddItemScreen from "../screens/AddItemScreen";
import EditItemScreen from "../screens/EditItemScreen";
import LoginScreen from "../screens/LoginScreen";
import OwnerHomeScreen from "../screens/OwnerHomeScreen";
import PrintLabelScreen from "../screens/PrintLabelScreen"; // single-label
import PrintLabelsSheetScreen from "../screens/PrintLabelsSheetScreen"; // sheet
import RegisterScreen from "../screens/RegisterScreen";
import ScanIncomingScreen from "../screens/ScanIncomingScreen";
import ScanOutgoingScreen from "../screens/ScanOutgoingScreen";
import StaffHomeScreen from "../screens/StaffHomeScreen";
import StockListScreen from "../screens/StockListScreen";

// These were referenced but not imported in your file:
import LogIncomingScreen from "../screens/LogIncomingScreen";
import LogOutgoingScreen from "../screens/LogOutgoingScreen";
import ProductActionScreen from "../screens/ProductActionScreen";

// If any of the three above don’t exist yet, either create stub files in /screens
// or temporarily comment their <Stack.Screen> lines below.

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={({ navigation }) => ({
          headerShown: true,
          headerTitleAlign: "center",
          headerLeft: ({ canGoBack }) =>
            canGoBack ? (
              <Button title="← Back" onPress={() => navigation.goBack()} />
            ) : null,
        })}
      >
        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

        {/* Home hubs */}
        <Stack.Screen name="OwnerHomeScreen" component={OwnerHomeScreen} />
        <Stack.Screen name="StaffHomeScreen" component={StaffHomeScreen} />

        {/* Inventory */}
        <Stack.Screen name="AddItemScreen" component={AddItemScreen} />
        <Stack.Screen name="EditItemScreen" component={EditItemScreen} />
        <Stack.Screen name="StockListScreen" component={StockListScreen} />

        {/* Scanning flows */}
        <Stack.Screen
          name="ScanIncomingScreen"
          component={ScanIncomingScreen}
          options={{ title: "Scan Incoming" }}
        />
        <Stack.Screen
          name="ScanOutgoingScreen"
          component={ScanOutgoingScreen}
          options={{ title: "Scan Outgoing" }}
        />

        {/* Printing */}
        <Stack.Screen
          name="PrintLabelScreen"
          component={PrintLabelScreen}
          options={{ title: "Print Label" }}
        />
        <Stack.Screen
          name="PrintLabelsSheetScreen"
          component={PrintLabelsSheetScreen}
          options={{ title: "Print Labels (Sheet)" }}
        />

        {/* Optional (make sure files exist) */}
        <Stack.Screen name="ProductActionScreen" component={ProductActionScreen} />
        <Stack.Screen name="LogIncomingScreen" component={LogIncomingScreen} />
        <Stack.Screen name="LogOutgoingScreen" component={LogOutgoingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
