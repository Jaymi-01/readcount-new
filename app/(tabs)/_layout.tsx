import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';

export default function TabLayout() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          paddingTop: 10,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          ...Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dm"
        options={{
          title: 'DM',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="chatbubble" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="stats-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
