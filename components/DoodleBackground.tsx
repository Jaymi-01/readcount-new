import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Grid configuration
const ICON_SIZE = 24;
const SPACING = 60;
const ROWS = Math.ceil(height / SPACING) + 1;
const COLS = Math.ceil(width / SPACING) + 1;

const ICONS = [
  { name: 'book-outline', family: 'Ionicons' },
  { name: 'heart-outline', family: 'Ionicons' },
  { name: 'bookmark-outline', family: 'Ionicons' },
  { name: 'pencil-outline', family: 'Ionicons' },
  { name: 'coffee', family: 'MaterialCommunityIcons' },
  { name: 'feather', family: 'MaterialCommunityIcons' },
  { name: 'glasses', family: 'MaterialCommunityIcons' },
  { name: 'library-outline', family: 'Ionicons' },
  { name: 'star-outline', family: 'Ionicons' },
  { name: 'bulb-outline', family: 'Ionicons' },
];

interface DoodleBackgroundProps {
  colors: any;
  opacity?: number;
}

export const DoodleBackground: React.FC<DoodleBackgroundProps> = ({ colors, opacity = 0.1 }) => {
  const doodleIcons = useMemo(() => {
    const items = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Deterministic pseudo-randomness based on grid position
        const seed = (r * COLS + c) * 123.45;
        const iconIndex = Math.floor((Math.abs(Math.sin(seed))) * ICONS.length);
        const rotation = Math.floor((Math.abs(Math.cos(seed))) * 60) - 30; // -30 to 30 degrees
        const icon = ICONS[iconIndex];
        
        items.push(
          <View
            key={`${r}-${c}`}
            style={[
              styles.iconWrapper,
              {
                left: c * SPACING + (r % 2 === 0 ? 0 : SPACING / 2),
                top: r * SPACING,
                transform: [{ rotate: `${rotation}deg` }],
              }
            ]}
          >
            {icon.family === 'Ionicons' ? (
              <Ionicons name={icon.name as any} size={ICON_SIZE} color={colors.textDark} />
            ) : (
              <MaterialCommunityIcons name={icon.name as any} size={ICON_SIZE} color={colors.textDark} />
            )}
          </View>
        );
      }
    }
    return items;
  }, [colors.textDark]);

  return (
    <View 
      style={[StyleSheet.absoluteFill, styles.container]} 
      pointerEvents="none"
    >
      <View style={[StyleSheet.absoluteFill, { opacity }]}>
        {doodleIcons}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: -1,
    overflow: 'hidden',
  },
  iconWrapper: {
    position: 'absolute',
    width: SPACING,
    height: SPACING,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
