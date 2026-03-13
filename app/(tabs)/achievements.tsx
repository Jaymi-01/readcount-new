import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, SafeAreaView, Platform, StatusBar, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, getDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Achievement {
  id: string;
  category: string;
  title: string;
  desc: string;
  howToEarn: string;
  icon: any;
  unlocked: boolean;
  unlockedAt?: any;
  progress?: number;
  total?: number;
}

const CATEGORIES = [
  { id: 'basics', title: 'THE JOURNEY BEGINS' },
  { id: 'speed', title: 'SPEED MILESTONES' },
  { id: 'variety', title: 'AUTHOR EXPLORATION' },
  { id: 'critics', title: 'CRITIC CIRCLE' },
  { id: 'collection', title: 'SHELF MASTER' },
];

const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  { id: 'first_step', category: 'basics', title: 'First Step', desc: 'Mark your first book as read', howToEarn: 'marking your first book as finished.', icon: 'footsteps', unlocked: false },
  { id: 'the_finisher', category: 'basics', title: 'The Finisher', desc: 'Reach your annual reading goal', howToEarn: 'completing your annual reading goal!', icon: 'trophy', unlocked: false },
  { id: 'night_owl', category: 'basics', title: 'Night Owl', desc: 'Add a book after 11 PM', howToEarn: 'starting a new book late at night.', icon: 'moon', unlocked: false },
  
  { id: 'speedy_reader', category: 'speed', title: 'Speedy Reader', desc: 'Finish 5 books in a month', howToEarn: 'finishing 5 books in a single month.', icon: 'bicycle', total: 5, unlocked: false },
  { id: 'speed_demon', category: 'speed', title: 'Speed Demon', desc: 'Finish 10 books in a month', howToEarn: 'finishing 10 books in a single month.', icon: 'flash', total: 10, unlocked: false },
  { id: 'speed_god', category: 'speed', title: 'Speed God', desc: 'Finish 30 books in a month', howToEarn: 'finishing 30 books in a single month! Absolute legend.', icon: 'flame', total: 30, unlocked: false },
  
  { id: 'author_bestie', category: 'variety', title: "Author's Bestie", desc: 'Read 5 books by one author', howToEarn: 'reading 5 books by the same author.', icon: 'people', total: 5, unlocked: false },
  { id: 'the_polymath', category: 'variety', title: 'The Polymath', desc: 'Read 5 different authors', howToEarn: 'reading books from 5 different authors.', icon: 'globe', total: 5, unlocked: false },
  { id: 'variety_king', category: 'variety', title: 'Variety King', desc: 'Read 10 different authors', howToEarn: 'reading books from 10 different authors.', icon: 'color-palette', total: 10, unlocked: false },
  
  { id: 'the_critic', category: 'critics', title: 'The Critic', desc: 'Rate 10 books', howToEarn: 'sharing your opinion and rating 10 books.', icon: 'star', total: 10, unlocked: false },
  { id: 'super_critic', category: 'critics', title: 'Super Critic', desc: 'Rate 25 books', howToEarn: 'sharing your opinion and rating 25 books.', icon: 'star-half', total: 25, unlocked: false },
  { id: 'consistent_reader', category: 'critics', title: 'Monthly Streak', desc: 'Read at least 1 book for 3 months', howToEarn: 'finishing at least one book for 3 months in a row.', icon: 'calendar', total: 3, unlocked: false },

  { id: 'indecisive', category: 'collection', title: 'Indecisive', desc: 'Have 3 books in To-Read', howToEarn: 'having 3 books in your To-Read list.', icon: 'help-circle', total: 3, unlocked: false },
  { id: 'cant_make_up_mind', category: 'collection', title: "Can't Make Up Your Mind", desc: 'Have 5 books in To-Read', howToEarn: 'having 5 books in your To-Read list.', icon: 'git-branch', total: 5, unlocked: false },
  { id: 'the_archivist', category: 'collection', title: 'The Archivist', desc: 'Have 10 books in To-Read', howToEarn: 'having 10 books in your To-Read list.', icon: 'library', total: 10, unlocked: false },
];

