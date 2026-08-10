import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Platform, StatusBar, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { DoodleBackground } from '../../components/DoodleBackground';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Achievement {
  id: string;
  category: string;
  title: string;
  desc: string;
  howToEarn: string;
  icon: any;
  iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
  unlocked: boolean;
  unlockedAt?: any;
  progress?: number;
  total?: number;
}

interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  status: 'read' | 'reading' | 'toread';
  dateAdded: any;
  dateFinished?: any;
  dateStartedReading?: any;
  rating?: number;
  review?: string;
  genre?: string;
  processedDate: Date;
}

const CATEGORIES = [
  { id: 'basics', title: 'THE JOURNEY BEGINS' },
  { id: 'habits', title: 'DAILY RITUALS' },
  { id: 'speed', title: 'SPEED MILESTONES' },
  { id: 'streaks', title: 'CONSISTENCY MATTERS' },
  { id: 'variety', title: 'VARIETY & EXPLORATION' },
  { id: 'critics', title: 'CRITIC CIRCLE' },
  { id: 'collection', title: 'SHELF MASTER' },
];

const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  { id: 'first_step', category: 'basics', title: 'First Step', desc: 'Mark your first book as read', howToEarn: 'marking your first book as finished.', icon: 'footsteps', unlocked: false },
  { id: 'quick_start', category: 'basics', title: 'Quick Start', desc: 'Add 3 books to your library', howToEarn: 'adding your first 3 books to your collection.', icon: 'rocket', total: 3, unlocked: false },
  { id: 'the_finisher', category: 'basics', title: 'The Finisher', desc: 'Reach your annual reading goal', howToEarn: 'completing your annual reading goal!', icon: 'trophy', unlocked: false },
  { id: 'page_turner', category: 'basics', title: 'Page Turner', desc: 'Move a book to Reading', howToEarn: 'starting to read a book from your list.', icon: 'book', unlocked: false },
  { id: 'godmode', category: 'basics', title: 'The Creator', desc: 'The Creator', howToEarn: 'being the one who built this entire universe.', icon: 'code-slash', unlocked: false },
  { id: 'bronze_milestone', category: 'basics', title: 'Bronze Milestone', desc: 'Read 10 books in total', howToEarn: 'marking 10 books as read.', icon: 'medal', total: 10, unlocked: false },
  { id: 'silver_milestone', category: 'basics', title: 'Silver Milestone', desc: 'Read 25 books in total', howToEarn: 'marking 25 books as read.', icon: 'ribbon', total: 25, unlocked: false },
  { id: 'gold_milestone', category: 'basics', title: 'Gold Milestone', desc: 'Read 50 books in total', howToEarn: 'marking 50 books as read.', icon: 'trophy', total: 50, unlocked: false },
  { id: 'diamond_milestone', category: 'basics', title: 'Diamond Milestone', desc: 'Read 100 books in total', howToEarn: 'marking 100 books as read.', icon: 'sparkles', total: 100, unlocked: false },
  
  { id: 'weekend_warrior', category: 'habits', title: 'Weekend Warrior', desc: 'Finish a book on the weekend', howToEarn: 'completing a book on a Saturday or Sunday.', icon: 'cafe', unlocked: false },
  { id: 'morning_reader', category: 'habits', title: 'Early Bird', desc: 'Finish a book before 9 AM', howToEarn: 'completing a book early in the morning.', icon: 'alarm', unlocked: false },
  { id: 'night_owl', category: 'habits', title: 'Night Owl', desc: 'Add a book after 11 PM', howToEarn: 'starting a new book late at night.', icon: 'owl', iconFamily: 'MaterialCommunityIcons', unlocked: false },
  { id: 'first_note', category: 'habits', title: 'Draftsman', desc: 'Write your first reading note', howToEarn: 'writing your first reading note.', icon: 'pencil-outline', unlocked: false },
  { id: 'deep_thinker', category: 'habits', title: 'Deep Thinker', desc: 'Write 10 notes across your books', howToEarn: 'writing 10 reading notes.', icon: 'bulb-outline', total: 10, unlocked: false },
  { id: 'goal_setter', category: 'habits', title: 'Goal Setter', desc: 'Set your annual reading goal', howToEarn: 'updating your annual reading goal in settings.', icon: 'flag', unlocked: false },
  { id: 'lunch_reader', category: 'habits', title: 'Lunch Break', desc: 'Finish a book between 12 PM and 2 PM', howToEarn: 'finishing a book during lunch hours.', icon: 'pizza', unlocked: false },
  { id: 'midnight_reader', category: 'habits', title: 'Midnight Marathon', desc: 'Finish a book between 12 AM and 4 AM', howToEarn: 'finishing a book late at night.', icon: 'moon', unlocked: false },
  { id: 'annotator_notes', category: 'habits', title: 'Annotator', desc: 'Write 5 reading notes', howToEarn: 'writing 5 reading notes in total.', icon: 'document-text', total: 5, unlocked: false },
  { id: 'chronicler', category: 'habits', title: 'The Chronicler', desc: 'Write 25 notes in total', howToEarn: 'writing 25 reading notes in total.', icon: 'journal', total: 25, unlocked: false },

  { id: 'speedy_reader', category: 'speed', title: 'Speedy Reader', desc: 'Finish 5 books in a month', howToEarn: 'finishing 5 books in a single month.', icon: 'walk', total: 5, unlocked: false },
  { id: 'speed_demon', category: 'speed', title: 'Speed Demon', desc: 'Finish 10 books in a month', howToEarn: 'finishing 10 books in a single month.', icon: 'bicycle', total: 10, unlocked: false },
  { id: 'speed_god', category: 'speed', title: 'Speed God', desc: 'Finish 30 books in a month', howToEarn: 'finishing 30 books in a single month! Absolute legend.', icon: 'flame', total: 30, unlocked: false },
  { id: 'book_devourer', category: 'speed', title: 'Book Devourer', desc: 'Finish a book within 48 hours of starting it', howToEarn: 'finishing a book within 48 hours of starting it.', icon: 'restaurant', unlocked: false },
  { id: 'book_blitzer', category: 'speed', title: 'Book Blitzer', desc: 'Finish a book within 24 hours of starting it', howToEarn: 'finishing a book within 24 hours of starting it.', icon: 'flash', unlocked: false },

  { id: 'consistent_reader', category: 'streaks', title: '3 Month Streak', desc: 'Read at least 1 book for 3 months', howToEarn: 'finishing at least one book for 3 months in a row.', icon: 'calendar', total: 3, unlocked: false },
  { id: 'half_year_streak', category: 'streaks', title: '6 Month Streak', desc: 'Read at least 1 book for 6 months', howToEarn: 'finishing at least one book for 6 months in a row.', icon: 'calendar-number', total: 6, unlocked: false },
  { id: 'year_streak', category: 'streaks', title: 'The Yearly Cycle', desc: 'Read at least 1 book for 12 months', howToEarn: 'finishing at least one book every month for an entire year!', icon: 'infinite', total: 12, unlocked: false },
  
  { id: 'double_feature', category: 'variety', title: 'Double Feature', desc: 'Reading 2 books at once', howToEarn: 'having two different books in your "Reading" list.', icon: 'albums', total: 2, unlocked: false },
  { id: 'author_bestie', category: 'variety', title: "Author's Bestie", desc: 'Read 5 books by one author', howToEarn: 'reading 5 books by the same author.', icon: 'people', total: 5, unlocked: false },
  { id: 'the_polymath', category: 'variety', title: 'The Polymath', desc: 'Read 5 different authors', howToEarn: 'reading books from 5 different authors.', icon: 'globe', total: 5, unlocked: false },
  { id: 'variety_king', category: 'variety', title: 'Variety King', desc: 'Read 10 different authors', howToEarn: 'reading books from 10 different authors.', icon: 'color-palette', total: 10, unlocked: false },
  { id: 'genre_explorer', category: 'variety', title: 'Genre Explorer', desc: 'Read books from 3 different genres', howToEarn: 'reading books from 3 different genres.', icon: 'compass', total: 3, unlocked: false },
  { id: 'renaissance_reader', category: 'variety', title: 'Renaissance Reader', desc: 'Read books from 5 different genres', howToEarn: 'reading books from 5 different genres.', icon: 'telescope', total: 5, unlocked: false },
  { id: 'multitasker_reader', category: 'variety', title: 'Multitasker', desc: 'Read 3 books simultaneously', howToEarn: 'having 3 books in your "Reading" list at the same time.', icon: 'layers', total: 3, unlocked: false },
  { id: 'eclectic_reader', category: 'variety', title: 'Eclectic Reader', desc: 'Read books from 10 different genres', howToEarn: 'reading books from 10 different genres.', icon: 'compass', total: 10, unlocked: false },
  
  { id: 'first_opinion', category: 'critics', title: 'First Opinion', desc: 'Rate your first book', howToEarn: 'sharing your very first book rating.', icon: 'chatbox-ellipses', unlocked: false },
  { id: 'the_critic', category: 'critics', title: 'The Critic', desc: 'Rate 10 books', howToEarn: 'sharing your opinion and rating 10 books.', icon: 'star-half', total: 10, unlocked: false },
  { id: 'super_critic', category: 'critics', title: 'Super Critic', desc: 'Rate 25 books', howToEarn: 'sharing your opinion and rating 25 books.', icon: 'star', total: 25, unlocked: false },
  { id: 'masterpiece_finder', category: 'critics', title: 'Masterpiece Finder', desc: 'Give a book a 5-star rating', howToEarn: 'giving a book a perfect 5-star rating.', icon: 'heart', unlocked: false },
  { id: 'honest_critic', category: 'critics', title: 'Honest Critic', desc: 'Give a book a 1-star rating', howToEarn: 'giving a book an honest 1-star rating.', icon: 'thumbs-down', unlocked: false },
  { id: 'balanced_critic', category: 'critics', title: 'Balanced Critic', desc: 'Rate books 1, 3, and 5 stars', howToEarn: 'rating books with 1, 3, and 5 stars.', icon: 'shapes', total: 3, unlocked: false },
  { id: 'generous_soul', category: 'critics', title: 'Generous Soul', desc: 'Give 5 books a perfect 5-star rating', howToEarn: 'giving 5 books a 5-star rating.', icon: 'happy', total: 5, unlocked: false },

  { id: 'indecisive', category: 'collection', title: 'Indecisive', desc: 'Have 3 books in To-Read', howToEarn: 'having 3 books in your To-Read list.', icon: 'help-circle', total: 3, unlocked: false },
  { id: 'cant_make_up_mind', category: 'collection', title: "Can't Make Up Your Mind", desc: 'Have 5 books in To-Read', howToEarn: 'having 5 books in your To-Read list.', icon: 'git-branch', total: 5, unlocked: false },
  { id: 'the_archivist', category: 'collection', title: 'The Archivist', desc: 'Have 10 books in To-Read', howToEarn: 'having 10 books in your To-Read list.', icon: 'layers', total: 10, unlocked: false },
  { id: 'book_collector', category: 'collection', title: 'Book Collector', desc: 'Add 50 books to your library', howToEarn: 'having 50 books in your library in total.', icon: 'library', total: 50, unlocked: false },
  { id: 'perfect_balance', category: 'collection', title: 'Perfect Balance', desc: 'Have exactly 5 books in To-Read, Reading, and Read', howToEarn: 'having exactly 5 books in To-Read, 5 in Reading, and 5 in Read lists at the same time.', icon: 'grid', unlocked: false },
];

