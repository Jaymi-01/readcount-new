import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, SafeAreaView, Platform, StatusBar, TextInput, TouchableOpacity, Modal } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

// --- SUB-COMPONENT FOR ANIMATED BARS ---
function PollBar({ 
  index, 
  count, 
  relativeValue, 
  theme 
}: { 
  index: number, 
  count: number, 
  relativeValue: number, 
  theme: string 
}) {
  const barWidth = useSharedValue(0);
  
  useFocusEffect(
    useCallback(() => {
      barWidth.value = 0;
      barWidth.value = withTiming(relativeValue, { duration: 1000 });
    }, [relativeValue])
  );

  const animatedStyle = useAnimatedStyle(() => {
    const intensity = barWidth.value > 0 ? 0.3 + barWidth.value * 0.7 : 0;
    const baseColor = theme === 'dark' ? '129, 140, 248' : '99, 102, 241';
    
    return {
      width: `${barWidth.value * 100}%`,
      backgroundColor: `rgba(${baseColor}, ${intensity})`,
    };
  });

  return (
    <View style={[styles.barContainer, { backgroundColor: theme === 'dark' ? '#1e293b' : '#f1f5f9' }]}>
      <Animated.View style={[styles.monthBar, animatedStyle]} />
    </View>
  );
}

export default function StatsScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [booksReadThisYear, setBooksReadThisYear] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<{month: string, count: number}[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'All'>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<(number | 'All')[]>([new Date().getFullYear()]);

  // Wrapped State
  const [showWrapped, setShowWrapped] = useState(false);
  const [topMonth, setTopMonth] = useState('');
  const [topAuthor, setTopAuthor] = useState('');

  // Animation Shared Value for Yearly Progress
  const progressValue = useSharedValue(0);

  useEffect(() => {
    if (!user) return;

    // Fetch User Goal and Earliest Book Year
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

    // Fetch Books for Stats
    const q = query(
      collection(db, 'books'),
      where('userId', '==', user.uid),
      where('status', '==', 'read')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthCounts = new Array(12).fill(0);
      const authors: {[key: string]: number} = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        let finishDate: Date | null = null;
        
        const rawDate = data.dateFinished || data.dateAdded;

        if (rawDate) {
          if (typeof rawDate.toDate === 'function') {
            finishDate = rawDate.toDate();
          } else if (rawDate.seconds) {
            finishDate = new Date(rawDate.seconds * 1000);
          } else {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              finishDate = d;
            }
          }
        }

        // Filter by selected year OR show all if 'All' is selected
        if (finishDate && (selectedYear === 'All' || finishDate.getFullYear() === selectedYear)) {
          count++;
          monthCounts[finishDate.getMonth()]++;
          if (data.author) {
            authors[data.author] = (authors[data.author] || 0) + 1;
          }
        }
      });

      setBooksReadThisYear(count);
      setMonthlyStats(months.map((m, i) => ({ month: m, count: monthCounts[i] })));
      
      // Calculate Top Month
      const maxMonthIdx = monthCounts.indexOf(Math.max(...monthCounts));
      setTopMonth(count > 0 ? months[maxMonthIdx] : 'None');

      // Calculate Top Author
      const topAuthEntry = Object.entries(authors).sort((a,b) => b[1] - a[1])[0];
      setTopAuthor(topAuthEntry ? topAuthEntry[0] : 'None');
      
      // Trigger Yearly Animation
      const goal = yearlyGoal || 1;
      progressValue.value = withSpring(Math.min(count / goal, 1), { damping: 15 });
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, selectedYear, yearlyGoal]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const maxCount = Math.max(...monthlyStats.map(s => s.count), 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textDark }]}>Reading Stats</Text>
          
          {/* YEAR SELECTOR CHIPS */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.yearScroll}
            contentContainerStyle={styles.yearScrollContent}
          >
            {availableYears.map((year) => (
              <TouchableOpacity
                key={year}
                onPress={() => setSelectedYear(year)}
                style={[
                  styles.yearChip,
                  { backgroundColor: selectedYear === year ? colors.primary : colors.card, borderColor: colors.border }
                ]}
              >
                <Text style={[
                  styles.yearText,
                  { color: selectedYear === year ? '#FFF' : colors.textLight }
                ]}>
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* YEARLY GOAL CARD */}
        <View style={[styles.card, { backgroundColor: theme === 'dark' ? colors.primaryLight : '#eef2ff', borderColor: colors.primary }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={[styles.cardTitle, { color: colors.textDark, flex: 1 }]}>
              {selectedYear === 'All' ? 'Lifetime Library' : `${selectedYear} Reading Goal`}
            </Text>
            {booksReadThisYear > 0 && selectedYear !== 'All' && (() => {
              const now = new Date();
              const currentYear = now.getFullYear();
              const isDec31 = now.getMonth() === 11 && now.getDate() === 31;
              
              // Only show if:
              // 1. It's a past year OR
              // 2. It's the current year AND it's Dec 31st
              if (selectedYear < currentYear || (selectedYear === currentYear && isDec31)) {
                return (
                  <TouchableOpacity 
                    style={[styles.wrappedBtn, { backgroundColor: colors.secondary }]}
                    onPress={() => setShowWrapped(true)}
                  >
                    <Ionicons name="sparkles" size={14} color="white" />
                    <Text style={styles.wrappedBtnText}>Wrapped</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })()}
          </View>
          <View style={styles.goalInfo}>
            <Text style={[styles.goalNumber, { color: colors.primary }]}>{booksReadThisYear}</Text>
            {selectedYear !== 'All' && (
              <Text style={[styles.goalTotal, { color: colors.textLight }]}>/ {yearlyGoal || '—'} books</Text>
            )}
          </View>
          
          <View style={[styles.progressBarBg, { backgroundColor: colors.white }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: selectedYear === 'All' ? '100%' : `${(booksReadThisYear / (yearlyGoal || 1)) * 100}%` }]} />
          </View>
          
          <Text style={[styles.progressText, { color: colors.textDark, fontWeight: '700' }]}>
            {selectedYear === 'All' 
              ? `You have finished ${booksReadThisYear} books in total!` 
              : yearlyGoal > 0 
                ? `${Math.round((booksReadThisYear / (yearlyGoal || 1)) * 100)}% of your ${selectedYear} goal reached!` 
                : "Set a goal in Settings to track progress!"}
          </Text>
        </View>

        {/* MONTHLY ACTIVITY (POLL STYLE) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Monthly Activity</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 24 }]}>
            {monthlyStats.map((item, index) => (
              <View key={item.month} style={styles.monthRow}>
                <Text style={[styles.monthName, { color: colors.textDark }]}>{item.month}</Text>
                <View style={styles.pollTrack}>
                  <PollBar 
                    index={index} 
                    count={item.count} 
                    relativeValue={item.count / maxCount} 
                    theme={theme} 
                  />
                  <Text style={[styles.monthCount, { color: colors.textDark, fontWeight: '700' }]}>{item.count}</Text>
                </View>
              </View>            ))}
          </View>
        </View>
      </ScrollView>

      {/* --- WRAPPED MODAL --- */}
      <Modal
        visible={showWrapped}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowWrapped(false)}
      >
        <SafeAreaView style={[styles.wrappedContainer, { backgroundColor: colors.primary }]}>
          <TouchableOpacity 
            style={styles.closeWrapped} 
            onPress={() => setShowWrapped(false)}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.wrappedContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.wrappedYear}>{selectedYear === 'All' ? 'LIFETIME' : selectedYear}</Text>
            <Text style={styles.wrappedTitle}>WRAPPED</Text>
            
            <View style={styles.wrappedMainCard}>
              <Text style={styles.wrappedLabel}>You finished</Text>
              <Text style={styles.wrappedBigNumber}>{booksReadThisYear}</Text>
              <Text style={styles.wrappedLabel}>books!</Text>
            </View>

            <View style={styles.wrappedRow}>
              <View style={[styles.wrappedSmallCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="calendar" size={24} color={colors.secondary} />
                <Text style={styles.wrappedSmallLabel}>Top Month</Text>
                <Text style={styles.wrappedSmallValue}>{topMonth}</Text>
              </View>
              <View style={[styles.wrappedSmallCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="person" size={24} color={colors.secondary} />
                <Text style={styles.wrappedSmallLabel}>Top Author</Text>
                <Text style={styles.wrappedSmallValue} numberOfLines={1}>{topAuthor}</Text>
              </View>
            </View>

            <View style={[styles.wrappedQuoteCard, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={styles.wrappedQuote}>"A reader lives a thousand lives before he dies."</Text>
              <Text style={styles.wrappedQuoteAuthor}>— George R.R. Martin</Text>
            </View>

            <Text style={styles.wrappedFooter}>#ReadCountWrapped</Text>
          </ScrollView>
        </SafeAreaView>
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
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  yearScroll: {
    marginTop: 8,
  },
  yearScrollContent: {
    gap: 10,
    paddingRight: 20,
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  wrappedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  wrappedBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  goalNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  goalTotal: {
    fontSize: 20,
    marginLeft: 8,
  },
  progressBarBg: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthName: {
    width: 35,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pollTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  barContainer: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 12,
  },
  monthBar: {
    height: '100%',
    borderRadius: 6,
  },
  monthCount: {
    width: 25,
    fontSize: 14,
    textAlign: 'right',
  },
  // Wrapped Styles
  wrappedContainer: {
    flex: 1,
  },
  closeWrapped: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    zIndex: 10,
  },
  wrappedContent: {
    padding: 32,
    alignItems: 'center',
    paddingTop: 80,
  },
  wrappedYear: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    opacity: 0.8,
  },
  wrappedTitle: {
    color: 'white',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 40,
  },
  wrappedMainCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  wrappedLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  wrappedBigNumber: {
    color: 'white',
    fontSize: 100,
    fontWeight: '900',
    marginVertical: 10,
  },
  wrappedRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  wrappedSmallCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  wrappedSmallLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    opacity: 0.8,
  },
  wrappedSmallValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  wrappedQuoteCard: {
    width: '100%',
    padding: 32,
    borderRadius: 24,
    marginBottom: 40,
  },
  wrappedQuote: {
    color: 'white',
    fontSize: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 28,
  },
  wrappedQuoteAuthor: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 16,
    opacity: 0.8,
  },
  wrappedFooter: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    opacity: 0.6,
  },
});