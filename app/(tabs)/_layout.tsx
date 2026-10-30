import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { Platform, View, StyleSheet, Dimensions, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

// Glassmorphic rounded-square tab tile containing both icon and label with vibrant active state
const GlassTabBox = ({
  focused,
  iconName,
  label,
  colors,
  theme,
  isMiddle = false,
}: {
  focused: boolean;
  iconName: any;
  label: string;
  colors: any;
  theme: string;
  isMiddle?: boolean;
}) => {
  const isDark = theme === 'dark';

  const width = IS_TABLET ? 116 : 62;
  const height = IS_TABLET ? 66 : 54;
  const radius = IS_TABLET ? 18 : 14;
  const iconSize = IS_TABLET ? 24 : 19;

  return (
    <View
      style={[
        styles.glassIconWrapper,
        {
          width,
          height,
          borderRadius: radius,
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? (isDark ? 55 : 80) : 60}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.glassBoxBlur,
          {
            borderRadius: radius,
            backgroundColor: isDark
              ? (focused ? colors.primary + '40' : 'rgba(30, 30, 30, 0.7)')
              : (focused ? colors.primary + '25' : 'rgba(255, 255, 255, 0.7)'),
            borderColor: focused
              ? colors.primary
              : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.85)'),
            borderWidth: focused ? 2 : 1.2,
            paddingHorizontal: IS_TABLET ? 8 : 4,
          },
        ]}
      >
        <Ionicons
          size={iconSize}
          name={iconName}
          color={focused ? colors.primary : colors.textLight}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.glassBoxLabel,
            {
              color: focused ? colors.primary : colors.textLight,
              fontSize: IS_TABLET ? 11 : 8.5,
              fontWeight: focused ? '900' : '700',
              letterSpacing: IS_TABLET ? 0.6 : 0.3,
            },
          ]}
        >
          {label}
        </Text>
      </BlurView>
    </View>
  );
};

export default function TabLayout() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const pathname = usePathname();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textLight,
          tabBarShowLabel: false,
          tabBarBackground: () => null,
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            borderWidth: 0,
            height: IS_TABLET ? 96 : (Platform.OS === 'ios' ? 96 : 82),
            paddingBottom: IS_TABLET ? 20 : (Platform.OS === 'ios' ? 28 : 12),
            paddingTop: IS_TABLET ? 8 : 6,
            elevation: 0,
            shadowOpacity: 0,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          },
          headerShown: false,
        }}>
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ focused }) => {
              const isActive = focused || pathname === '/' || pathname === '/library' || pathname.startsWith('/library');
              return (
                <GlassTabBox
                  focused={isActive}
                  iconName={isActive ? "book" : "book-outline"}
                  label="Library"
                  colors={colors}
                  theme={theme}
                />
              );
            },
          }}
        />

        <Tabs.Screen
          name="notes"
          options={{
            title: 'Notes',
            tabBarIcon: ({ focused }) => {
              const isActive = focused || pathname === '/notes' || pathname.startsWith('/notes');
              return (
                <GlassTabBox
                  focused={isActive}
                  iconName={isActive ? "document-text" : "document-text-outline"}
                  label="Notes"
                  colors={colors}
                  theme={theme}
                />
              );
            },
          }}
        />

        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ focused }) => {
              const isActive = focused || pathname === '/stats' || pathname.startsWith('/stats');
              return (
                <GlassTabBox
                  focused={isActive}
                  iconName={isActive ? "stats-chart" : "stats-chart-outline"}
                  label="Stats"
                  colors={colors}
                  theme={theme}
                  isMiddle={true}
                />
              );
            },
          }}
        />

        <Tabs.Screen
          name="achievements"
          options={{
            title: 'Trophies',
            tabBarIcon: ({ focused }) => {
              const isActive = focused || pathname === '/achievements' || pathname.startsWith('/achievements');
              return (
                <GlassTabBox
                  focused={isActive}
                  iconName={isActive ? "trophy" : "trophy-outline"}
                  label="Trophies"
                  colors={colors}
                  theme={theme}
                />
              );
            },
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }) => {
              const isActive = focused || pathname === '/settings' || pathname.startsWith('/settings');
              return (
                <GlassTabBox
                  focused={isActive}
                  iconName={isActive ? "settings" : "settings-outline"}
                  label="Settings"
                  colors={colors}
                  theme={theme}
                />
              );
            },
          }}
        />

        {/* Hidden Screens */}
        <Tabs.Screen name="dm" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  glassIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassBoxBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  glassBoxLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
