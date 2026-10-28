import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { colors } from "@sangam/tokens";
import { extractRoomCode } from "@sangam/shared";

const palette = colors.dark;

export default function HomeScreen({ navigation }: any) {
  const [meetingCode, setMeetingCode] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("userName").then((saved) => {
      if (saved) setUsername(saved);
      else setUsername("Mobile User");
    });
  }, []);

  const handleJoin = async () => {
    const cleanCode = extractRoomCode(meetingCode || "sangam-meet");
    const cleanUsername = username.trim() || "Mobile User";

    setLoading(true);
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");

      const res = await fetch("http://localhost:8002/api/v1/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          roomName: cleanCode,
          name: cleanUsername,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to obtain meeting token.");
      }

      navigation.navigate("Room", {
        roomName: cleanCode,
        token: data.token,
        serverUrl: data.url || "ws://localhost:7880",
        role: data.role,
        username: cleanUsername,
      });
    } catch (err: any) {
      Alert.alert("Unable to Join", err.message || "Could not connect to conference.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    navigation.replace("Auth");
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sangam Connect</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtext}>Join or create a secure real-time meeting</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Name"
            placeholderTextColor={palette.textMuted}
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Meeting Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. sangam-123"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            value={meetingCode}
            onChangeText={setMeetingCode}
          />
        </View>

        <TouchableOpacity
          style={styles.joinButton}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.joinButtonText}>Enter Room</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgApp,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  logoutBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  logoutText: {
    fontSize: 12,
    color: palette.accent,
    fontWeight: "600",
  },
  subtext: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: palette.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: palette.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  joinButton: {
    backgroundColor: palette.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  joinButtonText: {
    color: palette.accentText,
    fontSize: 15,
    fontWeight: "700",
  },
});
