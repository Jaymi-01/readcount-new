import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where, setDoc, Timestamp } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, FadeInDown, ZoomIn, FadeIn, Easing } from 'react-native-reanimated';
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
  }, []);

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

function ScrollingMonths({ targetMonth }: { targetMonth: string }) {
  const translateY = useSharedValue(0);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ITEM_HEIGHT = 80;
  
  const safeTarget = targetMonth === 'NONE' || !targetMonth ? 'JAN' : targetMonth;
  
  // Create a long list to scroll through
  const extendedMonths = [...months, ...months, ...months, ...months, ...months];
  // Find target in the 4th set
  const finalIndex = (12 * 3) + months.findIndex(m => m.toUpperCase() === safeTarget);

  useEffect(() => {
    translateY.value = withTiming(-(finalIndex * ITEM_HEIGHT) + (SCREEN_HEIGHT / 2) - ITEM_HEIGHT, { 
      duration: 3500,
      easing: Easing.bezier(0.25, 1, 0.5, 1) // Decelerate smoothly
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={animatedStyle}>
        {extendedMonths.map((m, i) => {
          const isTarget = i === finalIndex;
          return (
            <View key={i} style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ 
                color: 'white', 
                fontSize: isTarget ? 64 : 40, 
                fontWeight: '900', 
                opacity: isTarget ? 1 : 0.2,
                textTransform: 'uppercase'
              }}>
                {m}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
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
  }, []);

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

// --- SUB-COMPONENT FOR ANIMATED BARS ---
function PollBar({ index, count, relativeValue, theme }: { index: number, count: number, relativeValue: number, theme: string }) {
  const colors = theme === 'dark' ? darkColors : COLORS;
  const barWidth = useSharedValue(0);
  
  useFocusEffect(useCallback(() => {
    barWidth.value = 0;
    barWidth.value = withTiming(relativeValue, { duration: 1000 });
  }, [relativeValue]));

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
  const [personality, setPersonality] = useState({ title: '', icon: '', desc: '' });

  const progressValue = useSharedValue(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchUserMeta = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setYearlyGoal(userDoc.data().readingGoal || 0);
          const startYear = userDoc.data().dateAdded?.toDate ? userDoc.data().dateAdded.toDate().getFullYear() : 2025;
          const currentYear = new Date().getFullYear();
          const years: (number | 'All')[] = ['All'];
          for (let y = currentYear; y >= Math.min(startYear, 2025); y--) {
            years.push(y);
          }
          setAvailableYears(years);
        }
      } catch (error) {
        console.error("Error fetching user meta:", error);
      }
    };
    fetchUserMeta();

    const q = query(collection(db, 'books'), where('userId', '==', user.uid), where('status', '==', 'read'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthCounts = new Array(12).fill(0);
      const authors: {[key: string]: number} = {};
      const genres: {[key: string]: number} = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        let finishDate: Date | null = null;
        const rawDate = data.dateFinished || data.dateAdded;
        if (rawDate) {
          if (typeof rawDate.toDate === 'function') finishDate = rawDate.toDate();
          else if (rawDate.seconds) finishDate = new Date(rawDate.seconds * 1000);
          else { const d = new Date(rawDate); if (!isNaN(d.getTime())) finishDate = d; }
        }

        if (finishDate && (selectedYear === 'All' || finishDate.getFullYear() === selectedYear)) {
          count++;
          monthCounts[finishDate.getMonth()]++;
          if (data.author) authors[data.author] = (authors[data.author] || 0) + 1;
          if (data.genre) {
            const normalizedGenre = data.genre.charAt(0).toUpperCase() + data.genre.slice(1).toLowerCase();
            genres[normalizedGenre] = (genres[normalizedGenre] || 0) + 1;
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

      if (count >= 20) setPersonality({ title: 'The Speed Demon', icon: 'flash', desc: 'You tear through books like they are nothing!' });
      else if (topAuthEntry && topAuthEntry[1] >= 3) setPersonality({ title: 'The Loyal Fan', icon: 'heart', desc: `You really love ${topAuthEntry[0]}'s work!` });
      else if (count >= 10) setPersonality({ title: 'The Scholar', icon: 'school', desc: 'A dedicated reader with a wide range of interests.' });
      else if (count > 0) setPersonality({ title: 'The Casual Voyager', icon: 'boat', desc: 'Enjoying the journey, one page at a time.' });
      else setPersonality({ title: 'The Newcomer', icon: 'egg', desc: 'Your reading adventure is just beginning!' });
      
      progressValue.value = withSpring(Math.min(count / (yearlyGoal || 1), 1), { damping: 15 });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, selectedYear, yearlyGoal]);

  const checkAndUnlockAchievement = async (achievementId: string) => {
    if (!user) return;
    try {
      const achRef = doc(db, 'users', user.uid, 'achievements', achievementId);
      const achSnap = await getDoc(achRef);
      if (!achSnap.exists()) {
        await setDoc(achRef, { unlocked: true, unlockedAt: Timestamp.now() });
        Toast.show({ type: 'success', text1: '🏆 Trophy Unlocked!', text2: `You reached your reading goal!`, visibilityTime: 4000 });
      }
    } catch (e) { console.error("Achievement error:", e); }
  };

  const advanceWrapped = () => {
    if (wrappedStep > 0 && wrappedStep < 5) {
      setWrappedStep(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const maxCount = Math.max(...monthlyStats.map(s => s.count), 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <DoodleBackground colors={colors} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textDark }]}>{selectedYear === 'All' ? 'LIFETIME TOTAL' : `${selectedYear} GOAL`}</Text>
              <View style={styles.goalInfo}>
                <Text style={[styles.goalNumber, { color: colors.primary }]}>{booksReadThisYear}</Text>
                {selectedYear !== 'All' && <Text style={[styles.goalTotal, { color: colors.textLight }]}>/ {yearlyGoal || '—'}</Text>}
              </View>
            </View>
            {booksReadThisYear > 0 && selectedYear !== 'All' && (() => {
              const now = new Date();
              const isDec31 = now.getMonth() === 11 && now.getDate() === 31;
              if (selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && isDec31)) {
                return (
                  <TouchableOpacity style={[styles.wrappedBtn, { backgroundColor: colors.primary }]} onPress={() => setWrappedStep(1)}>
                    <Ionicons name="sparkles" size={14} color="white" /><Text style={styles.wrappedBtnText}>WRAPPED</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })()}
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.border + '40' }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: selectedYear === 'All' ? '100%' : `${Math.min((booksReadThisYear / (yearlyGoal || 1)) * 100, 100)}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textDark }]}>{selectedYear === 'All' ? `TOTAL BOOKS FINISHED` : yearlyGoal > 0 ? `${Math.round((booksReadThisYear / (yearlyGoal || 1)) * 100)}% REACHED` : "SET A GOAL IN SETTINGS"}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDark }]}>MONTHLY ACTIVITY</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 24, elevation: 4 }]}>
            {monthlyStats.map((item, index) => (
              <View key={item.month} style={styles.monthRow}>
                <Text style={[styles.monthName, { color: colors.textDark }]}>{item.month}</Text>
                <View style={styles.pollTrack}><PollBar index={index} count={item.count} relativeValue={item.count / maxCount} theme={theme} /><Text style={[styles.monthCount, { color: colors.textDark }]}>{item.count}</Text></View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={wrappedStep > 0} animationType="slide" transparent={false} onRequestClose={() => setWrappedStep(0)}>
        <TouchableWithoutFeedback onPress={advanceWrapped}>
          <SafeAreaView style={[styles.wrappedContainer, { backgroundColor: colors.primary }]}>
            
            <View style={styles.progressIndicators}>
              {[1, 2, 3, 4, 5].map(step => (
                <View key={step} style={[styles.progressDot, { backgroundColor: wrappedStep >= step ? 'white' : 'rgba(255,255,255,0.3)' }]} />
              ))}
            </View>

            <TouchableOpacity style={styles.closeWrapped} onPress={() => setWrappedStep(0)}><Ionicons name="close" size={32} color="white" /></TouchableOpacity>

            {/* STORY SLIDE 1: TOTAL BOOKS (SCATTER) */}
            {wrappedStep === 1 && (
              <View style={styles.storySlide}>
                <ScatterBooks count={booksReadThisYear} />
                <Animated.View entering={ZoomIn.duration(800)} style={{ alignItems: 'center' }}>
                  <Text style={styles.storyTitle}>This year, you finished</Text>
                  <Text style={[styles.wrappedBigNumber, { fontSize: 120, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 10 }, textShadowRadius: 20 }]}>{booksReadThisYear}</Text>
                  <Text style={styles.storySubtitle}>books!</Text>
                </Animated.View>
                <Animated.Text entering={FadeInDown.delay(1500)} style={styles.tapToContinue}>Tap to continue</Animated.Text>
              </View>
            )}

            {/* STORY SLIDE 2: TOP AUTHOR (SCRAMBLE) */}
            {wrappedStep === 2 && (
              <View style={styles.storySlide}>
                <Animated.View entering={FadeInDown.duration(600)} style={{ alignItems: 'center', width: '100%' }}>
                  <Text style={styles.storyTitle}>You had a clear favorite.</Text>
                  <Text style={styles.storySubtitle}>Your most read author was...</Text>
                  <View style={{ marginTop: 60, width: '100%', alignItems: 'center' }}>
                    <ScrambleText text={topAuthor.toUpperCase()} style={[styles.wrappedBigNumber, { fontSize: 48, textAlign: 'center', lineHeight: 56 }]} />
                  </View>
                  <Animated.View entering={ZoomIn.delay(2000).springify()} style={{ marginTop: 40, alignItems: 'center' }}>
                    <Ionicons name={personality.icon as any} size={64} color="rgba(255,255,255,0.8)" />
                    <Text style={[styles.storyTitle, { marginTop: 16 }]}>{personality.title}</Text>
                  </Animated.View>
                </Animated.View>
              </View>
            )}

            {/* STORY SLIDE 3: TOP MONTH (SLOT MACHINE) */}
            {wrappedStep === 3 && (
              <View style={styles.storySlide}>
                <Animated.Text entering={FadeInDown.duration(600)} style={[styles.storyTitle, { position: 'absolute', top: 100, zIndex: 10 }]}>
                  The month you read the most was...
                </Animated.Text>
                
                <ScrollingMonths targetMonth={topMonth.toUpperCase()} />
                
                <Animated.View entering={FadeInDown.delay(3500)} style={{ position: 'absolute', bottom: 150, alignItems: 'center', zIndex: 10 }}>
                  <Ionicons name="flame" size={48} color="#f59e0b" />
                  <Text style={[styles.storySubtitle, { marginTop: 16 }]}>You were on fire!</Text>
                </Animated.View>
              </View>
            )}

            {/* STORY SLIDE 4: TOP GENRE (POP/EXPAND) */}
            {wrappedStep === 4 && (
              <View style={styles.storySlide}>
                <Animated.Text entering={FadeInDown} style={styles.storyTitle}>Your favorite world to get lost in was</Animated.Text>
                <View style={{ marginTop: 60, alignItems: 'center' }}>
                  <Animated.View entering={ZoomIn.delay(500).springify().damping(12)}>
                    <Ionicons name="planet" size={120} color="rgba(255,255,255,0.9)" />
                  </Animated.View>
                  <Animated.Text entering={FadeInDown.delay(1200).springify()} style={[styles.wrappedBigNumber, { fontSize: 64, marginTop: 24, textAlign: 'center' }]} adjustsFontSizeToFit numberOfLines={1}>
                    {topGenre.toUpperCase()}
                  </Animated.Text>
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

                  <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.wrappedMainCard}>
                    <Text style={styles.wrappedLabel}>You finished</Text>
                    <Text style={styles.wrappedBigNumber}>{booksReadThisYear}</Text>
                    <Text style={styles.wrappedLabel}>books!</Text>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(600).springify()} style={[styles.personalityCard, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <View style={styles.personalityHeader}>
                      <Ionicons name={personality.icon as any} size={32} color="white" />
                      <Text style={styles.personalityTitle}>{personality.title}</Text>
                    </View>
                    <Text style={styles.personalityDesc}>{personality.desc}</Text>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.wrappedRow}>
                    <View style={[styles.wrappedSmallCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Ionicons name="calendar" size={24} color={colors.secondary} /><Text style={styles.wrappedSmallLabel}>Top Month</Text><Text style={styles.wrappedSmallValue}>{topMonth}</Text></View>
                    <View style={[styles.wrappedSmallCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Ionicons name="person" size={24} color={colors.secondary} /><Text style={styles.wrappedSmallLabel}>Top Author</Text><Text style={styles.wrappedSmallValue} numberOfLines={1}>{topAuthor}</Text></View>
                    <View style={[styles.wrappedSmallCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Ionicons name="book" size={24} color={colors.secondary} /><Text style={styles.wrappedSmallLabel}>Top Genre</Text><Text style={styles.wrappedSmallValue} numberOfLines={1}>{topGenre}</Text></View>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(1000).springify()} style={[styles.wrappedQuoteCard, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <Text style={styles.wrappedQuote}>&quot;A reader lives a thousand lives before he dies.&quot;</Text>
                    <Text style={styles.wrappedQuoteAuthor}>— George R.R. Martin</Text>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(1200)}>
                    <Text style={styles.wrappedFooter}>#ReadCountWrapped</Text>
                  </Animated.View>
                </ScrollView>
              </View>
            )}

          </SafeAreaView>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  scrollContent: { padding: 24, paddingBottom: 180 },
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 16 },
  yearScroll: { marginTop: 8 },
  yearScrollContent: { gap: 10, paddingRight: 20 },
  yearChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 80, alignItems: 'center' },
  yearText: { fontSize: 14, fontWeight: '700' },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, marginBottom: 24 },
  cardTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  wrappedBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  wrappedBtnText: { color: 'white', fontSize: 10, fontWeight: '900' },
  goalInfo: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  goalNumber: { fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  goalTotal: { fontSize: 24, fontWeight: '700', marginLeft: 4 },
  progressBarBg: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 6 },
  progressText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
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
  progressIndicators: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 24, flexDirection: 'row', gap: 8, zIndex: 10 },
  progressDot: { width: 32, height: 4, borderRadius: 2 },
  storySlide: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  storyTitle: { color: 'white', fontSize: 28, fontWeight: '900', textAlign: 'center', opacity: 0.9 },
  storySubtitle: { color: 'white', fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 16, opacity: 0.8 },
  tapToContinue: { position: 'absolute', bottom: 40, color: 'white', fontSize: 14, fontWeight: 'bold', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 },
});