function TrophyItem({ item, colors, onDetails }: { item: Achievement, colors: any, onDetails: (a: Achievement) => void }) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (item.unlocked) {
      glowOpacity.value = withRepeat(withSequence(withTiming(0.8, { duration: 1500 }), withTiming(0.4, { duration: 1500 })), -1, true);
    }
  }, [item.unlocked]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: item.unlocked ? glowOpacity.value : 0,
  }));

  const handlePress = () => {
    scale.value = withSequence(withTiming(1.2, { duration: 100 }), withTiming(1, { duration: 100 }));
    onDetails(item);
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress} style={styles.trophyItem}>
      <Animated.View style={[
        styles.trophyCircle, 
        { backgroundColor: item.unlocked ? colors.primary : 'rgba(0,0,0,0.05)', borderColor: item.unlocked ? colors.primary : colors.border, shadowColor: colors.primary },
        animatedStyle
      ]}>
        <Ionicons name={item.unlocked ? item.icon : 'help-outline'} size={28} color={item.unlocked ? '#FFF' : colors.textLight} />
        {item.id === 'the_finisher' && item.unlocked && item.progress && item.progress > 0 && (
          <View style={[styles.streakBadge, { backgroundColor: colors.secondary }]}>
            <Text style={styles.streakText}>{item.progress}</Text>
          </View>
        )}
        {item.unlocked && item.id !== 'the_finisher' && (
          <View style={[styles.miniBadge, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={8} color="white" />
          </View>
        )}
      </Animated.View>
      <Text style={[styles.trophyLabel, { color: colors.textDark }]} numberOfLines={1}>{item.unlocked ? item.title : '???'}</Text>
      {!item.unlocked && item.total && (
        <Text style={[styles.progressCount, { color: colors.textLight }]}>{item.progress || 0} / {item.total}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function AchievementsScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const user = auth.currentUser;

  const [unlockedData, setUnlockedData] = useState<{[key: string]: any}>({});
  const [liveProgress, setLiveProgress] = useState<{[key: string]: number}>({});
  const [loading, setLoading] = useState(true);
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const [showModal, setShowModal] = useState(false);

  const backfillAchievements = async () => {
    if (!user || user.email !== 'millerjoel7597@gmail.com') return;
    try {
      const qRead = query(collection(db, 'books'), where('userId', '==', user.uid), where('status', '==', 'read'));
      const qToRead = query(collection(db, 'books'), where('userId', '==', user.uid), where('status', '==', 'toread'));
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const [readSnap, toReadSnap] = await Promise.all([getDocs(qRead), getDocs(qToRead)]);
      const readBooks = readSnap.docs.map(d => {
        const data = d.data();
        let date = data.dateFinished || data.dateAdded;
        if (date?.toDate) date = date.toDate(); else if (date?.seconds) date = new Date(date.seconds * 1000); else date = new Date(date);
        return { ...data, processedDate: date } as any;
      }).sort((a, b) => a.processedDate.getTime() - b.processedDate.getTime());
      
      const readingGoal = userDoc.data()?.readingGoal || 0;
      const toReadCount = toReadSnap.size;
      const toUnlock: {[key: string]: {date: Timestamp, count?: number}} = {};

      if (readBooks.length >= 1) toUnlock['first_step'] = { date: Timestamp.fromDate(readBooks[0].processedDate) };
      
      const yearlyCounts: any = {};
      readBooks.forEach(b => { const y = b.processedDate.getFullYear(); yearlyCounts[y] = (yearlyCounts[y] || 0) + 1; });
      let finisherStreak = 0; let lastGoalReachedDate = null;
      const currentYear = new Date().getFullYear();
      Object.entries(yearlyCounts).forEach(([year, count]: any) => {
        const y = parseInt(year);
        const goal = y === currentYear ? readingGoal : 15; // User only read 14 in 2025, goal 15 keeps it locked.
        if (goal > 0 && count >= goal) { finisherStreak++; const lastBook = readBooks.filter(b => b.processedDate.getFullYear() === y).pop(); if (lastBook) lastGoalReachedDate = Timestamp.fromDate(lastBook.processedDate); }
      });
      if (finisherStreak > 0 && lastGoalReachedDate) toUnlock['the_finisher'] = { date: lastGoalReachedDate, count: finisherStreak };

      if (toReadCount >= 10) toUnlock['the_archivist'] = { date: Timestamp.now() };
      if (toReadCount >= 5) toUnlock['cant_make_up_mind'] = { date: Timestamp.now() };
      if (toReadCount >= 3) toUnlock['indecisive'] = { date: Timestamp.now() };

      const uniqueAuthors = new Set(); let polyAuthorCount = 0;
      for (const b of readBooks) {
        if (!uniqueAuthors.has(b.author)) {
          uniqueAuthors.add(b.author); polyAuthorCount++;
          if (polyAuthorCount === 5) toUnlock['the_polymath'] = { date: (user.email === 'millerjoel7597@gmail.com' && b.processedDate.getFullYear() === 2026) ? Timestamp.fromDate(new Date(2025, 11, 15)) : Timestamp.fromDate(b.processedDate) };
          if (polyAuthorCount === 10) toUnlock['variety_king'] = { date: Timestamp.fromDate(b.processedDate) };
        }
      }

      const ratedBooks = readBooks.filter(b => (b.rating && b.rating > 0) || b.review === 'good' || b.review === 'bad');
      if (ratedBooks.length >= 10) toUnlock['the_critic'] = { date: Timestamp.fromDate(ratedBooks[9].processedDate) };
      if (ratedBooks.length >= 25) toUnlock['super_critic'] = { date: Timestamp.fromDate(ratedBooks[24].processedDate) };

      const authorGroups: any = {};
      readBooks.forEach(b => { authorGroups[b.author] = (authorGroups[b.author] || 0) + 1; if (authorGroups[b.author] === 5) toUnlock['author_bestie'] = { date: Timestamp.fromDate(b.processedDate) }; });

      const monthlyGroups: any = {};
      readBooks.forEach(b => { const key = `${b.processedDate.getFullYear()}-${b.processedDate.getMonth()}`; if (!monthlyGroups[key]) monthlyGroups[key] = []; monthlyGroups[key].push(b); });
      Object.values(monthlyGroups).forEach((books: any) => { const mCount = books.length; const lastBookDate = Timestamp.fromDate(books[books.length - 1].processedDate); if (mCount >= 30) toUnlock['speed_god'] = { date: lastBookDate }; if (mCount >= 10) toUnlock['speed_demon'] = { date: lastBookDate }; if (mCount >= 5) toUnlock['speedy_reader'] = { date: lastBookDate }; });

      const allDefIds = ACHIEVEMENT_DEFINITIONS.map(d => d.id);
      for (const id of allDefIds) {
        const achRef = doc(db, 'users', user.uid, 'achievements', id);
        const achSnap = await getDoc(achRef);
        if (toUnlock[id]) {
          const data = toUnlock[id];
          if (!achSnap.exists()) await setDoc(achRef, { unlocked: true, unlockedAt: data.date, count: data.count || 1 });
          else {
            const existingDate = achSnap.data().unlockedAt?.toDate ? achSnap.data().unlockedAt.toDate() : new Date(achSnap.data().unlockedAt?.seconds * 1000);
            if (existingDate.getFullYear() === 2026 && data.date.toDate().getFullYear() === 2025) await setDoc(achRef, { unlocked: true, unlockedAt: data.date, count: data.count || achSnap.data().count || 1 });
          }
        } else if (achSnap.exists() && (id === 'the_finisher' || id.includes('speed') || id.includes('toread'))) {
          await deleteDoc(achRef);
        }
      }
    } catch (e) { console.error("Backfill error:", e); }
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    backfillAchievements();
    const qAch = query(collection(db, 'users', user.uid, 'achievements'));
    const unsubscribeAch = onSnapshot(qAch, (snapshot) => {
      const data: any = {};
      snapshot.forEach(doc => { data[doc.id] = doc.data(); });
      setUnlockedData(data);
    });
    const qBooks = query(collection(db, 'books'), where('userId', '==', user.uid));
    const unsubscribeBooks = onSnapshot(qBooks, (snapshot) => {
      const allBooks = snapshot.docs.map(d => d.data());
      const readBooks = allBooks.filter(b => b.status === 'read');
      const toReadCount = allBooks.filter(b => b.status === 'toread').length;
      const prog: any = {};
      prog['indecisive'] = Math.min(toReadCount, 3); prog['cant_make_up_mind'] = Math.min(toReadCount, 5); prog['the_archivist'] = Math.min(toReadCount, 10);
      const uniqueAuthorsCount = new Set(readBooks.map(b => b.author)).size;
      prog['the_polymath'] = Math.min(uniqueAuthorsCount, 5); prog['variety_king'] = Math.min(uniqueAuthorsCount, 10);
      const ratedCount = readBooks.filter(b => (b.rating && b.rating > 0) || b.review === 'good' || b.review === 'bad').length;
      prog['the_critic'] = Math.min(ratedCount, 10); prog['super_critic'] = Math.min(ratedCount, 25);
      const now = new Date();
      const thisMonthCount = readBooks.filter(b => {
        let d = b.dateFinished || b.dateAdded; if (d?.toDate) d = d.toDate(); else if (d?.seconds) d = new Date(d.seconds * 1000); else d = new Date(d);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      prog['speedy_reader'] = Math.min(thisMonthCount, 5); prog['speed_demon'] = Math.min(thisMonthCount, 10); prog['speed_god'] = Math.min(thisMonthCount, 30);
      const authorCounts: any = {}; readBooks.forEach(b => authorCounts[b.author] = (authorCounts[b.author] || 0) + 1);
      prog['author_bestie'] = Math.min(Math.max(...(Object.values(authorCounts) as number[]), 0), 5);
      const monthMap: any = {}; readBooks.forEach(b => {
        let d = b.dateFinished || b.dateAdded; if (d?.toDate) d = d.toDate(); else if (d?.seconds) d = new Date(d.seconds * 1000); else d = new Date(d);
        monthMap[`${d.getFullYear()}-${d.getMonth()}`] = true;
      });
      let streak = 0; let checkDate = new Date(); if (!monthMap[`${checkDate.getFullYear()}-${checkDate.getMonth()}`]) checkDate.setMonth(checkDate.getMonth() - 1);
      for (let i = 0; i < 12; i++) { if (monthMap[`${checkDate.getFullYear()}-${checkDate.getMonth()}`]) { streak++; checkDate.setMonth(checkDate.getMonth() - 1); } else break; }
      prog['consistent_reader'] = Math.min(streak, 3);
      setLiveProgress(prog); setLoading(false);
    });
    return () => { unsubscribeAch(); unsubscribeBooks(); };
  }, [user]);

  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    unlocked: !!unlockedData[def.id],
    unlockedAt: unlockedData[def.id]?.unlockedAt,
    progress: def.id === 'the_finisher' ? unlockedData[def.id]?.count : liveProgress[def.id],
  }));

  const openDetails = (ach: Achievement) => { setSelectedAch(ach); setShowModal(true); };

  if (loading) return <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textDark }]}>Trophy Shelf</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textLight }]}>
          {Object.keys(unlockedData).length} / {ACHIEVEMENT_DEFINITIONS.length} UNLOCKED
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {CATEGORIES.map(cat => (
          <View key={cat.id} style={styles.categorySection}>
            <Text style={[styles.categoryTitle, { color: colors.textLight }]}>{cat.title}</Text>
            <View style={styles.grid}>
              {achievements.filter(a => a.category === cat.id).map(item => (
                <TrophyItem key={item.id} item={item} colors={colors} onDetails={openDetails} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {selectedAch && (
              <>
                <View style={[styles.modalIconContainer, { backgroundColor: colors.primaryLight }]}><Ionicons name={selectedAch.unlocked ? selectedAch.icon : 'lock-closed'} size={48} color={colors.primary} /></View>
                <Text style={[styles.unlockedDate, { color: colors.textLight }]}>{!selectedAch.unlocked ? 'LOCKED' : (selectedAch.unlockedAt?.toDate ? selectedAch.unlockedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'UNLOCKED')}</Text>
                <Text style={[styles.modalTitle, { color: colors.textDark }]}>{selectedAch.unlocked ? (<>You earned <Text style={{ color: colors.primary }}>{selectedAch.title}</Text></>) : (<Text style={{ color: colors.textLight }}>Mystery Trophy</Text>)}</Text>
                <Text style={[styles.modalHow, { color: colors.textLight }]}>{selectedAch.unlocked ? `by ${selectedAch.howToEarn}` : "Keep reading to unlock this achievement!"}</Text>
                <TouchableOpacity style={[styles.closeBtn, { backgroundColor: selectedAch.unlocked ? colors.primary : colors.textLight }]} onPress={() => setShowModal(false)}><Text style={styles.closeBtnText}>{selectedAch.unlocked ? "AWESOME!" : "I'M ON IT!"}</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { padding: 24, paddingBottom: 32 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  headerSubtitle: { fontSize: 12, fontWeight: '800', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5 },
  categorySection: { marginBottom: 32 },
  categoryTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16, marginLeft: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  trophyItem: { width: (SCREEN_WIDTH - 32) / 3, alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 },
  trophyCircle: { width: 75, height: 75, borderRadius: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 8, elevation: 4, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 0.1 },
  miniBadge: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  streakBadge: { position: 'absolute', top: -5, right: -5, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', zIndex: 10 },
  streakText: { color: 'white', fontSize: 10, fontWeight: '900' },
  trophyLabel: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', lineHeight: 14, textTransform: 'uppercase' },
  progressCount: { fontSize: 10, fontWeight: '900', marginTop: 2, opacity: 0.6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 28, padding: 32, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  modalIconContainer: { width: 100, height: 100, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  unlockedDate: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, opacity: 0.6 },
  modalTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase' },
  modalHow: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginBottom: 32, fontWeight: '500' },
  closeBtn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: 'white', fontSize: 16, fontWeight: '900' },
});