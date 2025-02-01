// app/edit-device.tsx
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import * as FileSystem from "expo-file-system";

const DEVICES_FILE = FileSystem.documentDirectory + "devices.json";

interface Device {
  pubkey: string;
  deviceName: string;
  relayUrl: string;
  encryptedPrivKey: string;
}

export default function EditDevice() {
  const router = useRouter();
  const { pubkey } = useLocalSearchParams();

  const [deviceName, setDeviceName] = useState("");
  const [relayUrl, setRelayUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDevice();
  }, []);

  const loadDevice = async () => {
    try {
      const content = await FileSystem.readAsStringAsync(DEVICES_FILE);
      const devices: Device[] = JSON.parse(content);
      const device = devices.find((d) => d.pubkey === pubkey);

      if (device) {
        setDeviceName(device.deviceName);
        setRelayUrl(device.relayUrl);
      }
    } catch (error) {
      console.error("Error loading device:", error);
      Alert.alert("Error", "Failed to load device details");
      router.back();
    }
  };

  const validateInputs = (): string | null => {
    if (!deviceName.trim()) return "Device name is required";
    if (!relayUrl.trim()) return "Relay URL is required";

    try {
      new URL(relayUrl);
    } catch (error) {
      return "Invalid relay URL format";
    }

    return null;
  };

  const saveChanges = async () => {
    const validationError = validateInputs();
    if (validationError) {
      Alert.alert("Validation Error", validationError);
      return;
    }

    setIsLoading(true);
    try {
      const content = await FileSystem.readAsStringAsync(DEVICES_FILE);
      const devices: Device[] = JSON.parse(content);

      const updatedDevices = devices.map((device) => {
        if (device.pubkey === pubkey) {
          return {
            ...device,
            deviceName,
            relayUrl,
          };
        }
        return device;
      });

      await FileSystem.writeAsStringAsync(
        DEVICES_FILE,
        JSON.stringify(updatedDevices, null, 2)
      );

      Alert.alert("Success", "Device updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error updating device:", error);
      Alert.alert("Error", "Failed to update device");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDevice = async () => {
    Alert.alert(
      "Delete Device",
      "Are you sure you want to delete this device?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const content = await FileSystem.readAsStringAsync(DEVICES_FILE);
              const devices: Device[] = JSON.parse(content);

              const updatedDevices = devices.filter(
                (device) => device.pubkey !== pubkey
              );

              await FileSystem.writeAsStringAsync(
                DEVICES_FILE,
                JSON.stringify(updatedDevices, null, 2)
              );

              Alert.alert("Success", "Device deleted successfully", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error("Error deleting device:", error);
              Alert.alert("Error", "Failed to delete device");
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Device Name"
        value={deviceName}
        onChangeText={setDeviceName}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />
      <TextInput
        style={styles.input}
        placeholder="Relay URL (e.g., wss://relay.example.com)"
        value={relayUrl}
        onChangeText={setRelayUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!isLoading}
      />
      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.disabledButton]}
        onPress={saveChanges}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteButton, isLoading && styles.disabledButton]}
        onPress={deleteDevice}
        disabled={isLoading}
      >
        <Text style={styles.deleteButtonText}>Delete Device</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    marginBottom: 16,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  deleteButton: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "bold",
  },
});
