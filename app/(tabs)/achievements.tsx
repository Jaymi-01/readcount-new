import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, SafeAreaView, Platform, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: any;
  unlocked: boolean;
}

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'night_owl', title: 'Night Owl', desc: 'Add a book after 11 PM', icon: 'moon' },
  { id: 'first_step', title: 'First Step', desc: 'Mark your first book as read', icon: 'footsteps' },
  { id: 'speedy_reader', title: 'Speedy Reader', desc: 'Finish 5 books in a month', icon: 'bicycle' },
  { id: 'speed_demon', title: 'Speed Demon', desc: 'Finish 10 books in a month', icon: 'flash' },
  { id: 'speed_god', title: 'Speed God', desc: 'Finish 30 books in a month', icon: 'flame' },
  { id: 'author_bestie', title: "Author's Bestie", desc: 'Read 5 books by one author', icon: 'people' },
  { id: 'indecisive', title: 'Indecisive', desc: 'Have 3 books in To-Read', icon: 'help-circle' },
  { id: 'cant_make_up_mind', title: "Can't Make Up Your Mind", desc: 'Have 5 books in To-Read', icon: 'git-branch' },
  { id: 'the_archivist', title: 'The Archivist', desc: 'Have 10 books in To-Read', icon: 'library' },
  { id: 'the_critic', title: 'The Critic', desc: 'Rate 10 books', icon: 'star' },
  { id: 'the_polymath', title: 'The Polymath', desc: 'Read 5 different authors', icon: 'globe' },
];

function TrophyCard({ item, index, colors }: { item: Achievement, index: number, colors: any }) {
  const glowValue = useSharedValue(1);

  useEffect(() => {
    if (item.unlocked) {
      glowValue.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 2000 }),
          withTiming(1, { duration: 2000 })
        ),
        -1, true
      );
    }
  }, [item.unlocked]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowValue.value }],
    shadowOpacity: item.unlocked ? 0.5 : 0,
  }));

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 100).springify()}
      style={[
        styles.trophyCard, 
        { 
          backgroundColor: item.unlocked ? colors.card : 'rgba(0,0,0,0.05)',
          borderColor: item.unlocked ? colors.primary : colors.border,
          opacity: item.unlocked ? 1 : 0.6
        }
      ]}
    >
      <Animated.View style={[styles.iconContainer, item.unlocked && { backgroundColor: colors.primaryLight }, glowStyle]}>
        <Ionicons 
          name={item.icon} 
          size={32} 
          color={item.unlocked ? colors.primary : colors.textLight} 
        />
      </Animated.View>
      <View style={styles.textInfo}>
        <Text style={[styles.trophyTitle, { color: item.unlocked ? colors.textDark : colors.textLight }]}>
          {item.title}
        </Text>
        <Text style={[styles.trophyDesc, { color: colors.textLight }]}>
          {item.desc}
        </Text>
      </View>
      {item.unlocked && (
        <View style={[styles.badge, { backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={12} color="white" />
        </View>
      )}
    </Animated.View>
  );
}

export default function AchievementsScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const user = auth.currentUser;

  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'achievements'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach(doc => ids.add(doc.id));
      setUnlockedIds(ids);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    unlocked: unlockedIds.has(def.id)
  }));

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textDark }]}>Trophy Shelf</Text>
          <View style={[styles.progressContainer, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.progressText, { color: colors.primary }]}>
              {unlockedCount} / {achievements.length} Unlocked
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {achievements.map((item, index) => (
            <TrophyCard key={item.id} item={item} index={index} colors={colors} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  progressContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  grid: {
    gap: 16,
  },
  trophyCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  textInfo: {
    flex: 1,
  },
  trophyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trophyDesc: {
    fontSize: 14,
    lineHeight: 18,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});