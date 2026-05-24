import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TasteTrail Native</Text>
        <Text style={styles.title}>Passkey-first family food tracking</Text>
        <Text style={styles.copy}>
          This native app surface is part of the Vercel + Neon rearchitecture. The shared
          application services live in the web backend and are designed to be consumed by both
          native clients and the OpenClaw-friendly CLI.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Planned native flows</Text>
          <Text style={styles.cardCopy}>Passkey sign-in, workspace switching, restaurant capture, menu import draft review, and debug visibility.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  content: {
    padding: 24,
    gap: 18,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7b4b2a",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: "#1f1a17",
  },
  copy: {
    fontSize: 17,
    lineHeight: 25,
    color: "#45352c",
  },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#fffaf3",
    borderWidth: 1,
    borderColor: "#e6d4bf",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1a17",
    marginBottom: 8,
  },
  cardCopy: {
    fontSize: 15,
    lineHeight: 22,
    color: "#59463a",
  },
});
