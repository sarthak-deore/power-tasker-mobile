// app/add-device.tsx
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as FileSystem from "expo-file-system";
import CryptoJS from "crypto-js";
import * as secp256k1 from "@noble/secp256k1";
import * as Crypto from "expo-crypto";
import QrCodeScanner from "./scan-key";

const DEVICES_FILE = FileSystem.documentDirectory + "devices.json";

interface Device {
  pubkey: string;
  deviceName: string;
  relayUrl: string;
  encryptedPrivKey: string;
}

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const uint8ArrayToWordArray = (arr: Uint8Array) => {
  const words: number[] = [];
  for (let i = 0; i < arr.length; i += 4) {
    words.push(
      ((arr[i] || 0) << 24) |
        ((arr[i + 1] || 0) << 16) |
        ((arr[i + 2] || 0) << 8) |
        (arr[i + 3] || 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, arr.length);
};

export default function AddDevice() {
  const router = useRouter();
  const [privateKey, setPrivateKey] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [relayUrl, setRelayUrl] = useState("https://relay.scaler.icu");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const validateInputs = (): string | null => {
    if (!privateKey.trim()) return "Private key is required";
    if (!deviceName.trim()) return "Device name is required";
    if (!relayUrl.trim()) return "Relay URL is required";
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return "PIN must be exactly 6 digits";
    }

    try {
      // prvkey validation
      if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
        return "Invalid private key format";
      }
    } catch (error) {
      return "Invalid private key";
    }

    try {
      // relay URL validation
      new URL(relayUrl);
    } catch (error) {
      return "Invalid relay URL format";
    }

    return null;
  };

  const encryptPrivateKey = async (
    privKey: string,
    pinCode: string
  ): Promise<string | undefined> => {
    try {
      const saltBytes = await Crypto.getRandomBytesAsync(16);

      const ivBytes = await Crypto.getRandomBytesAsync(16);

      const salt = uint8ArrayToWordArray(saltBytes);
      const iv = uint8ArrayToWordArray(ivBytes);

      const key = CryptoJS.PBKDF2(pinCode.padStart(6, "0"), salt, {
        keySize: 256 / 32,
        iterations: 1000,
      });

      const encrypted = CryptoJS.AES.encrypt(privKey, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const combinedData =
        bytesToHex(saltBytes) + bytesToHex(ivBytes) + encrypted.toString();

      return combinedData;
    } catch (error) {
      console.error("Encryption error:", error);
    }
  };

  const getPublicKey = (privKey: string): string | undefined => {
    try {
      const privKeyBytes = new Uint8Array(
        privKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );

      // get uncompressed public key from prvkey
      const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false);
      return Array.from(pubKeyBytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } catch (error) {
      console.error("Public key generation error:", error);
    }
  };

  const loadExistingDevices = async (): Promise<Device[]> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(DEVICES_FILE);
      if (!fileInfo.exists) return [];

      const content = await FileSystem.readAsStringAsync(DEVICES_FILE);
      const devices = JSON.parse(content);
      return Array.isArray(devices) ? devices : [];
    } catch (error) {
      console.error("Error loading devices:", error);
      return [];
    }
  };

  const saveDevice = async () => {
    const validationError = validateInputs();
    if (validationError) {
      Alert.alert("Validation Error", validationError);
      return;
    }

    setIsLoading(true);
    try {
      const pubkey = getPublicKey(privateKey);
      if (!pubkey) {
        Alert.alert("Error", "Failed to generate public key");
        return;
      }
      const encryptedPrivKey = await encryptPrivateKey(privateKey, pin);

      const devices = await loadExistingDevices();

      if (devices.some((device) => device.deviceName === deviceName)) {
        Alert.alert("Error", "A device with this name already exists");
        return;
      }

      if (devices.some((device) => device.pubkey === pubkey)) {
        Alert.alert("Error", "A device with this public key already exists");
        return;
      }

      if (!encryptedPrivKey) {
        Alert.alert("Error", "Failed to encrypt private key");
        return;
      }

      const newDevice: Device = {
        pubkey,
        deviceName,
        relayUrl,
        encryptedPrivKey,
      };

      devices.push(newDevice);

      await FileSystem.writeAsStringAsync(
        DEVICES_FILE,
        JSON.stringify(devices, null, 2)
      );

      Alert.alert("Success", "Device added successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error saving device:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to save device"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Private Key (hex)"
          value={privateKey}
          onChangeText={setPrivateKey}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setIsScannerVisible(true)}
          disabled={isLoading}
        >
          <Text style={styles.scanButtonText}>Scan</Text>
        </TouchableOpacity>
      </View>
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
        placeholder="Relay URL (e.g., https://relay.scaler.icu)"
        value={relayUrl}
        onChangeText={setRelayUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!isLoading}
      />
      <TextInput
        style={styles.input}
        placeholder="6-digit PIN"
        value={pin}
        onChangeText={setPin}
        keyboardType="numeric"
        maxLength={6}
        secureTextEntry
        editable={!isLoading}
      />
      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.disabledButton]}
        onPress={saveDevice}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Save Device</Text>
        )}
      </TouchableOpacity>

      <Modal visible={isScannerVisible} animationType="slide">
        <QrCodeScanner
          onScanned={(data) => setPrivateKey(data)}
          onClose={() => setIsScannerVisible(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    marginTop: 8,
  },
  scanButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    marginTop: 8,
    borderRadius: 5,
    marginLeft: 10,
  },
  scanButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: "#99c9ff",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
