// app/sign-send.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import CryptoJS from "crypto-js";
import { Buffer } from "buffer";
import * as secp256k1 from "@noble/secp256k1";
import { etc } from "@noble/secp256k1";

etc.hmacSha256Sync = (
  key: Uint8Array,
  ...messages: Uint8Array[]
): Uint8Array => {
  const hash = messages.reduce((hash, message) => {
    const wordArray = CryptoJS.lib.WordArray.create(message);
    return hash.concat(wordArray);
  }, CryptoJS.lib.WordArray.create(key));

  const hmac = CryptoJS.HmacSHA256(hash, CryptoJS.lib.WordArray.create(key));
  return new Uint8Array(Buffer.from(hmac.toString(CryptoJS.enc.Hex), "hex"));
};

const DEVICES_FILE = FileSystem.documentDirectory + "devices.json";

interface Device {
  pubkey: string;
  deviceName: string;
  relayUrl: string;
  encryptedPrivKey: string;
}

const decryptPrivateKey = async (
  encryptedPrivKey: string,
  pinCode: string
): Promise<string | undefined> => {
  try {
    const saltHex = encryptedPrivKey.slice(0, 32);
    const ivHex = encryptedPrivKey.slice(32, 64);
    const encryptedData = encryptedPrivKey.slice(64);

    const salt = CryptoJS.enc.Hex.parse(saltHex);
    const iv = CryptoJS.enc.Hex.parse(ivHex);

    const key = CryptoJS.PBKDF2(pinCode.padStart(6, "0"), salt, {
      keySize: 256 / 32,
      iterations: 1000,
    });

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(encryptedData),
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const decryptedKey = decrypted.toString(CryptoJS.enc.Utf8);

    return decryptedKey;
  } catch (error) {
    Alert.alert("Error", "Invalid PIN.");
  }
};

const signCommand = async (
  command: string,
  privateKeyHex: string
): Promise<
  { publicKeyHex: string; signatureHex: string; command: string } | undefined
> => {
  try {
    const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyHex, "hex"));
    const messageBytes = new Uint8Array(Buffer.from(command, "utf-8"));
    const messageHash = new Uint8Array(
      Buffer.from(
        CryptoJS.SHA256(CryptoJS.lib.WordArray.create(messageBytes)).toString(
          CryptoJS.enc.Hex
        ),
        "hex"
      )
    );
    const signature = await secp256k1.sign(messageHash, privateKeyBytes);
    const signatureHex = Buffer.from(signature.toCompactRawBytes()).toString(
      "hex"
    );
    const publicKey = secp256k1.getPublicKey(privateKeyBytes);
    const publicKeyHex = "04" + Buffer.from(publicKey).toString("hex");

    return {
      publicKeyHex,
      signatureHex,
      command,
    };
  } catch (error) {
    console.error("Signing error:", error);
    Alert.alert("Error", "Failed to Sign Command.");
  }
};

interface SuccessModalProps {
  visible: boolean;
  deviceName: string;
  action: string;
  onClose: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  deviceName,
  onClose,
  action,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const capitalizedAction = action
    ? action.charAt(0).toUpperCase() + action.slice(1)
    : "";

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();

      // close after 10 seconds
      const timer = setTimeout(onClose, 10000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <Animated.View
        style={[
          styles.modalContent,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.modalTitle}>Success!</Text>
        <Text style={styles.modalMessage}>
          <Text style={styles.boldText}>{capitalizedAction}</Text>
          {" command sent to "}
          <Text style={styles.boldText}>{deviceName}</Text>
        </Text>
        <TouchableOpacity style={styles.returnButton} onPress={onClose}>
          <Text style={styles.returnButtonText}>Return to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function SignSend() {
  const router = useRouter();
  const { pubkey, action } = useLocalSearchParams<{
    pubkey: string;
    action: string;
  }>();
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (pubkey) {
      loadDevice();
    }
  }, [pubkey]);

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

  const handleSuccess = () => {
    setShowSuccessModal(true);
  };

  const handleReturn = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const handleSign = async () => {
    if (!device || !action) {
      Alert.alert("Error", "Missing device or action data.");
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      Alert.alert("Error", "PIN must be exactly 6 digits.");
      return;
    }

    setIsLoading(true);
    try {
      const date = new Date();
      const currentTime = date
        .toISOString()
        .replace(/[-:.TZ]/g, "")
        .slice(0, 14);

      if (currentTime.length !== 14) {
        Alert.alert("Error", "Failed to get current time.");
        return;
      }

      const fullCommand = `${action}+${currentTime}`;

      const encryptedPrivKey = device.encryptedPrivKey;
      const privKey = await decryptPrivateKey(encryptedPrivKey, pin);
      if (!privKey) {
        Alert.alert("Error", "Invalid PIN.");
        setPin("");
        return;
      }
      const result = await signCommand(fullCommand, privKey);
      if (result) {
        const { signatureHex, command: signedCommand } = result;

        // check for extra slash in relay URL
        const relay = device.relayUrl.endsWith("/")
          ? device.relayUrl
          : device.relayUrl + "/";

        const fullRelayUrl = relay + "api/request/send-command";

        const response = await fetch(fullRelayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pubkey: device.pubkey,
            signature: signatureHex,
            command: signedCommand,
          }),
        });

        if (response.ok) {
          handleSuccess();
        } else {
          Alert.alert("Error", "Failed to sign and send command.");
        }
      } else {
        Alert.alert("Error", "Failed to sign command.");
      }
    } catch (error) {
      console.error("Error signing action:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.deviceInfo}>
        <Text style={styles.label}>Public Key:</Text>
        <Text style={styles.value}>{`${pubkey.slice(0, 9)}...${pubkey.slice(
          -9
        )}`}</Text>

        <Text style={styles.label}>Action:</Text>
        <Text style={styles.value}>{action}</Text>
      </View>

      <View style={styles.pinInput}>
        <TextInput
          style={styles.pinField}
          placeholder="Enter 6-digit PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          editable={!isLoading}
        />
      </View>

      <TouchableOpacity
        style={styles.signButton}
        onPress={handleSign}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? "Signing..." : "Sign and Send"}
        </Text>
      </TouchableOpacity>

      <SuccessModal
        visible={showSuccessModal}
        deviceName={device?.deviceName || "device"}
        action={action}
        onClose={handleReturn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
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
  pinInput: {
    marginBottom: 20,
  },
  pinField: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  signButton: {
    padding: 15,
    borderRadius: 5,
    backgroundColor: "#28a745",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    width: "80%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#28a745",
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
  },
  returnButton: {
    backgroundColor: "#28a745",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  returnButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  boldText: {
    fontWeight: "bold",
    color: "#333",
  },
});