function TrophyItem({ item, colors, onDetails, isGodModeUser }: { item: Achievement, colors: any, onDetails: (a: Achievement) => void, isGodModeUser: boolean }) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (item.unlocked) {
      glowOpacity.value = withRepeat(withSequence(withTiming(0.8, { duration: 1500 }), withTiming(0.4, { duration: 1500 })), -1, true);
    }
  }, [item.unlocked, glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: item.unlocked ? glowOpacity.value : 0,
  }));

  const handlePress = () => {
    scale.value = withSequence(withTiming(1.2, { duration: 100 }), withTiming(1, { duration: 100 }));
    onDetails(item);
  };

  const showRealInfo = item.unlocked || isGodModeUser;
  const IconComponent = item.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress} style={styles.trophyItem}>
      <Animated.View style={[
        styles.trophyCircle, 
        { backgroundColor: item.unlocked ? colors.primary : 'rgba(0,0,0,0.05)', borderColor: item.unlocked ? colors.primary : colors.border, shadowColor: colors.primary },
        animatedStyle
      ]}>
        <IconComponent name={showRealInfo ? item.icon : 'help-outline'} size={28} color={item.unlocked ? '#FFF' : colors.textLight} />
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
      <Text style={[styles.trophyLabel, { color: colors.textDark }]} numberOfLines={1}>{showRealInfo ? item.title : '???'}</Text>
      {!item.unlocked && item.total && (
        <Text style={[styles.progressCount, { color: colors.textLight }]}>{item.progress || 0} / {item.total}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function AchievementsScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const isGodModeUser = user?.email === 'millerjoel7597@gmail.com';

  const [unlockedData, setUnlockedData] = useState<{[key: string]: any}>({});
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  const backfillAchievements = useCallback(async () => {
    if (!user) return;
    try {
      const qAll = query(collection(db, 'books'), where('userId', '==', user.uid));
      const allSnap = await getDocs(qAll);
      
      const qNotesAll = query(collection(db, 'notes'), where('userId', '==', user.uid));
      const notesSnap = await getDocs(qNotesAll);
      const notesCountVal = notesSnap.size;

      const allBooks: Book[] = allSnap.docs.map(doc => {
        const d = doc.data();
        let date = d.dateFinished || d.dateAdded;
        let processedDate = new Date();
        if (date?.toDate) processedDate = date.toDate();
        else if (date?.seconds) processedDate = new Date(date.seconds * 1000);
        else processedDate = new Date(date);
        return { ...d, id: doc.id, processedDate } as Book;
      }).sort((a, b) => a.processedDate.getTime() - b.processedDate.getTime());

      const readBooks = allBooks.filter(b => b.status === 'read');
      const toReadCount = allBooks.filter(b => b.status === 'toread').length;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const readingGoal = userDoc.data()?.readingGoal || 0;
      const toUnlock: {[key: string]: {date: Timestamp, count?: number}} = {};

      // Basics
      if (readBooks.length >= 1) toUnlock['first_step'] = { date: Timestamp.fromDate(readBooks[0].processedDate) };
      if (allBooks.length >= 3) {
        const thirdBook = [...allBooks].sort((a, b) => (a.dateAdded?.seconds || 0) - (b.dateAdded?.seconds || 0))[2];
        toUnlock['quick_start'] = { date: thirdBook?.dateAdded || Timestamp.now() };
      }
      
      const userData = userDoc.data();
      const startYear = userData?.dateAdded?.toDate ? userData.dateAdded.toDate().getFullYear() : 2025;
      const yearlyCounts: any = {};
      readBooks.forEach(b => { const y = b.processedDate.getFullYear(); yearlyCounts[y] = (yearlyCounts[y] || 0) + 1; });
      let finisherStreak = 0; let lastGoalReachedDate = null;
      const currentYear = new Date().getFullYear();
      Object.entries(yearlyCounts).forEach(([year, count]: any) => {
        const y = parseInt(year);
        const goal = userData?.readingGoals?.[year] ?? (year === startYear.toString() ? (readingGoal || 15) : 15);
        if (goal > 0 && count >= goal) { finisherStreak++; const lastBook = readBooks.filter(b => b.processedDate.getFullYear() === y).pop(); if (lastBook) lastGoalReachedDate = Timestamp.fromDate(lastBook.processedDate); }
      });
      if (finisherStreak > 0 && lastGoalReachedDate) toUnlock['the_finisher'] = { date: lastGoalReachedDate, count: finisherStreak };

      // Collection
      if (toReadCount >= 10) toUnlock['the_archivist'] = { date: Timestamp.now() };
      if (toReadCount >= 5) toUnlock['cant_make_up_mind'] = { date: Timestamp.now() };
      if (toReadCount >= 3) toUnlock['indecisive'] = { date: Timestamp.now() };

      // Variety
      const uniqueAuthors = new Set(); let polyAuthorCount = 0;
      for (const b of readBooks) {
        if (!uniqueAuthors.has(b.author)) {
          uniqueAuthors.add(b.author); polyAuthorCount++;
          if (polyAuthorCount === 5) toUnlock['the_polymath'] = { date: Timestamp.fromDate(b.processedDate) };
          if (polyAuthorCount === 10) toUnlock['variety_king'] = { date: Timestamp.fromDate(b.processedDate) };
        }
      }

      // Critics
      const ratedBooks = readBooks.filter(b => (b.rating && b.rating > 0) || b.review === 'good' || b.review === 'bad');
      if (ratedBooks.length >= 1) toUnlock['first_opinion'] = { date: Timestamp.fromDate(ratedBooks[0].processedDate) };
      if (ratedBooks.length >= 10) toUnlock['the_critic'] = { date: Timestamp.fromDate(ratedBooks[9].processedDate) };
      if (ratedBooks.length >= 25) toUnlock['super_critic'] = { date: Timestamp.fromDate(ratedBooks[24].processedDate) };

      // Authors
      const authorGroups: any = {};
      readBooks.forEach(b => { authorGroups[b.author] = (authorGroups[b.author] || 0) + 1; if (authorGroups[b.author] === 5) toUnlock['author_bestie'] = { date: Timestamp.fromDate(b.processedDate) }; });

      // Habits & Speed
      readBooks.forEach(b => {
        const day = b.processedDate.getDay();
        const hour = b.processedDate.getHours();
        if (day === 0 || day === 6) toUnlock['weekend_warrior'] = { date: Timestamp.fromDate(b.processedDate) };
        if (hour < 9) toUnlock['morning_reader'] = { date: Timestamp.fromDate(b.processedDate) };
        if (hour >= 12 && hour < 14) toUnlock['lunch_reader'] = { date: Timestamp.fromDate(b.processedDate) };
        if (hour >= 0 && hour < 4) toUnlock['midnight_reader'] = { date: Timestamp.fromDate(b.processedDate) };
      });

      allBooks.forEach(b => {
        let addedDate = b.processedDate;
        const dAdded = b.dateAdded;
        if (dAdded) {
          if (dAdded.toDate) addedDate = dAdded.toDate();
          else if (dAdded.seconds) addedDate = new Date(dAdded.seconds * 1000);
          else addedDate = new Date(dAdded);
        }
        const addedHour = addedDate.getHours();
        if (addedHour >= 23 || addedHour < 4) {
          toUnlock['night_owl'] = { date: Timestamp.fromDate(addedDate) };
        }
      });

      const monthlyGroups: any = {};
      readBooks.forEach(b => { const key = `${b.processedDate.getFullYear()}-${b.processedDate.getMonth()}`; if (!monthlyGroups[key]) monthlyGroups[key] = []; monthlyGroups[key].push(b); });
      Object.values(monthlyGroups).forEach((books: any) => { const mCount = books.length; const lastBookDate = Timestamp.fromDate(books[books.length - 1].processedDate); if (mCount >= 30) toUnlock['speed_god'] = { date: lastBookDate }; if (mCount >= 10) toUnlock['speed_demon'] = { date: lastBookDate }; if (mCount >= 5) toUnlock['speedy_reader'] = { date: lastBookDate }; });

      if (allBooks.some(b => b.status === 'reading')) {
        const readingBook = allBooks.find(b => b.status === 'reading');
        toUnlock['page_turner'] = { date: readingBook?.dateStartedReading || readingBook?.dateAdded || Timestamp.now() };
      }
      if (new Set(allBooks.filter(b => b.status === 'reading').map(b => b.author)).size >= 2) toUnlock['double_feature'] = { date: Timestamp.now() };
      if (user.email === 'millerjoel7597@gmail.com') toUnlock['godmode'] = { date: Timestamp.now() };

      // Notes backfill
      if (notesCountVal >= 1) {
        let earliestNoteDate = Timestamp.now();
        notesSnap.forEach(dDoc => {
          const cDate = dDoc.data().createdAt || dDoc.data().updatedAt;
          if (cDate) {
            let noteDate = cDate;
            if (cDate.toDate) noteDate = cDate.toDate(); else noteDate = new Date(cDate);
            if (noteDate.getTime() < earliestNoteDate.toDate().getTime()) {
              earliestNoteDate = Timestamp.fromDate(noteDate);
            }
          }
        });
        toUnlock['first_note'] = { date: earliestNoteDate };
      }
      if (notesCountVal >= 10) {
        toUnlock['deep_thinker'] = { date: Timestamp.now() };
      }

      // Genre explorer backfill
      const genresSet = new Set(readBooks.map(b => b.genre?.trim()?.toLowerCase()).filter((g): g is string => !!g));
      if (genresSet.size >= 3) {
        const foundGenres = new Set();
        let date3 = Timestamp.now();
        for (const b of readBooks) {
          if (b.genre) {
            const gNorm = b.genre.trim().toLowerCase();
            if (!foundGenres.has(gNorm)) {
              foundGenres.add(gNorm);
              if (foundGenres.size === 3) {
                date3 = Timestamp.fromDate(b.processedDate);
                break;
              }
            }
          }
        }
        toUnlock['genre_explorer'] = { date: date3 };
      }
      if (genresSet.size >= 5) {
        const foundGenres = new Set();
        let date5 = Timestamp.now();
        for (const b of readBooks) {
          if (b.genre) {
            const gNorm = b.genre.trim().toLowerCase();
            if (!foundGenres.has(gNorm)) {
              foundGenres.add(gNorm);
              if (foundGenres.size === 5) {
                date5 = Timestamp.fromDate(b.processedDate);
                break;
              }
            }
          }
        }
        toUnlock['renaissance_reader'] = { date: date5 };
      }
      if (genresSet.size >= 10) {
        const foundGenres = new Set();
        let date10 = Timestamp.now();
        for (const b of readBooks) {
          if (b.genre) {
            const gNorm = b.genre.trim().toLowerCase();
            if (!foundGenres.has(gNorm)) {
              foundGenres.add(gNorm);
              if (foundGenres.size === 10) {
                date10 = Timestamp.fromDate(b.processedDate);
                break;
              }
            }
          }
        }
        toUnlock['eclectic_reader'] = { date: date10 };
      }

      // Critics masterpieces / lower stars backfill
      const fiveStarBooks = readBooks.filter(b => b.rating === 5);
      if (fiveStarBooks.length >= 1) {
        toUnlock['masterpiece_finder'] = { date: Timestamp.fromDate(fiveStarBooks[0].processedDate) };
      }
      const oneStarBooks = readBooks.filter(b => b.rating === 1);
      if (oneStarBooks.length >= 1) {
        toUnlock['honest_critic'] = { date: Timestamp.fromDate(oneStarBooks[0].processedDate) };
      }

      // Reading pace backfill
      const devouredBooks = readBooks.filter(b => {
        if (!b.dateStartedReading || !b.dateFinished) return false;
        let start = b.dateStartedReading;
        let finish = b.dateFinished;
        if (start.toDate) start = start.toDate(); else start = new Date(start);
        if (finish.toDate) finish = finish.toDate(); else finish = new Date(finish);
        const diffMs = finish.getTime() - start.getTime();
        return diffMs > 0 && diffMs <= 48 * 60 * 60 * 1000;
      });
      if (devouredBooks.length >= 1) {
        toUnlock['book_devourer'] = { date: Timestamp.fromDate(devouredBooks[0].processedDate) };
      }

      const blitzedBooks = readBooks.filter(b => {
        if (!b.dateStartedReading || !b.dateFinished) return false;
        let start = b.dateStartedReading;
        let finish = b.dateFinished;
        if (start.toDate) start = start.toDate(); else start = new Date(start);
        if (finish.toDate) finish = finish.toDate(); else finish = new Date(finish);
        const diffMs = finish.getTime() - start.getTime();
        return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
      });
      if (blitzedBooks.length >= 1) {
        toUnlock['book_blitzer'] = { date: Timestamp.fromDate(blitzedBooks[0].processedDate) };
      }

      // Goal Setter backfill
      if (readingGoal > 0) {
        toUnlock['goal_setter'] = { date: Timestamp.now() };
      }

      // Book Collector backfill
      if (allBooks.length >= 50) {
        const sortedByAdded = [...allBooks].sort((a, b) => {
          const da = a.dateAdded?.toDate ? a.dateAdded.toDate() : new Date(a.dateAdded);
          const dbVal = b.dateAdded?.toDate ? b.dateAdded.toDate() : new Date(b.dateAdded);
          return da.getTime() - dbVal.getTime();
        });
        toUnlock['book_collector'] = { date: sortedByAdded[49].dateAdded || Timestamp.now() };
      }

      // Multitasker backfill
      const readingBooksCount = allBooks.filter(b => b.status === 'reading').length;
      if (readingBooksCount >= 3) {
        toUnlock['multitasker_reader'] = { date: Timestamp.now() };
      }

      // Perfect Balance backfill
      const toReadCountBackfill = allBooks.filter(b => b.status === 'toread').length;
      const readingCountBackfill = allBooks.filter(b => b.status === 'reading').length;
      const readCountBackfill = readBooks.length;
      if (toReadCountBackfill === 5 && readingCountBackfill === 5 && readCountBackfill === 5) {
        toUnlock['perfect_balance'] = { date: Timestamp.now() };
      }

      // Milestone Tiers backfill
      if (readBooks.length >= 10) toUnlock['bronze_milestone'] = { date: Timestamp.fromDate(readBooks[9].processedDate) };
      if (readBooks.length >= 25) toUnlock['silver_milestone'] = { date: Timestamp.fromDate(readBooks[24].processedDate) };
      if (readBooks.length >= 50) toUnlock['gold_milestone'] = { date: Timestamp.fromDate(readBooks[49].processedDate) };
      if (readBooks.length >= 100) toUnlock['diamond_milestone'] = { date: Timestamp.fromDate(readBooks[99].processedDate) };

      // Notes Depth backfill
      if (notesCountVal >= 5) toUnlock['annotator_notes'] = { date: Timestamp.now() };
      if (notesCountVal >= 25) toUnlock['chronicler'] = { date: Timestamp.now() };

      // Balanced Critic backfill
      const ratings = readBooks.map(b => b.rating).filter((r): r is number => typeof r === 'number' && r > 0);
      const has1 = ratings.includes(1);
      const has3 = ratings.includes(3);
      const has5 = ratings.includes(5);
      if (has1 && has3 && has5) {
        toUnlock['balanced_critic'] = { date: Timestamp.now() };
      }

      // Generous Soul backfill
      const fiveStarBooksBackfill = readBooks.filter(b => b.rating === 5);
      if (fiveStarBooksBackfill.length >= 5) {
        toUnlock['generous_soul'] = { date: Timestamp.fromDate(fiveStarBooksBackfill[4].processedDate) };
      }

      // Streaks logic for backfill
      const monthMap: any = {};
      readBooks.forEach(b => {
        monthMap[`${b.processedDate.getFullYear()}-${b.processedDate.getMonth()}`] = b.processedDate;
      });
      let streak = 0;
      let checkDate = new Date();
      if (!monthMap[`${checkDate.getFullYear()}-${checkDate.getMonth()}`]) checkDate.setMonth(checkDate.getMonth() - 1);
      
      let lastIncludedDate = null;
      for (let i = 0; i < 36; i++) {
        const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
        if (monthMap[key]) {
          streak++;
          lastIncludedDate = monthMap[key];
          if (streak === 3) toUnlock['consistent_reader'] = { date: Timestamp.fromDate(lastIncludedDate) };
          if (streak === 6) toUnlock['half_year_streak'] = { date: Timestamp.fromDate(lastIncludedDate) };
          if (streak === 12) toUnlock['year_streak'] = { date: Timestamp.fromDate(lastIncludedDate) };
          checkDate.setMonth(checkDate.getMonth() - 1);
        } else break;
      }

      const allDefIds = ACHIEVEMENT_DEFINITIONS.map(d => d.id);
      for (const id of allDefIds) {
        const achRef = doc(db, 'users', user.uid, 'achievements', id);
        const achSnap = await getDoc(achRef);
        if (toUnlock[id]) {
          const data = toUnlock[id];
          if (!achSnap.exists()) await setDoc(achRef, { unlocked: true, unlockedAt: data.date, count: data.count || 1 });
        }
      }
    } catch (e) { console.error("Backfill error:", e); }
  }, [user]);

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
      const books = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Book));
      setAllBooks(books);
    });
    const qNotes = query(collection(db, 'notes'), where('userId', '==', user.uid));
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      setNotesCount(snapshot.size);
    });
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const startYear = data.dateAdded?.toDate ? data.dateAdded.toDate().getFullYear() : 2025;
        const currentYearStr = new Date().getFullYear().toString();
        const goalForYear = data.readingGoals?.[currentYearStr] ?? (currentYearStr === startYear.toString() ? (data.readingGoal ?? 0) : 0);
        setYearlyGoal(goalForYear);
      }
      setLoading(false);
    });
    return () => { unsubscribeAch(); unsubscribeBooks(); unsubscribeNotes(); unsubscribeUser(); };
  }, [user, backfillAchievements]);

  const liveProgress = useMemo(() => {
    const prog: any = {};
    const readBooks = allBooks.filter(b => b.status === 'read');
    const toReadCount = allBooks.filter(b => b.status === 'toread').length;

    prog['quick_start'] = Math.min(allBooks.length, 3);
    prog['indecisive'] = Math.min(toReadCount, 3);
    prog['cant_make_up_mind'] = Math.min(toReadCount, 5);
    prog['the_archivist'] = Math.min(toReadCount, 10);
    prog['double_feature'] = Math.min(new Set(allBooks.filter(b => b.status === 'reading').map(b => b.author)).size, 2);
    const uniqueAuthorsCount = new Set(readBooks.map(b => b.author)).size;
    prog['the_polymath'] = Math.min(uniqueAuthorsCount, 5);
    prog['variety_king'] = Math.min(uniqueAuthorsCount, 10);

    const ratedCount = readBooks.filter(b => (b.rating && b.rating > 0) || b.review === 'good' || b.review === 'bad').length;
    prog['first_opinion'] = Math.min(ratedCount, 1);
    prog['the_critic'] = Math.min(ratedCount, 10);
    prog['super_critic'] = Math.min(ratedCount, 25);

    const now = new Date();
    const thisMonthCount = readBooks.filter(b => {
      let d = b.dateFinished || b.dateAdded;
      if (d?.toDate) d = d.toDate();
      else if (d?.seconds) d = new Date(d.seconds * 1000);
      else d = new Date(d);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    prog['speedy_reader'] = Math.min(thisMonthCount, 5);
    prog['speed_demon'] = Math.min(thisMonthCount, 10);
    prog['speed_god'] = Math.min(thisMonthCount, 30);

    const authorCounts: any = {};
    readBooks.forEach(b => authorCounts[b.author] = (authorCounts[b.author] || 0) + 1);
    prog['author_bestie'] = Math.min(Math.max(...(Object.values(authorCounts) as number[]), 0), 5);

    const monthMap: any = {};
    readBooks.forEach(b => {
      let d = b.dateFinished || b.dateAdded;
      if (d?.toDate) d = d.toDate();
      else if (d?.seconds) d = new Date(d.seconds * 1000);
      else d = new Date(d);
      monthMap[`${d.getFullYear()}-${d.getMonth()}`] = true;
    });
    let streak = 0;
    let checkDate = new Date();
    if (!monthMap[`${checkDate.getFullYear()}-${checkDate.getMonth()}`]) checkDate.setMonth(checkDate.getMonth() - 1);
    for (let i = 0; i < 36; i++) {
      if (monthMap[`${checkDate.getFullYear()}-${checkDate.getMonth()}`]) {
        streak++;
        checkDate.setMonth(checkDate.getMonth() - 1);
      } else break;
    }
    prog['consistent_reader'] = Math.min(streak, 3);
    prog['half_year_streak'] = Math.min(streak, 6);
    prog['year_streak'] = Math.min(streak, 12);

    // new achievements
    prog['first_note'] = Math.min(notesCount, 1);
    prog['deep_thinker'] = Math.min(notesCount, 10);
    prog['goal_setter'] = yearlyGoal > 0 ? 1 : 0;

    const uniqueGenresCount = new Set(readBooks.map(b => b.genre?.trim()?.toLowerCase()).filter((g): g is string => !!g)).size;
    prog['genre_explorer'] = Math.min(uniqueGenresCount, 3);
    prog['renaissance_reader'] = Math.min(uniqueGenresCount, 5);
    prog['multitasker_reader'] = Math.min(allBooks.filter(b => b.status === 'reading').length, 3);

    const hasFiveStar = readBooks.some(b => b.rating === 5) ? 1 : 0;
    prog['masterpiece_finder'] = hasFiveStar;
    const hasOneStar = readBooks.some(b => b.rating === 1) ? 1 : 0;
    prog['honest_critic'] = hasOneStar;

    const isDevoured = (b: Book) => {
      if (!b.dateStartedReading || !b.dateFinished) return false;
      let start = b.dateStartedReading;
      let finish = b.dateFinished;
      if (start.toDate) start = start.toDate(); else start = new Date(start);
      if (finish.toDate) finish = finish.toDate(); else finish = new Date(finish);
      const diffMs = finish.getTime() - start.getTime();
      return diffMs > 0 && diffMs <= 48 * 60 * 60 * 1000;
    };
    prog['book_devourer'] = readBooks.some(isDevoured) ? 1 : 0;

    const isBlitzed = (b: Book) => {
      if (!b.dateStartedReading || !b.dateFinished) return false;
      let start = b.dateStartedReading;
      let finish = b.dateFinished;
      if (start.toDate) start = start.toDate(); else start = new Date(start);
      if (finish.toDate) finish = finish.toDate(); else finish = new Date(finish);
      const diffMs = finish.getTime() - start.getTime();
      return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
    };
    prog['book_blitzer'] = readBooks.some(isBlitzed) ? 1 : 0;
    prog['book_collector'] = Math.min(allBooks.length, 50);

    const rCount = readBooks.length;
    prog['bronze_milestone'] = Math.min(rCount, 10);
    prog['silver_milestone'] = Math.min(rCount, 25);
    prog['gold_milestone'] = Math.min(rCount, 50);
    prog['diamond_milestone'] = Math.min(rCount, 100);

    const hasLunch = readBooks.some(b => {
      let d = b.dateFinished || b.dateAdded;
      if (!d) return false;
      if (d.toDate) d = d.toDate(); else if (d.seconds) d = new Date(d.seconds * 1000); else d = new Date(d);
      const hour = d.getHours();
      return hour >= 12 && hour < 14;
    });
    prog['lunch_reader'] = hasLunch ? 1 : 0;

    const hasMidnight = readBooks.some(b => {
      let d = b.dateFinished || b.dateAdded;
      if (!d) return false;
      if (d.toDate) d = d.toDate(); else if (d.seconds) d = new Date(d.seconds * 1000); else d = new Date(d);
      const hour = d.getHours();
      return hour >= 0 && hour < 4;
    });
    prog['midnight_reader'] = hasMidnight ? 1 : 0;

    // new note progress
    prog['annotator_notes'] = Math.min(notesCount, 5);
    prog['chronicler'] = Math.min(notesCount, 25);

    // new rating progress
    const currentRatings = readBooks.map(b => b.rating).filter((r): r is number => typeof r === 'number' && r > 0);
    const hasCurrent1 = currentRatings.includes(1);
    const hasCurrent3 = currentRatings.includes(3);
    const hasCurrent5 = currentRatings.includes(5);
    let criticScore = 0;
    if (hasCurrent1) criticScore++;
    if (hasCurrent3) criticScore++;
    if (hasCurrent5) criticScore++;
    prog['balanced_critic'] = criticScore;

    const fiveStarCount = readBooks.filter(b => b.rating === 5).length;
    prog['generous_soul'] = Math.min(fiveStarCount, 5);

    // perfect balance
    const toReadC = allBooks.filter(b => b.status === 'toread').length;
    const readingC = allBooks.filter(b => b.status === 'reading').length;
    const readC = readBooks.length;
    prog['perfect_balance'] = (toReadC === 5 && readingC === 5 && readC === 5) ? 1 : 0;

    // eclectic reader
    prog['eclectic_reader'] = Math.min(uniqueGenresCount, 10);

    return prog;
  }, [allBooks, notesCount, yearlyGoal]);

  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS
    .filter(def => def.id !== 'godmode' || isGodModeUser)
    .map(def => ({
      ...def,
      unlocked: !!unlockedData[def.id],
      unlockedAt: unlockedData[def.id]?.unlockedAt,
      progress: def.id === 'the_finisher' ? unlockedData[def.id]?.count : liveProgress[def.id],
    }));

  const openDetails = (ach: Achievement) => { setSelectedAch(ach); setShowModal(true); };

  if (loading) return <View style={[styles.container, { backgroundColor: 'transparent', justifyContent: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <DoodleBackground colors={colors} />
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
                <TrophyItem key={item.id} item={item} colors={colors} onDetails={openDetails} isGodModeUser={isGodModeUser} />
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
                <View style={[styles.modalIconContainer, { backgroundColor: colors.primaryLight }]}>
                  {(() => {
                    const IconComp = selectedAch.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
                    return <IconComp name={(selectedAch.unlocked || isGodModeUser) ? selectedAch.icon : 'lock-closed'} size={48} color={colors.primary} />;
                  })()}
                </View>
                <Text style={[styles.unlockedDate, { color: colors.textLight }]}>{!selectedAch.unlocked ? 'LOCKED' : (selectedAch.unlockedAt?.toDate ? selectedAch.unlockedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'UNLOCKED')}</Text>
                <Text style={[styles.modalTitle, { color: colors.textDark }]}>{(selectedAch.unlocked || isGodModeUser) ? (<>You earned <Text style={{ color: colors.primary }}>{selectedAch.title}</Text></>) : (<Text style={{ color: colors.textLight }}>Mystery Trophy</Text>)}</Text>
                <Text style={[styles.modalHow, { color: colors.textLight }]}>{selectedAch.unlocked ? `by ${selectedAch.howToEarn}` : (isGodModeUser ? `God Mode Hint: ${selectedAch.howToEarn}` : "Keep reading to unlock this achievement!")}</Text>
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
  scrollContent: { padding: 16, paddingBottom: 180 },
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