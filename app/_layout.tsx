import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

export default function Layout() {
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#000",
          },
          headerTitleStyle: {
            color: "#fff",
          },
          headerTintColor: "#fff",
          statusBarStyle: "light",
          contentStyle: { backgroundColor: "#0e0c0c" },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "PowerTasker",
            headerLeft: () => null,
          }}
        />
        <Stack.Screen
          name="add-device"
          options={{
            title: "Add New Device",
          }}
        />
        <Stack.Screen
          name="edit-device"
          options={{
            title: "Edit Device",
          }}
        />
        <Stack.Screen
          name="manage-device"
          options={{
            title: "Manage Device",
          }}
        />
        <Stack.Screen
          name="sign-send"
          options={{
            title: "Sign and Send",
          }}
        />
      </Stack>
    </View>
  );
}
