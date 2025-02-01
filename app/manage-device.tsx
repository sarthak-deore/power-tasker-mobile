// app/manage-device.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";

const DEVICES_FILE = FileSystem.documentDirectory + "devices.json";

interface Device {
  pubkey: string;
  deviceName: string;
  relayUrl: string;
  encryptedPrivKey: string;
}

export default function ManageDevice() {
  const router = useRouter();
  const { pubkey } = useLocalSearchParams<{ pubkey: string }>();

  const [device, setDevice] = useState<Device | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>("default");

  const loadDevice = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(DEVICES_FILE);
      if (!fileExists.exists) {
        Alert.alert("Error", "Devices file not found.");
        router.back();
        return;
      }

      const content = await FileSystem.readAsStringAsync(DEVICES_FILE);
      const devices: Device[] = JSON.parse(content);

      const currentDevice = devices.find((d) => d.pubkey === pubkey);
      if (!currentDevice) {
        Alert.alert("Error", "Device not found.");
        router.back();
        return;
      }

      setDevice(currentDevice);
    } catch (error) {
      console.error("Error loading device:", error);
      Alert.alert("Error", "Failed to load device.");
      router.back();
    }
  };

  useEffect(() => {
    if (pubkey) {
      loadDevice();
    }
  }, [pubkey]);

  const handleSignAndSend = () => {
    if (!selectedOption || selectedOption === "default") {
      Alert.alert("Error", "Please select an option.");
      return;
    }

    router.replace({
      pathname: "/sign-send",
      params: {
        pubkey: device?.pubkey,
        action: selectedOption,
      },
    });
  };

  if (!device) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading device...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.deviceInfo}>
        <Text style={styles.label}>Device Name:</Text>
        <Text style={styles.value}>{device.deviceName}</Text>

        <Text style={styles.label}>Public Key:</Text>
        <Text style={styles.value}>
          {`${device.pubkey.slice(0, 9)}...${device.pubkey.slice(-9)}`}
        </Text>

        <Text style={styles.label}>Relay URL:</Text>
        <Text style={styles.value}>{device.relayUrl}</Text>
      </View>

      <View style={styles.options}>
        <Text style={styles.optionsTitle}>Select an Action:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedOption}
            onValueChange={(itemValue: string) => {
              setSelectedOption(itemValue);
            }}
            style={styles.picker}
          >
            <Picker.Item label="Select an action" value="default" />
            <Picker.Item label="Sign Out" value="signout" />
            <Picker.Item label="Shutdown" value="shutdown" />
            <Picker.Item label="Restart" value="restart" />
            <Picker.Item label="Sleep" value="sleep" />
          </Picker>
        </View>
      </View>

      {selectedOption && selectedOption !== "default" && (
        <TouchableOpacity
          style={styles.signAndSendButton}
          onPress={handleSignAndSend}
        >
          <Text style={styles.signAndSendButtonText}>Proceed</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  deviceInfo: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
    fontWeight: "bold",
  },
  value: {
    fontSize: 16,
    color: "#333",
    marginBottom: 10,
  },
  options: {
    marginBottom: 10,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    overflow: "hidden",
  },
  picker: {
    height: 60,
    width: "100%",
  },

  signAndSendButton: {
    padding: 15,
    borderRadius: 5,
    backgroundColor: "#28a745",
    alignItems: "center",
  },
  signAndSendButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
