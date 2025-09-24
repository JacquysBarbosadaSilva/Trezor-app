import React, { useEffect } from "react";
import { View, Image, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function SplashScreenPage({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(async () => {
      await SplashScreen.hideAsync();
      navigation.replace("Home"); // Vai para a tela Home
    }, 2000); // 2 segundos

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/trezorLogo.png")}
        style={styles.logo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: "contain",
  },
});
