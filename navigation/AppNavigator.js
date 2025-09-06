// navigation/AppNavigator.js
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "react-native";

import AddItemScreen from "../screens/AddItemScreen";
import EditItemScreen from "../screens/EditItemScreen";
import LoginScreen from "../screens/LoginScreen";
import OwnerHomeScreen from "../screens/OwnerHomeScreen";
import PrintLabelScreen from "../screens/PrintLabelScreen";
import PrintLabelsSheetScreen from "../screens/PrintLabelsSheetScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ScanIncomingScreen from "../screens/ScanIncomingScreen";
import ScanOutgoingScreen from "../screens/ScanOutgoingScreen";
import StaffHomeScreen from "../screens/StaffHomeScreen";
import StockListScreen from "../screens/StockListScreen";
import StockLogsScreen from "../screens/StockLogsScreen";
import LogIncomingScreen from "../screens/LogIncomingScreen";
import LogOutgoingScreen from "../screens/LogOutgoingScreen";
import ProductActionScreen from "../screens/ProductActionScreen";
import AddMasterProductScreen from "../screens/AddMasterProductScreen";
import PrinterSelectScreen from "../screens/PrinterSelectScreen";

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
            canGoBack ? <Button title="← Back" onPress={() => navigation.goBack()} /> : null,
        })}
      >
        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

        {/* Homes */}
        <Stack.Screen name="OwnerHomeScreen" component={OwnerHomeScreen} />
        <Stack.Screen name="StaffHomeScreen" component={StaffHomeScreen} />

        {/* Inventory */}
        <Stack.Screen name="AddItemScreen" component={AddItemScreen} />
        <Stack.Screen name="EditItemScreen" component={EditItemScreen} />
        <Stack.Screen
          name="StockListScreen"
          component={StockListScreen}
          options={({ navigation, route }) => ({
            title: "Stock List",
            headerRight: () =>
              route?.params?.role === "owner" ? (
                <Button
                  title="Master +"
                  onPress={() =>
                    navigation.navigate("AddMasterProductScreen", { role: "owner" })
                  }
                />
              ) : null,
          })}
        />

        {/* Master product (NEW) */}
        <Stack.Screen
          name="AddMasterProductScreen"
          component={AddMasterProductScreen}
          options={{ title: "Create Master Product" }}
        />

        {/* Scanning */}
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

        {/* Logs & actions */}
        <Stack.Screen name="StockLogsScreen" component={StockLogsScreen} options={{ title: "Stock Logs" }} />
        <Stack.Screen name="ProductActionScreen" component={ProductActionScreen} />
        <Stack.Screen name="LogIncomingScreen" component={LogIncomingScreen} />
        <Stack.Screen name="LogOutgoingScreen" component={LogOutgoingScreen} />

        {/* Printers */}
        <Stack.Screen
          name="PrinterSelectScreen"
          component={PrinterSelectScreen}
          options={{ title: "Select Printer" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
