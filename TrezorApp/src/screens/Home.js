import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import * as Location from "expo-location";
import { Audio } from "expo-av";

export default function App() {
  const [location, setLocation] = useState(null);
  const [treasure, setTreasure] = useState(null);
  const [distanceSteps, setDistanceSteps] = useState(null);
  const [hint, setHint] = useState("Iniciando caça ao tesouro...");
  const [bgColor, setBgColor] = useState("#87CEFA");
  const [angle] = useState(new Animated.Value(0));
  const soundRef = useRef(null);
  const locationSubscription = useRef(null);
  const lastSoundTime = useRef(0); // Debounce do som (5s)
  const lastUIUpdate = useRef(0); // Debounce para UI (1s)
  const lastDistance = useRef(null); // Para ignorar mudanças mínimas

  // Função para calcular a distância em metros entre dois pontos
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Função para calcular o ângulo da seta
  const getBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const toDeg = (v) => (v * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  // Gerar tesouro aleatório UMA ÚNICA VEZ baseado na posição do USUÁRIO (raio até 10m)
  const generateRandomTreasure = (userLat, userLon) => {
    const R = 6371000; // raio da Terra
    const minRadius = 3; // Mínimo 0m (pode ser bem perto)
    const maxRadius = 10; // Máximo 10m de offset do usuário
    const randomDist = minRadius + Math.random() * (maxRadius - minRadius); // Distância aleatória [0m, 10m]
    const randomAngle = Math.random() * 2 * Math.PI; // Ângulo aleatório

    // Deslocamento em radianos a partir da posição do usuário
    const dLat = (randomDist / R) * Math.cos(randomAngle);
    const dLon =
      (randomDist / (R * Math.cos((userLat * Math.PI) / 180))) *
      Math.sin(randomAngle);

    const treasureLat = userLat + (dLat * 180) / Math.PI;
    const treasureLon = userLon + (dLon * 180) / Math.PI;

    return {
      latitude: treasureLat,
      longitude: treasureLon,
    };
  };

  // Função para atualizar UI (com debounce e checagem de mudança significativa)
  const updateUI = (coords, treasureCoords) => {
    const now = Date.now();
    if (now - lastUIUpdate.current < 1000) return; // Debounce: só a cada 1s
    lastUIUpdate.current = now;

    const distMeters = getDistance(
      coords.latitude,
      coords.longitude,
      treasureCoords.latitude,
      treasureCoords.longitude
    );
    const steps = Math.floor(distMeters / 0.8);

    // Ignorar se mudança <0.5m (evita flutuações GPS)
    if (lastDistance.current !== null && Math.abs(steps - lastDistance.current) < 3) {
      return; // Não mudou o suficiente
    }
    lastDistance.current = steps;
    setDistanceSteps(steps);

    let newHint = hint;
    let newBgColor = bgColor;

    if (steps < 10) {
      newHint = "Muito quente! Está quase lá!";
      newBgColor = "#FF4500"; // Vermelho alaranjado
      playSound();
    } else if (steps < 25) {
      newHint = "Quente! Está perto!";
      newBgColor = "#FF8C00"; // Laranja
    } else if (steps < 50) {
      newHint = "Morno! Continue procurando.";
      newBgColor = "#FFD700"; // Amarelo
    } else {
      newHint = "Frio! Está longe do tesouro.";
      newBgColor = "#87CEFA"; // Azul céu
    }

    // Só atualizar se mudou
    if (newHint !== hint) setHint(newHint);
    if (newBgColor !== bgColor) setBgColor(newBgColor);

    // Atualizar seta (sempre, mas com animação suave)
    const bearing = getBearing(
      coords.latitude,
      coords.longitude,
      treasureCoords.latitude,
      treasureCoords.longitude
    );
    Animated.timing(angle, {
      toValue: bearing,
      duration: 300, // Mais rápido para suavidade
      useNativeDriver: true,
      easing: Easing.linear,
    }).start();
  };

  // Tocar música com debounce (5s)
  const playSound = async () => {
    const now = Date.now();
    if (now - lastSoundTime.current < 5000) return;
    lastSoundTime.current = now;

    if (soundRef.current) {
      await soundRef.current.replayAsync();
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/treasure.mp3")
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error("Erro ao tocar áudio:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    (async () => {
      // Pedir permissões
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setHint("Permissão negada para acessar localização. Ative no app settings.");
        return;
      }
      setHint("Obtendo localização inicial para gerar tesouro...");

      // Fallback: Obter posição atual uma vez (mais rápido para start)
      try {
        let initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High, // Alta precisão para 10m
        });
        if (isMounted) {
          setLocation(initialLoc.coords);
          console.log("Localização inicial do usuário:", initialLoc.coords); // Debug

          // GERAR TESOURO ALEATÓRIO UMA ÚNICA VEZ AQUI (baseado na posição do usuário)
          const newTreasure = generateRandomTreasure(
            initialLoc.coords.latitude,
            initialLoc.coords.longitude
          );
          setTreasure(newTreasure);
          console.log("Tesouro gerado uma única vez (próximo ao usuário):", newTreasure); // Debug

          // Calcular UI imediatamente com tesouro gerado
          updateUI(initialLoc.coords, newTreasure);
          setHint("Tesouro gerado! Procure ao redor...");
        }
      } catch (error) {
        console.error("Erro na posição inicial:", error);
        setHint("Erro ao obter localização inicial. Verifique GPS.");
      }

      // Watch para updates contínuos (otimizado para curta distância)
      try {
        locationSubscription.current = Location.watchPositionAsync(
          { 
            accuracy: Location.Accuracy.High, // Alta para precisão em 10m
            distanceInterval: 1, // Atualiza se moveu 1m (para raio pequeno)
            timeInterval: 2000 // Mínimo 2s entre updates
          },
          (loc) => {
            if (!isMounted) return;
            const coords = loc.coords;
            setLocation(coords);

            // Tesouro já existe: sempre atualizar UI (não regenera)
            if (treasure) {
              updateUI(coords, treasure);
            }
          }
        );
        console.log("Subscrição de localização criada com sucesso."); // Debug opcional
      } catch (error) {
        console.error("Erro no watchPositionAsync:", error);
        setHint("Erro ao rastrear localização. Verifique GPS.");
      }
    })();

    // Cleanup ROBUSTO: Verifica se existe E se remove é função (previne erro)
    return () => {
      isMounted = false;
      try {
        if (
          locationSubscription.current && 
          typeof locationSubscription.current.remove === 'function'
        ) {
          locationSubscription.current.remove();
          console.log("Subscrição de localização removida."); // Debug opcional
        }
      } catch (cleanupError) {
        console.error("Erro no cleanup da localização:", cleanupError);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []); // Roda só uma vez: tesouro gerado na primeira loc!

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={styles.title}>Caça ao Tesouro</Text>
      <Text style={styles.text}>{hint}</Text>
      {distanceSteps !== null && (
        <>
          <Text style={styles.text}>
            Distância: {distanceSteps} passos
          </Text>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: angle.interpolate({
                    inputRange: [0, 360],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
              marginTop: 30,
            }}
          >
            <Text style={{ fontSize: 60 }}>🧭</Text>
          </Animated.View>
        </>
      )}
      {!location && (
        <Text style={styles.text}>Aguardando GPS... (Ative localização no device)</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#fff",
  },
  text: {
    fontSize: 20,
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
});
