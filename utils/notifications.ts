import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export async function triggerLocalNotification(title: string, body: string) {
  try {
    if (Platform.OS === 'web') return;

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (Platform.OS === 'android' && isExpoGo) {
      console.log('Skipping push notification: expo-notifications is not supported on Android in Expo Go.');
      return;
    }

    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // trigger immediately
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}
