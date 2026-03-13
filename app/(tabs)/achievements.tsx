import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, SafeAreaView, Platform, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence, withDelay } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: any;
  unlocked: boolean;
}

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first_step', title: 'First Step', desc: 'Mark your first book as read', icon: 'footsteps' },
  { id: 'the_finisher', title: 'The Finisher', desc: 'Reach your annual reading goal', icon: 'trophy' },
  { id: 'night_owl', title: 'Night Owl', desc: 'Add a book after 11 PM', icon: 'moon' },
  { id: 'author_bestie', title: "Author's Bestie", desc: 'Read 5 books by one author', icon: 'people' },
  { id: 'speedy_reader', title: 'Speedy Reader', desc: 'Finish 5 books in a month', icon: 'bicycle' },
  { id: 'speed_demon', title: 'Speed Demon', desc: 'Finish 10 books in a month', icon: 'flash' },
  { id: 'speed_god', title: 'Speed God', desc: 'Finish 30 books in a month', icon: 'flame' },
  { id: 'the_polymath', title: 'The Polymath', desc: 'Read 5 different authors', icon: 'globe' },
  { id: 'the_critic', title: 'The Critic', desc: 'Rate 10 books', icon: 'star' },
  { id: 'indecisive', title: 'Indecisive', desc: 'Have 3 books in To-Read', icon: 'help-circle' },
  { id: 'cant_make_up_mind', title: "Can't Make Up Your Mind", desc: 'Have 5 books in To-Read', icon: 'git-branch' },
  { id: 'the_archivist', title: 'The Archivist', desc: 'Have 10 books in To-Read', icon: 'library' },
];

function TrophyItem({ item, colors }: { item: Achievement, colors: any }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPress = () => {
    scale.value = withSequence(withTiming(1.2, { duration: 100 }), withTiming(1, { duration: 100 }));
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.trophyItem}
    >
      <Animated.View style={[
        styles.trophyCircle, 
        { backgroundColor: item.unlocked ? colors.primary : 'rgba(0,0,0,0.05)', borderColor: item.unlocked ? colors.primary : colors.border },
        animatedStyle
      ]}>
        <Ionicons name={item.icon} size={28} color={item.unlocked ? '#FFF' : colors.textLight} />
        {item.unlocked && (
          <View style={[styles.miniBadge, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={8} color="white" />
          </View>
        )}
      </Animated.View>
      <Text style={[styles.trophyLabel, { color: colors.textDark }]} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  );
}
export default function AchievementsScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const user = auth.currentUser;

  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // --- BACKFILL LOGIC FOR ADMIN ---
  const backfillAchievements = async () => {
    if (!user || user.email !== 'millerjoel7597@gmail.com') return;

    try {
      const qRead = query(collection(db, 'books'), where('userId', '==', user.uid), where('status', '==', 'read'));
      const qToRead = query(collection(db, 'books'), where('userId', '==', user.uid), where('status', '==', 'toread'));
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const [readSnap, toReadSnap] = await Promise.all([getDocs(qRead), getDocs(qToRead)]);

      const readBooks = readSnap.docs.map(d => d.data());
      const toReadCount = toReadSnap.size;
      const readingGoal = userDoc.data()?.readingGoal || 0;
      
      const toUnlock = new Set<string>();

      // 1. First Step
      if (readBooks.length >= 1) toUnlock.add('first_step');
      
      // 2. The Finisher
      if (readingGoal > 0 && readBooks.length >= readingGoal) toUnlock.add('the_finisher');

      // 3. To-Read Milestones
      if (toReadCount >= 10) toUnlock.add('the_archivist');
      if (toReadCount >= 5) toUnlock.add('cant_make_up_mind');
      if (toReadCount >= 3) toUnlock.add('indecisive');

      // 4. Polymath (5 Authors)
      const authors = new Set(readBooks.map(b => b.author));
      if (authors.size >= 5) toUnlock.add('the_polymath');

      // 5. Critic (10 Ratings)
      const ratedCount = readBooks.filter(b => b.rating > 0).length;
      if (ratedCount >= 10) toUnlock.add('the_critic');

      // 6. Author Bestie (5 books by same author)
      const authorCounts: any = {};
      readBooks.forEach(b => authorCounts[b.author] = (authorCounts[b.author] || 0) + 1);
      if (Object.values(authorCounts).some((c: any) => c >= 5)) toUnlock.add('author_bestie');

      // Perform unlock updates
      for (const id of toUnlock) {
        const achRef = doc(db, 'users', user.uid, 'achievements', id);
        const achSnap = await getDoc(achRef);
        if (!achSnap.exists()) {
          await setDoc(achRef, { unlocked: true, unlockedAt: Timestamp.now() });
        }
      }
    } catch (e) {
      console.error("Backfill error:", e);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Trigger backfill for admin
    backfillAchievements();

    const q = query(collection(db, 'users', user.uid, 'achievements'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach(doc => ids.add(doc.id));
      setUnlockedIds(ids);
      setLoading(false);
    }, (error) => {
      console.error("Achievements fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    unlocked: unlockedIds.has(def.id)
  }));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textDark }]}>Trophy Shelf</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textLight }]}>
          {unlockedIds.size} / {ACHIEVEMENT_DEFINITIONS.length} Unlocked
        </Text>
      </View>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {achievements.map((item) => (
            <TrophyItem key={item.id} item={item} colors={colors} />
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
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    padding: 24,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  trophyItem: {
    width: (SCREEN_WIDTH - 32) / 3,
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  trophyCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  miniBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  trophyLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 14,
  },
});