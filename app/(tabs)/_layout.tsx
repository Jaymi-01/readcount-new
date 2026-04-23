import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

const CustomTabBarButton = ({ children, onPress, colors, focused }: { children: any, onPress?: any, colors: any, focused?: boolean }) => (
  <View style={styles.tabButtonWrapper}>
    <TouchableOpacity
      style={[
        styles.middleButtonContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          width: IS_TABLET ? 90 : 70,
          height: IS_TABLET ? 90 : 70,
          borderRadius: IS_TABLET ? 45 : 35,
          top: IS_TABLET ? -35 : -32,
          elevation: IS_TABLET ? 15 : 10,
          shadowOpacity: IS_TABLET ? 0.3 : 0.2,
        }
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[
        styles.innerButton,
        focused && { backgroundColor: colors.primary + '15' },
        { borderRadius: IS_TABLET ? 45 : 35 }
      ]}>
        {children}
      </View>
    </TouchableOpacity>
  </View>
);

export default function TabLayout() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textLight,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: 0,
            height: IS_TABLET ? 80 : (Platform.OS === 'ios' ? 100 : 80),
            paddingBottom: IS_TABLET ? 10 : (Platform.OS === 'ios' ? 35 : 15),
            paddingTop: 12,
            elevation: 25,
            shadowColor: colors.textDark,
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.1,
            shadowRadius: 15,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          },
          tabBarLabelStyle: {
            fontWeight: '800',
            fontSize: IS_TABLET ? 12 : 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 4,
          },
          headerShown: false,
        }}>
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "book" : "book-outline"} color={color} />,
          }}
        />

        <Tabs.Screen
          name="notes"
          options={{
            title: 'Notes',
            tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "document-text" : "document-text-outline"} color={color} />,
          }}
        />

        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={36} name={focused ? "stats-chart" : "stats-chart-outline"} color={color} />
            ),
            tabBarButton: (props) => (
              <CustomTabBarButton 
                {...props} 
                colors={colors} 
                focused={props.accessibilityState?.selected}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="achievements"
          options={{
            title: 'Trophies',
            tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "trophy" : "trophy-outline"} color={color} />,
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "settings" : "settings-outline"} color={color} />,
          }}
        />

        {/* Hidden Screens */}
        <Tabs.Screen name="dm" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabButtonWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  middleButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  innerButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
