import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, SafeAreaView, Platform, StatusBar, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Achievement {
  id: string;
  title: string;
  desc: string;
  howToEarn: string;
  icon: any;
  unlocked: boolean;
  unlockedAt?: any;
}

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first_step', title: 'First Step', desc: 'Mark your first book as read', howToEarn: 'marking your first book as finished.', icon: 'footsteps' },
  { id: 'the_finisher', title: 'The Finisher', desc: 'Reach your annual reading goal', howToEarn: 'completing your annual reading goal!', icon: 'trophy' },
  { id: 'night_owl', title: 'Night Owl', desc: 'Add a book after 11 PM', howToEarn: 'starting a new book late at night.', icon: 'moon' },
  { id: 'author_bestie', title: "Author's Bestie", desc: 'Read 5 books by one author', howToEarn: 'reading 5 books by the same author.', icon: 'people' },
  { id: 'speedy_reader', title: 'Speedy Reader', desc: 'Finish 5 books in a month', howToEarn: 'finishing 5 books in a single month.', icon: 'bicycle' },
  { id: 'speed_demon', title: 'Speed Demon', desc: 'Finish 10 books in a month', howToEarn: 'finishing 10 books in a single month.', icon: 'flash' },
  { id: 'speed_god', title: 'Speed God', desc: 'Finish 30 books in a month', howToEarn: 'finishing 30 books in a single month! Absolute legend.', icon: 'flame' },
  { id: 'the_polymath', title: 'The Polymath', desc: 'Read 5 different authors', howToEarn: 'reading books from 5 different authors.', icon: 'globe' },
  { id: 'the_critic', title: 'The Critic', desc: 'Rate 10 books', howToEarn: 'sharing your opinion and rating 10 books.', icon: 'star' },
  { id: 'indecisive', title: 'Indecisive', desc: 'Have 3 books in To-Read', howToEarn: 'having 3 books in your To-Read list.', icon: 'help-circle' },
  { id: 'cant_make_up_mind', title: "Can't Make Up Your Mind", desc: 'Have 5 books in To-Read', howToEarn: 'having 5 books in your To-Read list.', icon: 'git-branch' },
  { id: 'the_archivist', title: 'The Archivist', desc: 'Have 10 books in To-Read', howToEarn: 'having 10 books in your To-Read list.', icon: 'library' },
];

function TrophyItem({ item, colors, onDetails }: { item: Achievement, colors: any, onDetails: (a: Achievement) => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(withTiming(1.2, { duration: 100 }), withTiming(1, { duration: 100 }));
    onDetails(item);
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={handlePress}
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

  const [unlockedData, setUnlockedData] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const [showModal, setShowModal] = useState(false);

  // --- BACKFILL LOGIC FOR ADMIN ---
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
        if (date?.toDate) date = date.toDate();
        else if (date?.seconds) date = new Date(date.seconds * 1000);
        else date = new Date(date);
        return { ...data, processedDate: date };
      }).sort((a, b) => a.processedDate.getTime() - b.processedDate.getTime());

      const toReadCount = toReadSnap.size;
      const readingGoal = userDoc.data()?.readingGoal || 0;
      
      const toUnlock: {[key: string]: Timestamp} = {};

      if (readBooks.length >= 1) {
        toUnlock['first_step'] = Timestamp.fromDate(readBooks[0].processedDate);
      }
      
      if (readingGoal > 0 && readBooks.length >= readingGoal) {
        toUnlock['the_finisher'] = Timestamp.fromDate(readBooks[readingGoal - 1].processedDate);
      }

      if (toReadCount >= 10) toUnlock['the_archivist'] = Timestamp.now();
      if (toReadCount >= 5) toUnlock['cant_make_up_mind'] = Timestamp.now();
      if (toReadCount >= 3) toUnlock['indecisive'] = Timestamp.now();

      const uniqueAuthors = new Set();
      let polyAuthorCount = 0;
      for (const b of readBooks) {
        if (!uniqueAuthors.has(b.author)) {
          uniqueAuthors.add(b.author);
          polyAuthorCount++;
          if (polyAuthorCount === 5) {
            // Special override for Miller Joel to ensure it shows Dec 2025
            if (user.email === 'millerjoel7597@gmail.com' && b.processedDate.getFullYear() === 2026) {
               toUnlock['the_polymath'] = Timestamp.fromDate(new Date(2025, 11, 15));
            } else {
               toUnlock['the_polymath'] = Timestamp.fromDate(b.processedDate);
            }
          }
        }
      }

      // 5. Critic (10 Ratings - Use date of the 10th rated book)
      // Check for either a numeric rating > 0 OR a legacy review ('good'/'bad')
      const ratedBooks = readBooks.filter(b => (b.rating && b.rating > 0) || b.review === 'good' || b.review === 'bad');
      if (ratedBooks.length >= 10) {
        toUnlock['the_critic'] = Timestamp.fromDate(ratedBooks[9].processedDate);
      }
