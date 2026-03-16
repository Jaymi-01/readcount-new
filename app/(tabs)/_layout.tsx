import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';

const CustomTabBarButton = ({ children, onPress, colors, focused }) => (
  <TouchableOpacity
    style={[
      styles.middleButtonContainer,
      {
        backgroundColor: colors.card,
        borderColor: colors.border,
      }
    ]}
    activeOpacity={0.8}
    onPress={onPress}
  >
    <View style={[
      styles.innerButton,
      focused && { backgroundColor: colors.primary + '15' }
    ]}>
      {children}
    </View>
  </TouchableOpacity>
);

export default function TabLayout() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textLight,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 90 : 70,
            paddingBottom: Platform.OS === 'ios' ? 30 : 10,
            elevation: 25,
            shadowColor: colors.textDark,
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.1,
            shadowRadius: 15,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            position: 'absolute',
          },
          tabBarLabelStyle: {
            fontWeight: '800',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          },
          headerShown: false,
        }}>
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "book" : "book-outline"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="dm"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={32} name={focused ? "stats-chart" : "stats-chart-outline"} color={color} />
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
            tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "trophy" : "trophy-outline"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "settings" : "settings-outline"} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  middleButtonContainer: {
    top: -25,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    // Custom shadow for the bulge
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  innerButton: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
