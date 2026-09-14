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
import { triggerLocalNotification } from '../../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function toValidDate(date: any): Date {
  if (!date) return new Date();
  if (date instanceof Date) return isNaN(date.getTime()) ? new Date() : date;
  if (date.toDate && typeof date.toDate === 'function') {
    try {
      const d = date.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {}
  }
  if (typeof date.seconds === 'number') {
    const d = new Date(date.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  try {
    const d = new Date(date);
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return new Date();
}

function getBookDate(b: any): Date {
  if (!b) return new Date();
  if (b.processedDate) return toValidDate(b.processedDate);
  return toValidDate(b.dateFinished || b.dateAdded);
}

function getSeason(month: number): number {
  if (typeof month !== 'number' || isNaN(month)) return 0;
  if (month === 11 || month === 0 || month === 1) return 0; // Winter: Dec, Jan, Feb
  if (month >= 2 && month <= 4) return 1; // Spring: Mar, Apr, May
  if (month >= 5 && month <= 7) return 2; // Summer: Jun, Jul, Aug
  return 3; // Autumn: Sep, Oct, Nov
}

function getWeekendKey(d?: Date | null): string | null {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  const day = d.getDay();
  if (day === 6) { // Saturday
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  } else if (day === 0) { // Sunday (same weekend as previous Saturday)
    const sat = new Date(d);
    sat.setDate(d.getDate() - 1);
    return `${sat.getFullYear()}-${sat.getMonth()}-${sat.getDate()}`;
  }
  return null;
}

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
  status: 'read' | 'reading' | 'toread' | 'dnf';
  dateAdded: any;
  dateFinished?: any;
  dateStartedReading?: any;
  dateDnf?: any;
  rating?: number;
  review?: string;
  genre?: string;
  format?: 'physical' | 'ebook' | 'audiobook';
  series?: string;
  seriesOrder?: number;
  processedDate: Date;
}

const CATEGORIES = [
  { id: 'basics', title: 'THE JOURNEY BEGINS' },
  { id: 'habits', title: 'DAILY RITUALS' },
  { id: 'speed', title: 'SPEED & PACING' },
  { id: 'streaks', title: 'CONSISTENCY MATTERS' },
  { id: 'formats', title: 'FORMATS & MEDIUMS' },
  { id: 'series', title: 'SERIES & SAGAS' },
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
  { id: 'vault_keeper', category: 'basics', title: 'Vault Keeper', desc: 'Set up a PIN or Biometric lock', howToEarn: 'protecting your library by enabling a PIN or Biometrics in Settings.', icon: 'lock-closed-outline', unlocked: false },
  { id: 'proud_reader', category: 'basics', title: 'Proud Reader', desc: 'Share your Reading Wrapped card', howToEarn: 'sharing your Reading Wrapped card with friends.', icon: 'share-social-outline', unlocked: false },
  
  { id: 'weekend_warrior', category: 'habits', title: 'Weekend Warrior', desc: 'Finish a book on the weekend', howToEarn: 'completing a book on a Saturday or Sunday.', icon: 'cafe', unlocked: false },
  { id: 'morning_reader', category: 'habits', title: 'Early Bird', desc: 'Finish a book before 9 AM', howToEarn: 'completing a book early in the morning.', icon: 'alarm', unlocked: false },
  { id: 'night_owl', category: 'habits', title: 'Night Owl', desc: 'Add a book after 11 PM', howToEarn: 'starting a new book late at night.', icon: 'owl', iconFamily: 'MaterialCommunityIcons', unlocked: false },
  { id: 'first_note', category: 'habits', title: 'Draftsman', desc: 'Write your first reading note', howToEarn: 'writing your first reading note.', icon: 'pencil-outline', unlocked: false },
  { id: 'annotator_notes', category: 'habits', title: 'Annotator', desc: 'Write 5 reading notes', howToEarn: 'writing 5 reading notes in total.', icon: 'document-text', total: 5, unlocked: false },
  { id: 'deep_thinker', category: 'habits', title: 'Deep Thinker', desc: 'Write 10 notes across your books', howToEarn: 'writing 10 reading notes.', icon: 'bulb-outline', total: 10, unlocked: false },
  { id: 'chronicler', category: 'habits', title: 'The Chronicler', desc: 'Write 25 notes in total', howToEarn: 'writing 25 reading notes in total.', icon: 'journal', total: 25, unlocked: false },
  { id: 'the_philosopher', category: 'habits', title: 'The Philosopher', desc: 'Write 50 notes in total', howToEarn: 'writing 50 notes across your reading journey.', icon: 'bulb-outline', total: 50, unlocked: false },
  { id: 'marginalia_master', category: 'habits', title: 'Marginalia Master', desc: 'Write 5+ notes on a single book', howToEarn: 'writing 5 reading notes linked to the same book.', icon: 'create-outline', total: 5, unlocked: false },
  { id: 'librarians_index', category: 'habits', title: "Librarian's Index", desc: 'Write notes across 5 different books', howToEarn: 'adding notes to at least 5 distinct books in your library.', icon: 'library-outline', total: 5, unlocked: false },
  { id: 'goal_setter', category: 'habits', title: 'Goal Setter', desc: 'Set your annual reading goal', howToEarn: 'updating your annual reading goal in settings.', icon: 'flag', unlocked: false },
  { id: 'lunch_reader', category: 'habits', title: 'Lunch Break', desc: 'Finish a book between 12 PM and 2 PM', howToEarn: 'finishing a book during lunch hours.', icon: 'pizza', unlocked: false },
  { id: 'midnight_reader', category: 'habits', title: 'Midnight Marathon', desc: 'Finish a book between 12 AM and 4 AM', howToEarn: 'finishing a book late at night.', icon: 'moon', unlocked: false },
  { id: 'new_year_pages', category: 'habits', title: 'New Year, New Pages', desc: 'Finish a book in January', howToEarn: 'finishing a book during the month of January.', icon: 'sparkles-outline', unlocked: false },
  { id: 'four_seasons', category: 'habits', title: 'Four Seasons', desc: 'Finish a book in every season', howToEarn: 'finishing at least one book in Winter, Spring, Summer, and Autumn.', icon: 'planet-outline', total: 4, unlocked: false },
  { id: 'holiday_reader', category: 'habits', title: 'Holiday Reader', desc: 'Finish a book during holiday week', howToEarn: 'finishing a book between December 24th and December 31st.', icon: 'gift-outline', unlocked: false },

  { id: 'speedy_reader', category: 'speed', title: 'Speedy Reader', desc: 'Finish 5 books in a month', howToEarn: 'finishing 5 books in a single month.', icon: 'walk', total: 5, unlocked: false },
  { id: 'speed_demon', category: 'speed', title: 'Speed Demon', desc: 'Finish 10 books in a month', howToEarn: 'finishing 10 books in a single month.', icon: 'bicycle', total: 10, unlocked: false },
  { id: 'speed_god', category: 'speed', title: 'Speed God', desc: 'Finish 30 books in a month', howToEarn: 'finishing 30 books in a single month! Absolute legend.', icon: 'flame', total: 30, unlocked: false },
  { id: 'book_devourer', category: 'speed', title: 'Book Devourer', desc: 'Finish a book within 48 hours', howToEarn: 'finishing a book within 48 hours of starting it.', icon: 'restaurant', unlocked: false },
  { id: 'book_blitzer', category: 'speed', title: 'Book Blitzer', desc: 'Finish a book within 24 hours', howToEarn: 'finishing a book within 24 hours of starting it.', icon: 'flash', unlocked: false },
  { id: 'slow_burn', category: 'speed', title: 'Slow Burn', desc: 'Finish a book that took 90+ days', howToEarn: 'completing a book that took at least 90 days from start to finish.', icon: 'hourglass-outline', unlocked: false },
  { id: 'double_feature_day', category: 'speed', title: 'Double Feature Day', desc: 'Finish 2 books on the same day', howToEarn: 'marking two books as finished on the same calendar day.', icon: 'flash-outline', total: 2, unlocked: false },
  { id: 'weekend_binge', category: 'speed', title: 'Weekend Binge', desc: 'Finish 2 books over a weekend', howToEarn: 'finishing 2 books over a Saturday and Sunday.', icon: 'beer-outline', total: 2, unlocked: false },

  { id: 'consistent_reader', category: 'streaks', title: '3 Month Streak', desc: 'Read at least 1 book for 3 months', howToEarn: 'finishing at least one book for 3 months in a row.', icon: 'calendar', total: 3, unlocked: false },
  { id: 'half_year_streak', category: 'streaks', title: '6 Month Streak', desc: 'Read at least 1 book for 6 months', howToEarn: 'finishing at least one book for 6 months in a row.', icon: 'calendar-number', total: 6, unlocked: false },
  { id: 'year_streak', category: 'streaks', title: 'The Yearly Cycle', desc: 'Read at least 1 book for 12 months', howToEarn: 'finishing at least one book every month for an entire year!', icon: 'infinite', total: 12, unlocked: false },
  
  { id: 'format_trifecta', category: 'formats', title: 'Format Trifecta', desc: 'Read physical, e-book, & audio', howToEarn: 'reading at least one physical book, one e-book, and one audiobook.', icon: 'layers-outline', total: 3, unlocked: false },
  { id: 'audio_aficionado', category: 'formats', title: 'Audio Aficionado', desc: 'Complete 5 audiobooks', howToEarn: 'listening to and finishing 5 audiobooks.', icon: 'headset-outline', total: 5, unlocked: false },
  { id: 'digital_nomad', category: 'formats', title: 'Digital Nomad', desc: 'Complete 10 e-books', howToEarn: 'reading and finishing 10 e-books.', icon: 'tablet-portrait-outline', total: 10, unlocked: false },
  { id: 'paper_purist', category: 'formats', title: 'Paper Purist', desc: 'Complete 10 physical books', howToEarn: 'reading and finishing 10 physical books.', icon: 'book-outline', total: 10, unlocked: false },

  { id: 'series_starter', category: 'series', title: 'Series Starter', desc: 'Start Book 1 of any series', howToEarn: 'adding or reading a book marked as Book 1 in a series.', icon: 'bookmark-outline', unlocked: false },
  { id: 'trilogy_conqueror', category: 'series', title: 'Trilogy Conqueror', desc: 'Finish Books 1, 2, and 3 of a series', howToEarn: 'reading books 1, 2, and 3 of any single series.', icon: 'albums-outline', total: 3, unlocked: false },
  { id: 'saga_finisher', category: 'series', title: 'Saga Finisher', desc: 'Finish 5 books in a single series', howToEarn: 'reading at least 5 books in the same series.', icon: 'shield-checkmark-outline', total: 5, unlocked: false },

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
  { id: 'full_spectrum', category: 'critics', title: 'Full Spectrum', desc: 'Rate books in all 5 star tiers', howToEarn: 'giving ratings for 1, 2, 3, 4, and 5 stars across your library.', icon: 'color-wand-outline', total: 5, unlocked: false },
  { id: 'the_golden_mean', category: 'critics', title: 'The Golden Mean', desc: 'Rate 5 books 3 stars', howToEarn: 'giving 5 books a solid 3-star rating.', icon: 'thumbs-up-outline', total: 5, unlocked: false },
  { id: 'five_star_fanatic', category: 'critics', title: 'Five-Star Fanatic', desc: 'Rate 10 books 5 stars', howToEarn: 'giving 10 books a 5-star rating.', icon: 'star-outline', total: 10, unlocked: false },

  { id: 'indecisive', category: 'collection', title: 'Indecisive', desc: 'Have 3 books in To-Read', howToEarn: 'having 3 books in your To-Read list.', icon: 'help-circle', total: 3, unlocked: false },
  { id: 'cant_make_up_mind', category: 'collection', title: "Can't Make Up Your Mind", desc: 'Have 5 books in To-Read', howToEarn: 'having 5 books in your To-Read list.', icon: 'git-branch', total: 5, unlocked: false },
  { id: 'the_archivist', category: 'collection', title: 'The Archivist', desc: 'Have 10 books in To-Read', howToEarn: 'having 10 books in your To-Read list.', icon: 'layers', total: 10, unlocked: false },
  { id: 'book_collector', category: 'collection', title: 'Book Collector', desc: 'Add 50 books to your library', howToEarn: 'having 50 books in your library in total.', icon: 'library', total: 50, unlocked: false },
  { id: 'perfect_balance', category: 'collection', title: 'Perfect Balance', desc: 'Have exactly 5 books in To-Read, Reading, and Read', howToEarn: 'having exactly 5 books in To-Read, 5 in Reading, and 5 in Read lists at the same time.', icon: 'grid', unlocked: false },
  { id: 'lifes_too_short', category: 'collection', title: "Life's Too Short", desc: 'Mark a book as DNF', howToEarn: "marking a book as DNF — honoring your time and reading taste!", icon: 'close-circle-outline', unlocked: false },
  { id: 'discerning_taste', category: 'collection', title: 'Discerning Taste', desc: 'Mark 3 books as DNF', howToEarn: 'marking 3 books as DNF.', icon: 'hand-left-outline', total: 3, unlocked: false },
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
  const [notesList, setNotesList] = useState<any[]>([]);
  const [userDocData, setUserDocData] = useState<any>(null);
  const [hasLocalPinState, setHasLocalPinState] = useState(false);
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

  useEffect(() => {
    const checkLocalPin = async () => {
      try {
        const isSecureAvailable = Platform.OS !== 'web' && await SecureStore.isAvailableAsync();
        const pin = isSecureAvailable ? await SecureStore.getItemAsync('app_passlock_pin') : await AsyncStorage.getItem('app_passlock_pin_fallback');
        if (pin) setHasLocalPinState(true);
      } catch {}
    };
    checkLocalPin();
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
        const processedDate = toValidDate(d.dateFinished || d.dateAdded);
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

      // App Power-User backfill
      let hasLocalPin = false;
      try {
        const isSecureAvailable = Platform.OS !== 'web' && await SecureStore.isAvailableAsync();
        const pin = isSecureAvailable ? await SecureStore.getItemAsync('app_passlock_pin') : await AsyncStorage.getItem('app_passlock_pin_fallback');
        if (pin) hasLocalPin = true;
      } catch {}
      if (userData?.appLockPin || userData?.biometricEnabled || userData?.hasPin || hasLocalPin) {
        toUnlock['vault_keeper'] = { date: Timestamp.now() };
      }
      if (userData?.sharedCard || userData?.wrappedShared) {
        toUnlock['proud_reader'] = { date: Timestamp.now() };
      }

      // Formats & Mediums backfill
      const hasPhysical = readBooks.find(b => b.format === 'physical' || !b.format);
      const hasEbook = readBooks.find(b => b.format === 'ebook');
      const hasAudio = readBooks.find(b => b.format === 'audiobook');
      if (hasPhysical && hasEbook && hasAudio) {
        const latestFormatDate = Math.max(hasPhysical.processedDate.getTime(), hasEbook.processedDate.getTime(), hasAudio.processedDate.getTime());
        toUnlock['format_trifecta'] = { date: Timestamp.fromDate(new Date(latestFormatDate)) };
      }
      const audioBooks = readBooks.filter(b => b.format === 'audiobook');
      if (audioBooks.length >= 5) {
        toUnlock['audio_aficionado'] = { date: Timestamp.fromDate(audioBooks[4].processedDate) };
      }
      const ebooks = readBooks.filter(b => b.format === 'ebook');
      if (ebooks.length >= 10) {
        toUnlock['digital_nomad'] = { date: Timestamp.fromDate(ebooks[9].processedDate) };
      }
      const physicalBooks = readBooks.filter(b => b.format === 'physical' || !b.format);
      if (physicalBooks.length >= 10) {
        toUnlock['paper_purist'] = { date: Timestamp.fromDate(physicalBooks[9].processedDate) };
      }

      // Series & Sagas backfill
      const seriesStarterBook = allBooks.find(b => b.series && b.series.trim() !== '' && b.seriesOrder === 1 && (b.status === 'reading' || b.status === 'read'));
      if (seriesStarterBook) {
        toUnlock['series_starter'] = { date: Timestamp.fromDate(seriesStarterBook.processedDate) };
      }
      const seriesOrdersMap: { [seriesName: string]: { orders: Set<number>, latestDate: Date } } = {};
      const seriesCountsMap: { [seriesName: string]: Book[] } = {};
      for (const b of readBooks) {
        if (b.series && b.series.trim()) {
          const sName = b.series.trim().toLowerCase();
          if (!seriesOrdersMap[sName]) seriesOrdersMap[sName] = { orders: new Set(), latestDate: b.processedDate };
          if (b.seriesOrder) seriesOrdersMap[sName].orders.add(b.seriesOrder);
          seriesOrdersMap[sName].latestDate = b.processedDate;

          if (!seriesCountsMap[sName]) seriesCountsMap[sName] = [];
          seriesCountsMap[sName].push(b);

          if (seriesOrdersMap[sName].orders.has(1) && seriesOrdersMap[sName].orders.has(2) && seriesOrdersMap[sName].orders.has(3) && !toUnlock['trilogy_conqueror']) {
            toUnlock['trilogy_conqueror'] = { date: Timestamp.fromDate(b.processedDate) };
          }
          if (seriesCountsMap[sName].length === 5 && !toUnlock['saga_finisher']) {
            toUnlock['saga_finisher'] = { date: Timestamp.fromDate(b.processedDate) };
          }
        }
      }

      // Notes Depth backfill
      const notesPerBook: { [bookId: string]: number } = {};
      const distinctBooksWithNotes = new Set<string>();
      notesSnap.forEach(dDoc => {
        const d = dDoc.data();
        if (d.bookId) {
          distinctBooksWithNotes.add(d.bookId);
          notesPerBook[d.bookId] = (notesPerBook[d.bookId] || 0) + 1;
          if (notesPerBook[d.bookId] === 5 && !toUnlock['marginalia_master']) {
            const cDate = d.createdAt || d.updatedAt;
            let dVal = Timestamp.now();
            if (cDate?.toDate) dVal = Timestamp.fromDate(cDate.toDate());
            else if (cDate?.seconds) dVal = Timestamp.fromDate(new Date(cDate.seconds * 1000));
            else if (cDate) dVal = Timestamp.fromDate(new Date(cDate));
            toUnlock['marginalia_master'] = { date: dVal };
          }
        }
      });
      if (distinctBooksWithNotes.size >= 5 && !toUnlock['librarians_index']) {
        toUnlock['librarians_index'] = { date: Timestamp.now() };
      }
      if (notesCountVal >= 50 && !toUnlock['the_philosopher']) {
        toUnlock['the_philosopher'] = { date: Timestamp.now() };
      }

      // DNF backfill
      const dnfBooks = allBooks.filter(b => b.status === 'dnf');
      if (dnfBooks.length >= 1) {
        toUnlock['lifes_too_short'] = { date: Timestamp.fromDate(dnfBooks[0].processedDate) };
      }
      if (dnfBooks.length >= 3) {
        toUnlock['discerning_taste'] = { date: Timestamp.fromDate(dnfBooks[2].processedDate) };
      }

      // Slow Burn backfill
      const slowBurnBook = readBooks.find(b => {
        if (!b.dateStartedReading || !b.dateFinished) return false;
        let start = b.dateStartedReading;
        let finish = b.dateFinished;
        if (start.toDate) start = start.toDate(); else start = new Date(start);
        if (finish.toDate) finish = finish.toDate(); else finish = new Date(finish);
        const diffMs = finish.getTime() - start.getTime();
        return diffMs >= 90 * 24 * 60 * 60 * 1000;
      });
      if (slowBurnBook) {
        toUnlock['slow_burn'] = { date: Timestamp.fromDate(slowBurnBook.processedDate) };
      }

      // Double Feature Day & Weekend Binge backfill
      const dayFinishedMap: { [dayKey: string]: Book[] } = {};
      const weekendFinishedMap: { [wKey: string]: Book[] } = {};
      readBooks.forEach(b => {
        const d = b.processedDate;
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!dayFinishedMap[dayKey]) dayFinishedMap[dayKey] = [];
        dayFinishedMap[dayKey].push(b);
        if (dayFinishedMap[dayKey].length === 2 && !toUnlock['double_feature_day']) {
          toUnlock['double_feature_day'] = { date: Timestamp.fromDate(d) };
        }

        const wKey = getWeekendKey(d);
        if (wKey) {
          if (!weekendFinishedMap[wKey]) weekendFinishedMap[wKey] = [];
          weekendFinishedMap[wKey].push(b);
          if (weekendFinishedMap[wKey].length === 2 && !toUnlock['weekend_binge']) {
            toUnlock['weekend_binge'] = { date: Timestamp.fromDate(d) };
          }
        }
      });

      // Seasons & Calendar backfill
      const janBook = readBooks.find(b => b.processedDate.getMonth() === 0);
      if (janBook) {
        toUnlock['new_year_pages'] = { date: Timestamp.fromDate(janBook.processedDate) };
      }

      const seasonsSet = new Set<number>();
      for (const b of readBooks) {
        seasonsSet.add(getSeason(b.processedDate.getMonth()));
        if (seasonsSet.size === 4 && !toUnlock['four_seasons']) {
          toUnlock['four_seasons'] = { date: Timestamp.fromDate(b.processedDate) };
        }
      }

      const holidayBook = readBooks.find(b => {
        const m = b.processedDate.getMonth();
        const d = b.processedDate.getDate();
        return m === 11 && d >= 24 && d <= 31;
      });
      if (holidayBook) {
        toUnlock['holiday_reader'] = { date: Timestamp.fromDate(holidayBook.processedDate) };
      }

      // Rating Nuances backfill
      const allRatings = readBooks.map(b => b.rating).filter((r): r is number => typeof r === 'number' && r >= 1 && r <= 5);
      const starSet = new Set(allRatings);
      if ([1, 2, 3, 4, 5].every(s => starSet.has(s)) && !toUnlock['full_spectrum']) {
        toUnlock['full_spectrum'] = { date: Timestamp.now() };
      }

      const threeStarBooks = readBooks.filter(b => b.rating === 3);
      if (threeStarBooks.length >= 5) {
        toUnlock['the_golden_mean'] = { date: Timestamp.fromDate(threeStarBooks[4].processedDate) };
      }

      const tenFiveStarBooks = readBooks.filter(b => b.rating === 5);
      if (tenFiveStarBooks.length >= 10) {
        toUnlock['five_star_fanatic'] = { date: Timestamp.fromDate(tenFiveStarBooks[9].processedDate) };
      }

      // Streaks logic for backfill (Forward-chronological streak calculation)
      // Map each month with read books, saving the latest finished date in that month
      const monthBookMap = new Map<number, Date>();
      readBooks.forEach(b => {
        const y = b.processedDate.getFullYear();
        const m = b.processedDate.getMonth();
        const monthNum = y * 12 + m;
        const existing = monthBookMap.get(monthNum);
        if (!existing || b.processedDate.getTime() > existing.getTime()) {
          monthBookMap.set(monthNum, b.processedDate);
        }
      });

      // Sort months chronologically forward
      const sortedMonths = Array.from(monthBookMap.keys()).sort((a, b) => a - b);

      let runningStreak = 0;
      let prevMonthNum: number | null = null;

      for (const mNum of sortedMonths) {
        if (prevMonthNum !== null && mNum === prevMonthNum + 1) {
          runningStreak++;
        } else {
          runningStreak = 1;
        }
        prevMonthNum = mNum;

        const achievementDate = monthBookMap.get(mNum)!;

        // 3-Month Streak achieved on the 3rd consecutive month
        if (runningStreak >= 3 && !toUnlock['consistent_reader']) {
          toUnlock['consistent_reader'] = { date: Timestamp.fromDate(achievementDate) };
        }
        // 6-Month Streak achieved on the 6th consecutive month
        if (runningStreak >= 6 && !toUnlock['half_year_streak']) {
          toUnlock['half_year_streak'] = { date: Timestamp.fromDate(achievementDate) };
        }
        // 12-Month Streak achieved on the 12th consecutive month
        if (runningStreak >= 12 && !toUnlock['year_streak']) {
          toUnlock['year_streak'] = { date: Timestamp.fromDate(achievementDate) };
        }
      }

      const allDefIds = ACHIEVEMENT_DEFINITIONS.map(d => d.id);
      for (const id of allDefIds) {
        const achRef = doc(db, 'users', user.uid, 'achievements', id);
        const achSnap = await getDoc(achRef);
        if (toUnlock[id]) {
          const data = toUnlock[id];
          if (!achSnap.exists()) {
            await setDoc(achRef, { unlocked: true, unlockedAt: data.date, count: data.count || 1 });
            const definition = ACHIEVEMENT_DEFINITIONS.find(d => d.id === id);
            if (definition) {
              triggerLocalNotification('🏆 Trophy Unlocked!', `You unlocked: ${definition.title}`);
            }
          } else {
            // Ensure existing streak achievements reflect the actual achievement completion month
            if (['consistent_reader', 'half_year_streak', 'year_streak'].includes(id)) {
              const currentUnlockedAt = achSnap.data()?.unlockedAt;
              const currentTime = currentUnlockedAt?.toDate ? currentUnlockedAt.toDate().getTime() : 0;
              const newTime = data.date.toDate().getTime();
              if (currentTime !== newTime) {
                await setDoc(achRef, { unlockedAt: data.date }, { merge: true });
              }
            }
          }
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
      const books = snapshot.docs.map(doc => {
        const d = doc.data();
        const processedDate = toValidDate(d.dateFinished || d.dateAdded);
        return { ...d, id: doc.id, processedDate } as Book;
      }).sort((a, b) => a.processedDate.getTime() - b.processedDate.getTime());
      setAllBooks(books);
    });
    const qNotes = query(collection(db, 'notes'), where('userId', '==', user.uid));
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      setNotesCount(snapshot.size);
      setNotesList(snapshot.docs.map(d => d.data()));
    });
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserDocData(data);
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
      const d = getBookDate(b);
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
      const d = getBookDate(b);
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
      const hour = getBookDate(b).getHours();
      return hour >= 12 && hour < 14;
    });
    prog['lunch_reader'] = hasLunch ? 1 : 0;

    const hasMidnight = readBooks.some(b => {
      const hour = getBookDate(b).getHours();
      return hour >= 0 && hour < 4;
    });
    prog['midnight_reader'] = hasMidnight ? 1 : 0;

    // notes depth progress
    prog['annotator_notes'] = Math.min(notesCount, 5);
    prog['chronicler'] = Math.min(notesCount, 25);
    prog['the_philosopher'] = Math.min(notesCount, 50);

    const notesPerBookLive: { [bookId: string]: number } = {};
    const distinctBooksLive = new Set<string>();
    notesList.forEach(n => {
      if (n.bookId) {
        distinctBooksLive.add(n.bookId);
        notesPerBookLive[n.bookId] = (notesPerBookLive[n.bookId] || 0) + 1;
      }
    });
    prog['marginalia_master'] = Math.min(Math.max(...Object.values(notesPerBookLive), 0), 5);
    prog['librarians_index'] = Math.min(distinctBooksLive.size, 5);

    // rating progress
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
    prog['five_star_fanatic'] = Math.min(fiveStarCount, 10);
    prog['the_golden_mean'] = Math.min(readBooks.filter(b => b.rating === 3).length, 5);
    const distinctStarsLive = new Set(readBooks.map(b => b.rating).filter((r): r is number => typeof r === 'number' && r >= 1 && r <= 5)).size;
    prog['full_spectrum'] = Math.min(distinctStarsLive, 5);

    // Formats & Mediums progress
    const formatTypes = new Set(readBooks.map(b => b.format || 'physical').filter(f => f === 'physical' || f === 'ebook' || f === 'audiobook')).size;
    prog['format_trifecta'] = Math.min(formatTypes, 3);
    prog['audio_aficionado'] = Math.min(readBooks.filter(b => b.format === 'audiobook').length, 5);
    prog['digital_nomad'] = Math.min(readBooks.filter(b => b.format === 'ebook').length, 10);
    prog['paper_purist'] = Math.min(readBooks.filter(b => b.format === 'physical' || !b.format).length, 10);

    // Series & Sagas progress
    prog['series_starter'] = allBooks.some(b => b.series && b.series.trim() !== '' && b.seriesOrder === 1 && (b.status === 'reading' || b.status === 'read')) ? 1 : 0;
    let maxTrilogy = 0;
    const seriesLiveOrders: { [seriesName: string]: Set<number> } = {};
    const seriesLiveCounts: { [seriesName: string]: number } = {};
    for (const b of readBooks) {
      if (b.series && b.series.trim()) {
        const sName = b.series.trim().toLowerCase();
        seriesLiveCounts[sName] = (seriesLiveCounts[sName] || 0) + 1;
        if (!seriesLiveOrders[sName]) seriesLiveOrders[sName] = new Set();
        if (b.seriesOrder) seriesLiveOrders[sName].add(b.seriesOrder);
        const count123 = [1, 2, 3].filter(o => seriesLiveOrders[sName].has(o)).length;
        if (count123 > maxTrilogy) maxTrilogy = count123;
      }
    }
    prog['trilogy_conqueror'] = maxTrilogy;
    prog['saga_finisher'] = Math.min(Math.max(...Object.values(seriesLiveCounts), 0), 5);

    // Realistic Habits (DNF) progress
    const dnfCountLive = allBooks.filter(b => b.status === 'dnf').length;
    prog['lifes_too_short'] = dnfCountLive >= 1 ? 1 : 0;
    prog['discerning_taste'] = Math.min(dnfCountLive, 3);

    // Pacing & Speed
    const hasSlowBurnLive = readBooks.some(b => {
      if (!b.dateStartedReading || !b.dateFinished) return false;
      const start = toValidDate(b.dateStartedReading);
      const finish = toValidDate(b.dateFinished);
      const diffMs = finish.getTime() - start.getTime();
      return diffMs >= 90 * 24 * 60 * 60 * 1000;
    });
    prog['slow_burn'] = hasSlowBurnLive ? 1 : 0;

    const dayCountsLive: { [dayKey: string]: number } = {};
    const weekendCountsLive: { [wKey: string]: number } = {};
    readBooks.forEach(b => {
      const d = getBookDate(b);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      dayCountsLive[dayKey] = (dayCountsLive[dayKey] || 0) + 1;

      const wKey = getWeekendKey(d);
      if (wKey) {
        weekendCountsLive[wKey] = (weekendCountsLive[wKey] || 0) + 1;
      }
    });
    prog['double_feature_day'] = Math.min(Math.max(...Object.values(dayCountsLive), 0), 2);
    prog['weekend_binge'] = Math.min(Math.max(...Object.values(weekendCountsLive), 0), 2);

    // Seasons & Calendar
    prog['new_year_pages'] = readBooks.some(b => getBookDate(b).getMonth() === 0) ? 1 : 0;
    prog['four_seasons'] = Math.min(new Set(readBooks.map(b => getSeason(getBookDate(b).getMonth()))).size, 4);
    prog['holiday_reader'] = readBooks.some(b => {
      const d = getBookDate(b);
      const m = d.getMonth();
      const day = d.getDate();
      return m === 11 && day >= 24 && day <= 31;
    }) ? 1 : 0;

    // App power-user
    prog['vault_keeper'] = (userDocData?.appLockPin || userDocData?.biometricEnabled || userDocData?.hasPin || hasLocalPinState) ? 1 : 0;
    prog['proud_reader'] = (unlockedData['proud_reader'] || userDocData?.sharedCard) ? 1 : 0;

    // perfect balance
    const toReadC = allBooks.filter(b => b.status === 'toread').length;
    const readingC = allBooks.filter(b => b.status === 'reading').length;
    const readC = readBooks.length;
    prog['perfect_balance'] = (toReadC === 5 && readingC === 5 && readC === 5) ? 1 : 0;

    // eclectic reader
    prog['eclectic_reader'] = Math.min(uniqueGenresCount, 10);

    return prog;
  }, [allBooks, notesCount, notesList, yearlyGoal, userDocData, hasLocalPinState, unlockedData]);

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