// app/scan-key.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { Camera, CameraView } from "expo-camera";

interface QrCodeScannerProps {
  onScanned: (data: string) => void;
  onClose: () => void;
}

export default function QrCodeScanner({
  onScanned,
  onClose,
}: QrCodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const scanCooldown = useRef(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [onClose]);

  if (hasPermission === null) {
    return (
      <Text style={styles.message}>Requesting for camera permission...</Text>
    );
  }

  if (hasPermission === false) {
    return <Text style={styles.message}>No access to camera</Text>;
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanCooldown.current || scanned) {
      return;
    }

    if (!/^[0-9a-fA-F]{64}$/.test(data)) {
      scanCooldown.current = true;
      Alert.alert(
        "Invalid QR Code",
        "The scanned QR code is not a valid private key.",
        [
          {
            text: "OK",
            onPress: () => {
              setTimeout(() => {
                scanCooldown.current = false;
              }, 1000);
            },
          },
        ]
      );
      return;
    }

    setScanned(true);
    onScanned(data);
    onClose();
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          style={styles.camera}
        />
        <View style={styles.borderOverlay} />
      </View>
      <View style={styles.buttonsContainer}>
        {scanned ? (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.buttonText}>Close Scanner</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    color: "#FFF",
    marginTop: 20,
  },
  cameraContainer: {
    width: "90%",
    height: "50%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#4CAF50",
  },
  camera: {
    flex: 1,
  },
  borderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: "#FFF",
    borderRadius: 10,
    zIndex: 1,
  },
  buttonsContainer: {
    position: "absolute",
    bottom: 20,
    width: "100%",
    alignItems: "center",
  },
  scanButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  closeButton: {
    backgroundColor: "#F44336",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
