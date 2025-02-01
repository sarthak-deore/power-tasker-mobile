// app/index.tsx
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system";

type Device = {
  pubkey: string;
  deviceName: string;
  relayUrl: string;
  encryptedPrivKey: string;
  isOnline?: boolean;
  isLoading?: boolean;
};

const DEVICES_FILE = FileSystem.documentDirectory + "devices.json";
// poll every 10 secs
const POLLING_INTERVAL = 10000;

export default function Home() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const deviceListRef = useRef<Device[]>([]);

  useEffect(() => {
    deviceListRef.current = devices;
  }, [devices]);

  const loadDevices = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(DEVICES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(DEVICES_FILE);
        const loadedDevices = JSON.parse(content);
        setDevices(
          loadedDevices.map((device: Device) => ({
            ...device,
            isOnline: false,
            isLoading: true,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  const checkDeviceStatus = async (device: Device) => {
    try {
      const cleanURL = device.relayUrl.replace(/\/$/, "");
      const response = await fetch(`${cleanURL}/api/request/last-active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pubkey: device.pubkey,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const lastFetched = data.lastfetched;

        // convert last fetched time to same format as current time
        const lastFetchedDate = new Date(
          `${lastFetched.slice(0, 4)}-${lastFetched.slice(
            4,
            6
          )}-${lastFetched.slice(6, 8)}T${lastFetched.slice(
            8,
            10
          )}:${lastFetched.slice(10, 12)}:${lastFetched.slice(12, 14)}Z`
        );
        const currentTimeDate = new Date();

        const diffInSeconds = Math.floor(
          (currentTimeDate.getTime() - lastFetchedDate.getTime()) / 1000
        );
        const isOnline = diffInSeconds <= 60;

        setDevices((prev) =>
          prev.map((d) =>
            d.pubkey === device.pubkey
              ? { ...d, isOnline, isLoading: false }
              : d
          )
        );
      } else {
        setDevices((prev) =>
          prev.map((d) =>
            d.pubkey === device.pubkey
              ? { ...d, isOnline: false, isLoading: false }
              : d
          )
        );
      }
    } catch (error) {
      setDevices((prev) =>
        prev.map((d) =>
          d.pubkey === device.pubkey
            ? { ...d, isOnline: false, isLoading: false }
            : d
        )
      );
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    const checkAllDevices = async () => {
      if (!isSubscribed) return;

      const currentDevices = deviceListRef.current;
      for (const device of currentDevices) {
        if (!isSubscribed) break;
        await checkDeviceStatus(device);
      }
    };

    checkAllDevices();

    const intervalId = setInterval(checkAllDevices, POLLING_INTERVAL);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDevices();
    }, [])
  );

  const StatusIndicator = ({
    isOnline,
    isLoading,
  }: {
    isOnline?: boolean;
    isLoading?: boolean;
  }) => (
    <View style={styles.statusContainer}>
      <Text style={styles.bracketText}>[</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color="#666" />
      ) : (
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isOnline ? "#28a745" : "#6c757d" },
          ]}
        />
      )}
      <Text style={styles.statusText}>
        {isLoading ? "Checking..." : isOnline ? "Online" : "Offline"}
      </Text>
      <Text style={styles.bracketText}>]</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.pubkey}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceNameRow}>
                <Text style={styles.deviceName}>
                  {item.deviceName.length > 15
                    ? `${item.deviceName.slice(0, 12)}...`
                    : item.deviceName}
                </Text>
                <StatusIndicator
                  isOnline={item.isOnline}
                  isLoading={item.isLoading}
                />
              </View>
              <Text style={styles.deviceDetails}>
                Public Key:{" "}
                {`${item.pubkey.slice(0, 9)}...${item.pubkey.slice(-9)}`}
              </Text>
              <Text style={styles.deviceDetails}>
                Relay URL:{" "}
                {item.relayUrl.length > 24
                  ? `${item.relayUrl.slice(0, 24)}...`
                  : item.relayUrl}
              </Text>
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() =>
                  router.push({
                    pathname: "/manage-device",
                    params: { pubkey: item.pubkey },
                  })
                }
              >
                <Text style={styles.manageButtonText}>Manage</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                router.push({
                  pathname: "/edit-device",
                  params: { pubkey: item.pubkey },
                })
              }
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 50 }}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/add-device")}
      >
        <Text style={styles.buttonText}>Add New Device</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0c0c",
    padding: 20,
  },
  deviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    backgroundColor: "#cfeef1",
    borderRadius: 10,
    marginBottom: 20,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    position: "relative",
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 15,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#666",
  },
  deviceDetails: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  editButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignSelf: "flex-start",
    marginTop: -5,
    marginRight: -5,
  },
  editButtonText: {
    color: "white",
    fontSize: 10,
  },
  addButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  manageButton: {
    backgroundColor: "#28a745",
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: "center",
    width: "118%",
  },
  manageButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  bracketText: {
    color: "#666",
    fontSize: 14,
    paddingHorizontal: 2,
  },
});