const authorGroups: any = {};
for (const b of readBooks) {
  authorGroups[b.author] = (authorGroups[b.author] || 0) + 1;
  if (authorGroups[b.author] === 5) {
    toUnlock['author_bestie'] = Timestamp.fromDate(b.processedDate);
  }
}

// 7. Speed Achievements (Scan every month in history)
const monthlyGroups: any = {};
readBooks.forEach(b => {
  const key = `${b.processedDate.getFullYear()}-${b.processedDate.getMonth()}`;
  if (!monthlyGroups[key]) monthlyGroups[key] = [];
  monthlyGroups[key].push(b);
});

Object.values(monthlyGroups).forEach((books: any) => {
  const mCount = books.length;
  const lastBookDate = Timestamp.fromDate(books[books.length - 1].processedDate);

  if (mCount >= 30) toUnlock['speed_god'] = lastBookDate;
  if (mCount >= 10) toUnlock['speed_demon'] = lastBookDate;
  if (mCount >= 5) toUnlock['speedy_reader'] = lastBookDate;
});

// Perform unlock updates
      for (const [id, unlockedAt] of Object.entries(toUnlock)) {
        const achRef = doc(db, 'users', user.uid, 'achievements', id);
        const achSnap = await getDoc(achRef);
        
        if (!achSnap.exists()) {
          await setDoc(achRef, { unlocked: true, unlockedAt });
        } else {
          const data = achSnap.data();
          const existingDate = data.unlockedAt?.toDate ? data.unlockedAt.toDate() : new Date(data.unlockedAt?.seconds * 1000);
          const newDate = unlockedAt.toDate();
          
          // Force fix: if we have a 2026 date but found a 2025 historical date, update it.
          if (existingDate.getFullYear() === 2026 && newDate.getFullYear() === 2025) {
            await setDoc(achRef, { unlocked: true, unlockedAt });
          }
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

    backfillAchievements();

    const q = query(collection(db, 'users', user.uid, 'achievements'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any = {};
      snapshot.forEach(doc => {
        data[doc.id] = doc.data();
      });
      setUnlockedData(data);
      setLoading(false);
    }, (error) => {
      console.error("Achievements fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    unlocked: !!unlockedData[def.id],
    unlockedAt: unlockedData[def.id]?.unlockedAt
  }));

  const openDetails = (ach: Achievement) => {
    setSelectedAch(ach);
    setShowModal(true);
  };

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
          {Object.keys(unlockedData).length} / {ACHIEVEMENT_DEFINITIONS.length} Unlocked
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {achievements.map((item) => (
            <TrophyItem key={item.id} item={item} colors={colors} onDetails={openDetails} />
          ))}
        </View>
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {selectedAch && (
              <>
                <View style={[styles.modalIconContainer, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name={selectedAch.icon} size={48} color={colors.primary} />
                </View>
                
                <Text style={[styles.unlockedDate, { color: colors.textLight }]}>
                  {(() => {
                    if (!selectedAch.unlocked) return 'Locked';
                    if (!selectedAch.unlockedAt) return 'Unlocked';
                    const d = selectedAch.unlockedAt.toDate ? selectedAch.unlockedAt.toDate() : new Date(selectedAch.unlockedAt.seconds * 1000);
                    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  })()}
                </Text>

                <Text style={[styles.modalTitle, { color: colors.textDark }]}>
                  {selectedAch.unlocked ? (
                    <>You earned <Text style={{ color: colors.primary }}>{selectedAch.title}</Text></>
                  ) : (
                    <Text style={{ color: colors.textLight }}>{selectedAch.title}</Text>
                  )}
                </Text>

                <Text style={[styles.modalHow, { color: colors.textLight }]}>
                  {selectedAch.unlocked 
                    ? `by ${selectedAch.howToEarn}`
                    : "Keep reading to unlock this achievement!"
                  }
                </Text>

                <TouchableOpacity 
                  style={[styles.closeBtn, { backgroundColor: selectedAch.unlocked ? colors.primary : colors.textLight }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.closeBtnText}>
                    {selectedAch.unlocked ? "Awesome!" : "I'm on it!"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    width: '100%',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  unlockedDate: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    opacity: 0.6,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalHow: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  closeBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});