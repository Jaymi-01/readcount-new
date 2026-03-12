import { Stack } from "expo-router";
import { ThemeProvider } from "./context/ThemeContext";
import Toast from 'react-native-toast-message';
import { useEffect } from "react";
import { Platform } from "react-native";

export default function RootLayout() {
  useEffect(() => {
    const setupNotifications = async () => {
      if (Platform.OS === 'web') return;

      // Dynamically import to prevent side-effects on web/Node
      const Notifications = await import('expo-notifications');

      // 1. Configure handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // 2. Request Permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      // 3. Schedule the Yearly Wrapped Notification
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const alreadySet = scheduled.some(n => n.content.title?.includes("Wrapped"));

      if (!alreadySet) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🎁 Your Reading Wrapped is Ready!",
            body: "Come see your reading personality and celebrate your year in books!",
            sound: true,
          },
          trigger: {
            month: 12,
            day: 31,
            hour: 10,
            minute: 0,
            repeats: true,
          } as any,
        });
      }
    };

    setupNotifications();
  }, []);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </ThemeProvider>
  );
}
