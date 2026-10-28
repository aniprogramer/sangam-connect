import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import { ActivityIndicator, View } from "react-native";

import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import RoomScreen from "./src/screens/RoomScreen";
import { setupCallKeep } from "./src/services/callkeep";
import { setupNotifications } from "./src/services/notifications";
import { colors } from "@sangam/tokens";

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    // 1. Initialize CallKit / ConnectionService
    setupCallKeep();

    // 2. Initialize FCM Push Notifications
    setupNotifications();

    // 3. Resolve existing auth session
    SecureStore.getItemAsync("accessToken")
      .then((token) => {
        setInitialRoute(token ? "Home" : "Auth");
      })
      .catch(() => {
        setInitialRoute("Auth");
      });
  }, []);

  if (!initialRoute) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.dark.bgApp,
        }}
      >
        <ActivityIndicator size="large" color={colors.dark.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.dark.bgApp },
        }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Room" component={RoomScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
