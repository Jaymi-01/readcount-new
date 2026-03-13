import { setWidgetData } from 'expo-widgets';

interface WidgetData {
  booksRead: number;
  goal: number;
  lastBook: string;
}

export async function syncWidget(data: WidgetData) {
  try {
    await setWidgetData('ReadingProgress', data);
    console.log('Widget synced successfully');
  } catch (error) {
    console.error('Failed to sync widget:', error);
  }
}
