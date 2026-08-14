import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where, setDoc, Timestamp } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Platform, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat, withSequence, FadeInDown, ZoomIn, Easing, SharedValue } from 'react-native-reanimated';
import { COLORS, darkColors } from '../../constants/colors';
import { auth, db } from '../../firebaseConfig';
import { DoodleBackground } from '../../components/DoodleBackground';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useTheme } from '../../context/ThemeContext';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- WRAPPED ANIMATION SUB-COMPONENTS ---

function ScatteredIcon({ index }: { index: number }) {
  const x = useSharedValue(SCREEN_WIDTH / 2);
  const y = useSharedValue(SCREEN_HEIGHT / 2);
  const scale = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    const targetX = (Math.random() * SCREEN_WIDTH) - 20;
    const targetY = (Math.random() * SCREEN_HEIGHT) - 20;
    const delay = index * 40; 
    
    const timeout = setTimeout(() => {
      x.value = withSpring(targetX, { damping: 12 });
      y.value = withSpring(targetY, { damping: 12 });
      scale.value = withSpring(Math.random() * 0.8 + 0.5);
      rotate.value = withSpring(Math.random() * 360);
    }, delay);
    return () => clearTimeout(timeout);
  }, [index, rotate, scale, x, y]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` }
    ],
    opacity: 0.6,
  }));

  const icons = ['book', 'library', 'bookmarks', 'document-text'];
  const iconName = icons[index % icons.length] as any;

  return (
    <Animated.View style={style}>
      <Ionicons name={iconName} size={40} color="white" />
    </Animated.View>
  );
}

function ScatterBooks({ count }: { count: number }) {
  const numIcons = Math.min(count, 40);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: numIcons }).map((_, i) => (
        <ScatteredIcon key={i} index={i} />
      ))}
    </View>
  );
}

function ScrambleText({ text, style }: { text: string, style?: any }) {
  const [display, setDisplay] = useState('');
  
  useEffect(() => {
    if (!text || text === 'NONE') {
      setDisplay('NONE');
      return;
    }
    
    let iterations = 0;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()';
    const interval = setInterval(() => {
      setDisplay(text.split('').map((letter, index) => {
        if (index < iterations || letter === ' ') return text[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      
      iterations += 1/3;
      if (iterations >= text.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>;
}



// --- SUB-COMPONENT FOR CONFETTI ---
function ConfettiPiece({ index }: { index: number }) {
  const x = useSharedValue(Math.random() * SCREEN_WIDTH);
  const y = useSharedValue(-20);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const colors = ['#bc6c25', '#dda15e', '#f59e0b', '#92400e', '#432818', '#99582a', '#bc4749', '#603808'];
  const color = colors[index % colors.length];

  useEffect(() => {
    const duration = 2500 + Math.random() * 3000;
    y.value = withTiming(SCREEN_HEIGHT + 20, { duration });
    rotate.value = withTiming(Math.random() * 1000, { duration });
    opacity.value = withTiming(0, { duration });
  }, [opacity, rotate, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
    backgroundColor: color,
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: index % 2 === 0 ? 5 : 2,
    zIndex: 100,
  }));

  return <Animated.View style={animatedStyle} pointerEvents="none" />;
}

function StoryProgressDot({ step, activeStep, progressSharedValue }: { step: number, activeStep: number, progressSharedValue: SharedValue<number> }) {
  const isCompleted = activeStep > step;
  const isActive = activeStep === step;

  const animatedStyle = useAnimatedStyle(() => {
    if (isCompleted) {
      return { width: '100%', opacity: 1 };
    }
    if (isActive) {
      return { width: `${progressSharedValue.value * 100}%`, opacity: 0.9 };
    }
    return { width: '0%', opacity: 0.3 };
  });

  return (
    <View style={styles.progressDotContainer}>
      <Animated.View style={[styles.progressDotFill, animatedStyle]} />
    </View>
  );
}

function TickingCounter({ target, style }: { target: number, style?: any }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    let start = 0;
    const duration = 1500;
    const stepTime = Math.max(Math.floor(duration / target), 25);
    const timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [target]);
  return <Text style={style}>{count}</Text>;
}

function BookStackGraphic({ count }: { count: number }) {
  const visibleCount = Math.min(count, 5);
  return (
    <View style={styles.bookStackContainer}>
      {Array.from({ length: visibleCount }).map((_, i) => (
        <Animated.View 
          key={i} 
          entering={FadeInDown.delay(200 * i).springify()} 
          style={[
            styles.bookStackItem, 
            { 
              backgroundColor: i === 0 ? '#adff2f' : i === 1 ? '#00f5d4' : i === 2 ? '#ff007f' : i === 3 ? '#ff9f1c' : '#7b2cbf', 
              transform: [{ rotate: `${(i % 2 === 0 ? 4 : -4) * i}deg` }],
              bottom: i * 20 
            }
          ]} 
        />
      ))}
    </View>
  );
}
const MONTHS_UPPER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function FlippingCalendarMonth({ targetMonth }: { targetMonth: string }) {
  const [displayMonth, setDisplayMonth] = useState('JAN');
  const safeTarget = targetMonth ? targetMonth.toUpperCase() : 'JAN';
  const targetIndex = MONTHS_UPPER.indexOf(safeTarget) !== -1 ? MONTHS_UPPER.indexOf(safeTarget) : 0;

  useEffect(() => {
    let currentIdx = 0;
    const totalFlips = targetIndex;
    let flipsCount = 0;
    let timeoutId: any;

    if (totalFlips === 0) {
      setDisplayMonth(safeTarget);
      return;
    }

    const flip = () => {
      currentIdx = (currentIdx + 1) % 12;
      setDisplayMonth(MONTHS_UPPER[currentIdx]);
      flipsCount++;

      if (flipsCount < totalFlips) {
        // Decelerate: delay gets longer as flipsCount approaches totalFlips
        const delay = 80 + Math.pow(flipsCount / totalFlips, 2) * 250;
        timeoutId = setTimeout(flip, delay);
      } else {
        setDisplayMonth(safeTarget);
      }
    };

    timeoutId = setTimeout(flip, 80);
    return () => clearTimeout(timeoutId);
  }, [targetIndex, safeTarget]);

  return (
    <Animated.Text style={styles.calendarMonth}>
      {displayMonth}
    </Animated.Text>
  );
}

// --- SUB-COMPONENT FOR ANIMATED BARS ---
function PollBar({ index, count, relativeValue, theme }: { index: number, count: number, relativeValue: number, theme: string }) {
  const colors = theme === 'dark' ? darkColors : COLORS;
  const barWidth = useSharedValue(0);
  
  useFocusEffect(useCallback(() => {
    barWidth.value = 0;
    barWidth.value = withTiming(relativeValue, { duration: 1000 });
  }, [barWidth, relativeValue]));

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
    backgroundColor: theme === 'dark' ? colors.primary : colors.primary,
    opacity: barWidth.value > 0 ? 0.3 + barWidth.value * 0.7 : 0,
  }));

  return (
    <View style={[styles.barContainer, { backgroundColor: colors.border + '40' }]}>
      <Animated.View style={[styles.monthBar, animatedStyle]} />
    </View>
  );
}

export default function StatsScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const [user, setUser] = useState<User | null>(auth.currentUser);

  const [loading, setLoading] = useState(true);
  const [booksReadThisYear, setBooksReadThisYear] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<{month: string, count: number}[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'All'>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<(number | 'All')[]>([new Date().getFullYear()]);

  // Wrapped Story State: 0=Hidden, 1=Books, 2=Author, 3=Month, 4=Genre, 5=Summary
  const [wrappedStep, setWrappedStep] = useState(0);
  
  const [topMonth, setTopMonth] = useState('');
  const [topAuthor, setTopAuthor] = useState('');
  const [topGenre, setTopGenre] = useState('');
  const [topGenres, setTopGenres] = useState<{name: string, count: number}[]>([]);
  const [personality, setPersonality] = useState({ title: '', icon: '', desc: '' });

  const [trophiesCount, setTrophiesCount] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  const progressValue = useSharedValue(0);
  const storyProgress = useSharedValue(0);
  
  const [hasSeenWrapped, setHasSeenWrapped] = useState(false);
  const [formatStats, setFormatStats] = useState({ physical: 0, ebook: 0, audiobook: 0 });

  const checkAndUnlockAchievement = useCallback(async (achievementId: string) => {
    if (!user) return;
    try {
      const achRef = doc(db, 'users', user.uid, 'achievements', achievementId);
      const achSnap = await getDoc(achRef);
      if (!achSnap.exists()) {
        await setDoc(achRef, { unlocked: true, unlockedAt: Timestamp.now() });
        Toast.show({ type: 'success', text1: '🏆 Trophy Unlocked!', text2: `You reached your reading goal!`, visibilityTime: 4000 });
      }
    } catch (e) { console.error("Achievement error:", e); }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const startYear = data.dateAdded?.toDate ? data.dateAdded.toDate().getFullYear() : 2025;
        const currentYearStr = selectedYear === 'All' ? new Date().getFullYear().toString() : selectedYear.toString();
        const goalForYear = data.readingGoals?.[currentYearStr] ?? (currentYearStr === startYear.toString() ? (data.readingGoal ?? 0) : 0);
        setYearlyGoal(goalForYear);

        setHasSeenWrapped(data.wrappedSeen?.[currentYearStr] ?? false);

        const currentYear = new Date().getFullYear();
        const years: (number | 'All')[] = ['All'];
        for (let y = currentYear; y >= Math.min(startYear, 2025); y--) {
          years.push(y);
        }
        setAvailableYears(years);
      }
    });

    const q = query(collection(db, 'books'), where('userId', '==', user.uid), where('status', '==', 'read'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthCounts = new Array(12).fill(0);
      const authors: {[key: string]: number} = {};
      const genres: {[key: string]: number} = {};
      const allReadBooks: Date[] = [];
      let physicalCount = 0;
      let ebookCount = 0;
      let audiobookCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        let finishDate: Date | null = null;
        const rawDate = data.dateFinished || data.dateAdded;
        if (rawDate) {
          if (typeof rawDate.toDate === 'function') finishDate = rawDate.toDate();
          else if (rawDate.seconds) finishDate = new Date(rawDate.seconds * 1000);
          else { const d = new Date(rawDate); if (!isNaN(d.getTime())) finishDate = d; }
        }

        if (finishDate) {
          allReadBooks.push(finishDate);
          if (selectedYear === 'All' || finishDate.getFullYear() === selectedYear) {
            count++;
            monthCounts[finishDate.getMonth()]++;
            if (data.author) authors[data.author] = (authors[data.author] || 0) + 1;
            
            const fmt = data.format || 'physical';
            if (fmt === 'physical') physicalCount++;
            else if (fmt === 'ebook') ebookCount++;
            else if (fmt === 'audiobook') audiobookCount++;

            if (data.genre) {
              const normalizedGenre = data.genre.charAt(0).toUpperCase() + data.genre.slice(1).toLowerCase();
              genres[normalizedGenre] = (genres[normalizedGenre] || 0) + 1;
            }
          }
        }
      });

      setBooksReadThisYear(count);
      setMonthlyStats(months.map((m, i) => ({ month: m, count: monthCounts[i] })));
      
      if (yearlyGoal > 0 && count >= yearlyGoal && selectedYear === new Date().getFullYear()) {
        checkAndUnlockAchievement('the_finisher');
      }

      const maxMonthIdx = monthCounts.indexOf(Math.max(...monthCounts));
      setTopMonth(count > 0 ? months[maxMonthIdx] : 'None');
      
      const topAuthEntry = Object.entries(authors).sort((a,b) => b[1] - a[1])[0];
      setTopAuthor(topAuthEntry ? topAuthEntry[0] : 'None');

      const topGenreEntry = Object.entries(genres).sort((a,b) => b[1] - a[1])[0];
      setTopGenre(topGenreEntry ? topGenreEntry[0] : 'None');
      setTopGenres(Object.entries(genres).sort((a,b) => b[1] - a[1]).map(e => ({ name: e[0], count: e[1] })));

      if (count >= 20) setPersonality({ title: 'The Speed Demon', icon: 'flash', desc: 'You tear through books like they are nothing!' });
      else if (topAuthEntry && topAuthEntry[1] >= 3) setPersonality({ title: 'The Loyal Fan', icon: 'heart', desc: `You really love ${topAuthEntry[0]}'s work!` });
      else if (count >= 10) setPersonality({ title: 'The Scholar', icon: 'school', desc: 'A dedicated reader with a wide range of interests.' });
      else if (count > 0) setPersonality({ title: 'The Casual Voyager', icon: 'boat', desc: 'Enjoying the journey, one page at a time.' });
      else setPersonality({ title: 'The Newcomer', icon: 'egg', desc: 'Your reading adventure is just beginning!' });
      
      // Calculate current streak based on selected year
      const streakBooks = allReadBooks.filter(d => selectedYear === 'All' || d.getFullYear() === selectedYear);
      const monthMap: any = {};
      streakBooks.forEach(d => {
        monthMap[`${d.getFullYear()}-${d.getMonth()}`] = true;
      });

      let streak = 0;
      let checkDate = new Date();
      if (selectedYear !== 'All' && selectedYear !== new Date().getFullYear()) {
        // For a past year, start checking from Dec 31 of that year
        checkDate = new Date(selectedYear, 11, 15);
      }

      if (!monthMap[`${checkDate.getFullYear()}-${checkDate.getMonth()}`]) {
        checkDate.setMonth(checkDate.getMonth() - 1);
      }

      const maxLimit = selectedYear === 'All' ? 36 : 12;
      for (let i = 0; i < maxLimit; i++) {
        if (selectedYear !== 'All' && checkDate.getFullYear() !== selectedYear) {
          break;
        }

        if (monthMap[`${checkDate.getFullYear()}-${checkDate.getMonth()}`]) {
          streak++;
          checkDate.setMonth(checkDate.getMonth() - 1);
        } else {
          break;
        }
      }
      setCurrentStreak(streak);
      setFormatStats({ physical: physicalCount, ebook: ebookCount, audiobook: audiobookCount });

      progressValue.value = withSpring(Math.min(count / (yearlyGoal || 1), 1), { damping: 15 });
      setLoading(false);
    });

    const qAch = query(collection(db, 'users', user.uid, 'achievements'));
    const unsubscribeAch = onSnapshot(qAch, (snap) => {
      setTrophiesCount(snap.size);
    });

    return () => {
      unsubscribe();
      unsubscribeAch();
      unsubscribeUser();
    };
  }, [user, selectedYear, checkAndUnlockAchievement, progressValue, yearlyGoal]);



  const getWrappedBgColor = (step: number) => {
    switch (step) {
      case 1: return '#ff007f'; // Hot Pink
      case 2: return '#7b2cbf'; // Purple
      case 3: return '#00b4d8'; // Cyan
      case 4: return '#ff9f1c'; // Sunrise Orange
      case 5: return '#121212'; // Spotify Black
      default: return colors.primary;
    }
  };

  useEffect(() => {
    if (wrappedStep === 5 && user && selectedYear !== 'All') {
      const currentYearStr = selectedYear.toString();
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        wrappedSeen: {
          [currentYearStr]: true
        }
      }, { merge: true }).catch(err => console.error("Error setting wrappedSeen:", err));
    }
  }, [wrappedStep, user, selectedYear]);

  const handleShareWrapped = async () => {
    try {
      const shareText = `📚 My ${selectedYear} Year in Books on ReadCount!\n` +
        `------------------------------------\n` +
        `📖 Books Finished: ${booksReadThisYear}\n` +
        `✍️ Top Author: ${topAuthor}\n` +
        `🎨 Favorite Genre: ${topGenre}\n` +
        `📅 Peak Month: ${topMonth}\n` +
        `🧠 Reading Persona: ${personality.title}\n\n` +
        `Track your reading goals with ReadCount!`;
      
      await Share.share({
        message: shareText,
        title: `${selectedYear} ReadCount Wrapped`
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error sharing', text2: e.message });
    }
  };

  useEffect(() => {
    if (wrappedStep > 0 && wrappedStep < 5) {
      storyProgress.value = 0;
      storyProgress.value = withTiming(1, { duration: 7000, easing: Easing.linear });
      const timer = setTimeout(() => {
        setWrappedStep(prev => prev + 1);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      storyProgress.value = 0;
    }
  }, [wrappedStep, storyProgress]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const maxCount = Math.max(...monthlyStats.map(s => s.count), 1);
  const now = new Date();
  const isYearEnded = selectedYear === 'All' ? true : (
    selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && now.getMonth() === 11 && now.getDate() === 31)
  );
  
  const isLocked = selectedYear !== 'All' && (!isYearEnded || !hasSeenWrapped);

  const totalFormatCount = formatStats.physical + formatStats.ebook + formatStats.audiobook;
  const formatPercentages = {
    physical: totalFormatCount > 0 ? (formatStats.physical / totalFormatCount) * 100 : 0,
    ebook: totalFormatCount > 0 ? (formatStats.ebook / totalFormatCount) * 100 : 0,
    audiobook: totalFormatCount > 0 ? (formatStats.audiobook / totalFormatCount) * 100 : 0,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <DoodleBackground colors={colors} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Sleek dashboard header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textDark }]}>Reading Stats</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll} contentContainerStyle={styles.yearScrollContent}>
            {availableYears.map((year) => (
              <TouchableOpacity key={year} onPress={() => setSelectedYear(year)} style={[styles.yearChip, { backgroundColor: selectedYear === year ? colors.primary : colors.card, borderColor: selectedYear === year ? colors.primary : colors.border }]}>
                <Text style={[styles.yearText, { color: selectedYear === year ? '#FFF' : colors.textLight }]}>{year === 'All' ? 'LIFETIME' : year}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Goal Card with percentage and trophy badge */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textLight }]}>{selectedYear === 'All' ? 'LIFETIME TOTAL' : `${selectedYear} GOAL`}</Text>
              <View style={styles.goalInfo}>
                <Text style={[styles.goalNumber, { color: colors.primary }]}>{booksReadThisYear}</Text>
                {selectedYear !== 'All' && <Text style={[styles.goalTotal, { color: colors.textLight }]}>/ {yearlyGoal || '—'}</Text>}
              </View>
            </View>
            <View style={[styles.trophyBadge, { backgroundColor: colors.secondary + '15' }]}>
              <Ionicons name="trophy" size={16} color={colors.secondary} />
              <Text style={[styles.trophyBadgeText, { color: colors.secondary }]}>{trophiesCount} Trophies</Text>
            </View>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.border + '40' }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: selectedYear === 'All' ? '100%' : `${Math.min((booksReadThisYear / (yearlyGoal || 1)) * 100, 100)}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textDark }]}>
            {selectedYear === 'All' ? `TOTAL BOOKS FINISHED` : yearlyGoal > 0 ? `${Math.round((booksReadThisYear / (yearlyGoal || 1)) * 100)}% REACHED` : "SET A GOAL IN SETTINGS"}
          </Text>
        </View>

        {isLocked ? (
          <View style={{ width: '100%', gap: 16, marginBottom: 16 }}>
            {!isYearEnded ? (
              /* Coming Soon locked card */
              <View style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.lockedIconBg, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="gift" size={40} color={colors.primary} />
                </View>
                <Text style={[styles.lockedTitle, { color: colors.textDark }]}>Your {selectedYear} Wrapped is on its way!</Text>
                <Text style={[styles.lockedSubtitle, { color: colors.textLight }]}>
                  Your reading persona, top author, top genre, and active streak will be revealed once your Year-in-Review is ready at the end of the year. Keep reading to build your year!
                </Text>
              </View>
            ) : (
              /* Ended but not played yet */
              <View style={{ width: '100%', gap: 16 }}>
                {booksReadThisYear > 0 && (
                  <TouchableOpacity style={[styles.wrappedPromoCard, { backgroundColor: colors.primary }]} onPress={() => setWrappedStep(1)}>
                    <View style={styles.wrappedPromoLeft}>
                      <Ionicons name="sparkles" size={24} color="white" />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.wrappedPromoTitle}>Your {selectedYear} Wrapped is ready!</Text>
                        <Text style={styles.wrappedPromoSubtitle}>Relive your year in reading review →</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="white" />
                  </TouchableOpacity>
                )}

                <View style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={40} color={colors.textLight} style={{ marginBottom: 16 }} />
                  <Text style={[styles.lockedTitle, { color: colors.textDark, fontSize: 18 }]}>Reading Stats Locked</Text>
                  <Text style={[styles.lockedSubtitle, { color: colors.textLight }]}>
                    Watch your {selectedYear} Wrapped story to unlock your detailed reading stats, top author, active streak, and persona!
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          /* UNLOCKED / LIFETIME */
          <View style={{ width: '100%' }}>
            {/* Holographic Replay Option */}
            {booksReadThisYear > 0 && selectedYear !== 'All' && isYearEnded && (
              <TouchableOpacity style={[styles.wrappedPromoCard, { backgroundColor: colors.primary, opacity: 0.85, marginBottom: 20 }]} onPress={() => setWrappedStep(1)}>
                <View style={styles.wrappedPromoLeft}>
                  <Ionicons name="refresh" size={20} color="white" />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.wrappedPromoTitle, { fontSize: 14 }]}>Replay {selectedYear} Wrapped</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="white" />
              </TouchableOpacity>
            )}

            {/* Dashboard 2x2 Stats Grid */}
            <View style={styles.dashboardGrid}>
              <View style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dashboardCardHeader}>
                  <Ionicons name="compass" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.dashboardCardValue, { color: colors.textDark }]} numberOfLines={1}>{topGenre}</Text>
                <Text style={[styles.dashboardCardLabel, { color: colors.textLight }]}>Top Genre</Text>
              </View>

              <View style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dashboardCardHeader}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.dashboardCardValue, { color: colors.textDark }]} numberOfLines={1}>{topAuthor}</Text>
                <Text style={[styles.dashboardCardLabel, { color: colors.textLight }]}>Top Author</Text>
              </View>

              <View style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dashboardCardHeader}>
                  <Ionicons name="flame" size={20} color="#f59e0b" />
                </View>
                <Text style={[styles.dashboardCardValue, { color: colors.textDark }]} numberOfLines={1}>{currentStreak} Months</Text>
                <Text style={[styles.dashboardCardLabel, { color: colors.textLight }]}>Active Streak</Text>
              </View>

              <View style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dashboardCardHeader}>
                  <Ionicons name="library" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.dashboardCardValue, { color: colors.textDark }]} numberOfLines={1}>{booksReadThisYear} Books</Text>
                <Text style={[styles.dashboardCardLabel, { color: colors.textLight }]}>Total Read</Text>
              </View>
            </View>

            {/* Reading Persona Card */}
            {booksReadThisYear > 0 && (
              <View style={[styles.personaBanner, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 24 }]}>
                <View style={[styles.personaIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name={personality.icon as any} size={28} color={colors.primary} />
                </View>
                <View style={styles.personaInfo}>
                  <Text style={[styles.personaHeaderLabel, { color: colors.textLight }]}>Reading Persona</Text>
                  <Text style={[styles.personaTitle, { color: colors.textDark }]}>{personality.title}</Text>
                  <Text style={[styles.personaDesc, { color: colors.textLight }]}>{personality.desc}</Text>
                </View>
              </View>
            )}

            {/* Format Exploration Card */}
            {booksReadThisYear > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 20, marginBottom: 24, elevation: 4 }]}>
                <Text style={[styles.cardTitle, { color: colors.textLight, marginBottom: 16, fontSize: 11, fontWeight: '900', letterSpacing: 1 }]}>READING FORMATS</Text>
                
                {/* Segmented horizontal breakdown bar */}
                <View style={{ height: 16, width: '100%', borderRadius: 8, flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.border + '40', marginBottom: 16 }}>
                  {formatPercentages.physical > 0 && (
                    <View style={{ width: `${formatPercentages.physical}%`, backgroundColor: colors.primary }} />
                  )}
                  {formatPercentages.ebook > 0 && (
                    <View style={{ width: `${formatPercentages.ebook}%`, backgroundColor: colors.secondary }} />
                  )}
                  {formatPercentages.audiobook > 0 && (
                    <View style={{ width: `${formatPercentages.audiobook}%`, backgroundColor: '#f59e0b' }} />
                  )}
                </View>

                {/* Styled legend grid */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginRight: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textDark }}>
                      Physical ({formatStats.physical})
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary, marginRight: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textDark }}>
                      Ebook ({formatStats.ebook})
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b', marginRight: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textDark }}>
                      Audio ({formatStats.audiobook})
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Monthly Activity Progress Bars */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDark }]}>MONTHLY ACTIVITY</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 24, elevation: 4 }]}>
            {monthlyStats.map((item, index) => {
              return (
                <View key={item.month} style={styles.monthRow}>
                  <Text style={[styles.monthName, { color: colors.textDark }]}>{item.month}</Text>
                  <View style={styles.pollTrack}>
                    <PollBar index={index} count={item.count} relativeValue={item.count / maxCount} theme={theme} />
                    <Text style={[styles.monthCount, { color: colors.textDark }]}>{item.count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={wrappedStep > 0} animationType="slide" transparent={false} onRequestClose={() => setWrappedStep(0)}>
        <SafeAreaView style={[styles.wrappedContainer, { backgroundColor: getWrappedBgColor(wrappedStep) }]}>
          
          <View style={styles.progressIndicators}>
            {[1, 2, 3, 4, 5].map(step => (
              <StoryProgressDot key={step} step={step} activeStep={wrappedStep} progressSharedValue={storyProgress} />
            ))}
          </View>

          <TouchableOpacity style={styles.closeWrapped} onPress={() => setWrappedStep(0)}>
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          {/* Story Left/Right Tap Overlays */}
          <View style={styles.navigationOverlayContainer} pointerEvents="box-none">
            <TouchableOpacity 
              activeOpacity={1} 
              style={styles.navLeftTap} 
              onPress={() => {
                if (wrappedStep > 1) {
                  setWrappedStep(prev => prev - 1);
                }
              }} 
            />
            <TouchableOpacity 
              activeOpacity={1} 
              style={styles.navRightTap} 
              onPress={() => {
                if (wrappedStep < 5) {
                  setWrappedStep(prev => prev + 1);
                }
              }} 
            />
          </View>

          {/* STORY SLIDE 1: TOTAL BOOKS (SCATTER) */}
          {wrappedStep === 1 && (
            <View style={styles.storySlide}>
              <ScatterBooks count={booksReadThisYear} />
              <Animated.View entering={ZoomIn.duration(800)} style={{ alignItems: 'center', width: '100%' }}>
                <View style={styles.storyBadge}><Text style={styles.storyBadgeText}>READING WRAPPED</Text></View>
                <Text style={styles.storyTitle}>THIS YEAR, YOU FINISHED</Text>
                <TickingCounter target={booksReadThisYear} style={[styles.wrappedBigNumber, { fontSize: 110, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 10 }, textShadowRadius: 20 }]} />
                <Text style={styles.storySubtitle}>BOOKS!</Text>
                <BookStackGraphic count={booksReadThisYear} />
              </Animated.View>
              <Animated.Text entering={FadeInDown.delay(1500)} style={styles.tapToContinue}>Tap or wait to continue</Animated.Text>
            </View>
          )}

          {/* STORY SLIDE 2: TOP AUTHOR (SCRAMBLE) */}
          {wrappedStep === 2 && (
            <View style={styles.storySlide}>
              <Animated.View entering={ZoomIn.duration(600)} style={styles.polaroidCard}>
                <View style={styles.storyBadge}><Text style={[styles.storyBadgeText, { color: '#666' }]}>YOUR LITERARY SOULMATE</Text></View>
                <Ionicons name="create" size={32} color="#7b2cbf" style={{ marginBottom: 12 }} />
                <ScrambleText text={topAuthor.toUpperCase()} style={styles.polaroidAuthorName} />
                <Text style={styles.polaroidCaption}>You read their words page after page.</Text>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(2000).springify()} style={{ marginTop: 24, alignItems: 'center' }}>
                <Ionicons name={personality.icon as any} size={48} color="white" />
                <Text style={[styles.storyTitle, { marginTop: 8, fontSize: 18 }]}>{personality.title}</Text>
              </Animated.View>
            </View>
          )}

          {/* STORY SLIDE 3: TOP MONTH (SLOT MACHINE) */}
          {wrappedStep === 3 && (
            <View style={styles.storySlide}>
              <View style={styles.storyBadge}><Text style={styles.storyBadgeText}>PEAK MONTH</Text></View>
              <Animated.View entering={ZoomIn.delay(200).duration(800)} style={styles.calendarPage}>
                <View style={styles.calendarHeader}><Text style={styles.calendarHeaderText}>CALENDAR</Text></View>
                <FlippingCalendarMonth targetMonth={topMonth} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 4 }}>
                  <Ionicons name="flame" size={24} color="#f59e0b" />
                  <Text style={styles.calendarBooksCount}>Peak Activity</Text>
                </View>
              </Animated.View>
              <Animated.Text entering={FadeInDown.delay(1000)} style={[styles.storySubtitle, { marginTop: 32 }]}>
                You were turning pages non-stop this month!
              </Animated.Text>
            </View>
          )}

          {/* STORY SLIDE 4: TOP GENRE (POP/EXPAND) */}
          {wrappedStep === 4 && (
            <View style={styles.storySlide}>
              <View style={styles.storyBadge}><Text style={styles.storyBadgeText}>GENRE EXPLORATION</Text></View>
              <Text style={[styles.storyTitle, { marginBottom: 20 }]}>Your favorite genres mapped out...</Text>
              
              <View style={styles.bubblesContainer}>
                {topGenres.slice(0, 3).map((g, idx) => {
                  const size = idx === 0 ? 120 : idx === 1 ? 90 : 70;
                  const bg = idx === 0 ? 'rgba(0, 245, 212, 0.25)' : idx === 1 ? 'rgba(173, 255, 47, 0.25)' : 'rgba(255, 0, 127, 0.25)';
                  const border = idx === 0 ? '#00f5d4' : idx === 1 ? '#adff2f' : '#ff007f';
                  return (
                    <Animated.View 
                      key={g.name}
                      entering={ZoomIn.delay(300 * idx).springify()}
                      style={[
                        styles.genreBubble, 
                        { 
                          width: size, 
                          height: size, 
                          borderRadius: size / 2, 
                          backgroundColor: bg,
                          borderColor: border,
                          top: idx === 0 ? 40 : idx === 1 ? 140 : 100,
                          left: idx === 0 ? 40 : idx === 1 ? 150 : 210,
                        }
                      ]}
                    >
                      <Text style={styles.genreBubbleText} numberOfLines={1}>{g.name}</Text>
                      <Text style={styles.genreBubbleCount}>{g.count} read</Text>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          )}

          {/* STORY SLIDE 5: FINAL SUMMARY */}
          {wrappedStep === 5 && (
            <View style={{ flex: 1 }}>
              {Array.from({ length: 50 }).map((_, i) => (<ConfettiPiece key={i} index={i} />))}
              <ScrollView contentContainerStyle={styles.wrappedContent} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.delay(200).springify()}>
                  <Text style={styles.wrappedYear}>{selectedYear === 'All' ? 'LIFETIME' : selectedYear}</Text>
                  <Text style={styles.wrappedTitle}>WRAPPED</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.wrappedShareCard}>
                  <View style={styles.shareCardHeader}>
                    <Ionicons name="library" size={24} color="#00f5d4" />
                    <Text style={styles.shareCardBrand}>READCOUNT</Text>
                  </View>
                  
                  <Text style={styles.shareCardTitle}>My Reading Year</Text>
                  
                  <View style={styles.shareCardGrid}>
                    <View style={styles.shareCardItem}>
                      <Text style={styles.shareCardLabel}>BOOKS FINISHED</Text>
                      <Text style={styles.shareCardValue}>{booksReadThisYear}</Text>
                    </View>
                    <View style={styles.shareCardItem}>
                      <Text style={styles.shareCardLabel}>TOP AUTHOR</Text>
                      <Text style={styles.shareCardValue} numberOfLines={1}>{topAuthor}</Text>
                    </View>
                    <View style={styles.shareCardItem}>
                      <Text style={styles.shareCardLabel}>FAVORITE GENRE</Text>
                      <Text style={styles.shareCardValue} numberOfLines={1}>{topGenre}</Text>
                    </View>
                    <View style={styles.shareCardItem}>
                      <Text style={styles.shareCardLabel}>PEAK MONTH</Text>
                      <Text style={styles.shareCardValue}>{topMonth}</Text>
                    </View>
                  </View>

                  <View style={styles.shareCardFooter}>
                    <Ionicons name={personality.icon as any} size={20} color="white" />
                    <Text style={styles.shareCardPersona} numberOfLines={1}>{personality.title}</Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(800)} style={{ width: '100%', alignItems: 'center', marginTop: 16 }}>
                  <TouchableOpacity 
                    style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                    onPress={handleShareWrapped}
                  >
                    <Ionicons name="share-social" size={18} color="white" />
                    <Text style={styles.shareBtnText}>Share My Year</Text>
                  </TouchableOpacity>
                  <Text style={styles.wrappedFooter}>#ReadCountWrapped</Text>
                </Animated.View>
              </ScrollView>
            </View>
          )}

        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  scrollContent: { padding: 24, paddingBottom: 180 },
  header: { marginBottom: 24 },
  greetingText: { fontSize: 14, fontWeight: '800', opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 16 },
  yearScroll: { marginTop: 8 },
  yearScrollContent: { gap: 10, paddingRight: 20 },
  yearChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 80, alignItems: 'center' },
  yearText: { fontSize: 14, fontWeight: '700' },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, marginBottom: 24 },
  cardTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  wrappedBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  wrappedBtnText: { color: 'white', fontSize: 10, fontWeight: '900' },
  goalInfo: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  goalNumber: { fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  goalTotal: { fontSize: 24, fontWeight: '700', marginLeft: 4 },
  progressBarBg: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 6 },
  progressText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  trophyBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
  trophyBadgeText: { fontSize: 11, fontWeight: '800' },
  wrappedPromoCard: { borderRadius: 24, padding: 20, marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  wrappedPromoLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  wrappedPromoTitle: { color: 'white', fontSize: 15, fontWeight: '900' },
  wrappedPromoSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24, justifyContent: 'space-between' },
  dashboardCard: { width: (SCREEN_WIDTH - 64) / 2, padding: 20, borderRadius: 24, borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
  dashboardCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dashboardCardValue: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  dashboardCardLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  personaBanner: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 24 },
  personaIconContainer: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  personaInfo: { flex: 1, marginLeft: 16 },
  personaHeaderLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  personaTitle: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  personaDesc: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1, marginBottom: 16, marginLeft: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  monthName: { width: 35, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  pollTrack: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  barContainer: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden', marginRight: 12 },
  monthBar: { height: '100%', borderRadius: 6 },
  monthCount: { width: 25, fontSize: 14, textAlign: 'right', fontWeight: '900' },
  personalityCard: { width: '100%', borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  personalityHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  personalityTitle: { color: 'white', fontSize: 22, fontWeight: '900' },
  personalityDesc: { color: 'white', fontSize: 16, fontWeight: '500', opacity: 0.9, lineHeight: 22 },
  wrappedContainer: { flex: 1 },
  closeWrapped: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 24, zIndex: 50 },
  wrappedContent: { padding: 32, alignItems: 'center', paddingTop: 80 },
  wrappedYear: { color: 'white', fontSize: 24, fontWeight: '900', opacity: 0.8 },
  wrappedTitle: { color: 'white', fontSize: 56, fontWeight: '900', letterSpacing: -2, marginBottom: 40 },
  wrappedMainCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 32, padding: 32, alignItems: 'center', marginBottom: 24 },
  wrappedLabel: { color: 'white', fontSize: 18, fontWeight: '600' },
  wrappedBigNumber: { color: 'white', fontSize: 100, fontWeight: '900', marginVertical: 10 },
  wrappedRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  wrappedSmallCard: { flex: 1, borderRadius: 24, padding: 20, alignItems: 'center' },
  wrappedSmallLabel: { color: 'white', fontSize: 12, fontWeight: 'bold', marginTop: 8, opacity: 0.8 },
  wrappedSmallValue: { color: 'white', fontSize: 18, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  wrappedQuoteCard: { width: '100%', padding: 32, borderRadius: 24, marginBottom: 40 },
  wrappedQuote: { color: 'white', fontSize: 20, fontStyle: 'italic', textAlign: 'center', lineHeight: 28 },
  wrappedQuoteAuthor: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginTop: 16, opacity: 0.8 },
  wrappedFooter: { color: 'white', fontSize: 16, fontWeight: 'bold', opacity: 0.6 },
  progressIndicators: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 24, right: 24, flexDirection: 'row', gap: 8, zIndex: 10 },
  progressDot: { width: 32, height: 4, borderRadius: 2 },
  storySlide: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  storyTitle: { color: 'white', fontSize: 28, fontWeight: '900', textAlign: 'center', opacity: 0.9 },
  storySubtitle: { color: 'white', fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 16, opacity: 0.8 },
  tapToContinue: { position: 'absolute', bottom: 40, color: 'white', fontSize: 12, fontWeight: 'bold', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 },
  progressDotContainer: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressDotFill: { height: '100%', backgroundColor: 'white', borderRadius: 2 },
  navigationOverlayContainer: { position: 'absolute', top: 120, bottom: 80, left: 0, right: 0, flexDirection: 'row', zIndex: 40 },
  navLeftTap: { width: '30%', height: '100%' },
  navRightTap: { width: '70%', height: '100%' },
  storyBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 20 },
  storyBadgeText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  wrappedShareCard: { width: '100%', backgroundColor: '#1e1e1e', borderRadius: 24, padding: 24, borderWidth: 1.5, borderColor: '#333', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  shareCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  shareCardBrand: { color: 'white', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  shareCardTitle: { color: 'white', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 24 },
  shareCardGrid: { gap: 16, marginBottom: 24 },
  shareCardItem: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 12 },
  shareCardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  shareCardValue: { color: 'white', fontSize: 18, fontWeight: '800' },
  shareCardFooter: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, gap: 8 },
  shareCardPersona: { color: 'white', fontSize: 13, fontWeight: '800' },
  bookStackContainer: { width: '80%', height: 120, justifyContent: 'flex-end', alignItems: 'center', marginTop: 40 },
  bookStackItem: { position: 'absolute', width: 140, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4 },
  polaroidCard: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10, transform: [{ rotate: '-3deg' }] },
  polaroidAuthorName: { fontSize: 28, fontWeight: '900', color: '#1e1e1e', textAlign: 'center', marginVertical: 16 },
  polaroidCaption: { fontSize: 13, fontWeight: '600', color: '#666', fontStyle: 'italic', textAlign: 'center' },
  calendarPage: { backgroundColor: 'white', width: 180, height: 200, borderRadius: 20, overflow: 'hidden', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  calendarHeader: { backgroundColor: '#ef233c', width: '100%', paddingVertical: 12, alignItems: 'center' },
  calendarHeaderText: { color: 'white', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  calendarMonth: { fontSize: 32, fontWeight: '900', color: '#2b2d42', marginTop: 36, letterSpacing: -1 },
  calendarBooksCount: { fontSize: 13, fontWeight: '800', color: '#8d99ae' },
  bubblesContainer: { width: '100%', height: 300, position: 'relative', marginTop: 20 },
  genreBubble: { position: 'absolute', justifyContent: 'center', alignItems: 'center', borderWidth: 2, padding: 8 },
  genreBubbleText: { color: 'white', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  genreBubbleCount: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', marginTop: 2 },
  lockedCard: { padding: 32, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minHeight: 280, marginHorizontal: 4 },
  lockedIconBg: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  lockedTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 12, lineHeight: 26 },
  lockedSubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 22, opacity: 0.8, paddingHorizontal: 8 },
  teaserStats: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5 },
  teaserStatsText: { fontSize: 13, fontWeight: '700' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  shareBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
