import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";
import { LockProvider } from "../context/LockContext";
import Toast from 'react-native-toast-message';
import { useEffect } from "react";
import { Platform, AppState } from "react-native";
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const { currentlyRunning } = Updates.useUpdates();

  // Check if we just updated on launch
  useEffect(() => {
    const checkUpdateStatus = async () => {
      if (__DEV__) return;

      try {
        const lastUpdateId = await AsyncStorage.getItem('last_notified_update_id');
        const currentUpdateId = currentlyRunning.updateId;

        // If we have a currentUpdateId and it's different from the last one we notified about
        if (currentUpdateId && lastUpdateId && currentUpdateId !== lastUpdateId) {
          // Get the message from the manifest (this is what you type in 'eas update --message "..."')
          const manifest: any = currentlyRunning.manifest;
          const updateMessage = manifest?.metadata?.message || "New improvements and bug fixes!";

          Toast.show({
            type: 'success',
            text1: '🚀 App Updated!',
            text2: updateMessage,
            visibilityTime: 5000,
          });
        }

        // Always save the current ID so we don't notify again
        if (currentUpdateId) {
          await AsyncStorage.setItem('last_notified_update_id', currentUpdateId);
        }
      } catch (e) {
        console.error("Error checking update status:", e);
      }
    };

    checkUpdateStatus();
  }, [currentlyRunning.updateId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        if (!__DEV__) {
          Updates.checkForUpdateAsync().then((result) => {
            if (result.isAvailable) {
              // This downloads the update in the background
              Updates.fetchUpdateAsync();
            }
          }).catch(err => console.error("Update check error:", err));
        }
      }
    });
    return () => subscription.remove();
  }, []);

  // ... (rest of setupNotifications effect remains the same)
  useEffect(() => {
    let isMounted = true;

    const setupNotifications = async () => {
      try {
        if (Platform.OS === 'web') return;

        // Skip setup on Android if running in Expo Go (SDK 53+ restriction)
        const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
        if (Platform.OS === 'android' && isExpoGo) {
          console.log('Skipping notification setup: expo-notifications is not supported on Android in Expo Go (SDK 53+).');
          return;
        }

        // Dynamically import to prevent side-effects on web/Node
        const Notifications = await import('expo-notifications');

        if (!isMounted) return;

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

        if (!alreadySet && isMounted) {
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
      } catch (error) {
        console.error("Notification setup error:", error);
      }
    };

    setupNotifications();
    return () => { isMounted = false; };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LockProvider>
          <Stack screenOptions={{ 
            headerShown: false,
          }} />
          <Toast />
        </LockProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
