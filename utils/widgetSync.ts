import { Platform } from 'react-native';

interface WidgetData {
  booksRead: number;
  goal: number;
  lastBook: string;
}

export async function syncWidget(data: WidgetData) {
  // Widgets are only for Android/iOS native builds
  if (Platform.OS === 'web') return;

  try {
    // Dynamically require to prevent crash if module is missing
    const { setWidgetData, isWidgetAvailable } = require('expo-widgets');
    
    // Some versions of expo-widgets have an isWidgetAvailable check
    if (isWidgetAvailable && !isWidgetAvailable()) {
      console.log('Widgets are not available on this device/environment');
      return;
    }

    await setWidgetData('ReadingProgress', data);
    console.log('Widget synced successfully');
  } catch (error) {
    // This will catch "Cannot find native module" without crashing the app
    console.log('Widget sync skipped: Native module not found (likely running in Expo Go)');
  }
}
