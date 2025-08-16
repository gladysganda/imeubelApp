// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddItemScreen from './screens/AddItemScreen';
import EditItemScreen from './screens/EditItemScreen';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import OwnerHomeScreen from './screens/OwnerHomeScreen';
import RegisterScreen from './screens/RegisterScreen';
import ScanIncomingScreen from "./screens/ScanIncomingScreen";
import ScanOutgoingScreen from "./screens/ScanOutgoingScreen";
import StaffHomeScreen from './screens/StaffHomeScreen';
import StockListScreen from './screens/StockListScreen';
import StockLogsScreen from './screens/StockLogsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Login">
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="StaffHomeScreen" component={StaffHomeScreen} />
                <Stack.Screen name="EditItemScreen" component={EditItemScreen} />
                <Stack.Screen name="OwnerHomeScreen" component={OwnerHomeScreen} />
                <Stack.Screen name="AddItemScreen" component={AddItemScreen} />
                <Stack.Screen name="StockLogs" component={StockLogsScreen} />
                <Stack.Screen name="ScanIncomingScreen" component={ScanIncomingScreen} />
                <Stack.Screen name="ScanOutgoingScreen" component={ScanOutgoingScreen} />
                <Stack.Screen name="StockListScreen" component={StockListScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
