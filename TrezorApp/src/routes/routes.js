import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreenPage from "../screens/SplashScreenPage";
import Home from "../screens/Home";

const Stack = createNativeStackNavigator();

export default function Routes() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreenPage} />
      <Stack.Screen name="Home" component={Home} />
    </Stack.Navigator>
  );
}
