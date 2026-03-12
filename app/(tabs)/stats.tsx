import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, SafeAreaView, Platform, StatusBar, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
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
          
          const startYear = userDoc.data().dateAdded?.toDate ? userDoc.data().dateAdded.toDate().getFullYear() : new Date().getFullYear();
          const currentYear = new Date().getFullYear();
          const years: (number | 'All')[] = ['All'];
          for (let y = currentYear; y >= Math.min(startYear, 2024); y--) {
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

      snapshot.forEach((doc) => {
        const data = doc.data();
        let finishDate: Date | null = null;
        
        if (data.dateFinished?.toDate) {
          finishDate = data.dateFinished.toDate();
        } else if (data.dateFinished?.seconds) {
          finishDate = new Date(data.dateFinished.seconds * 1000);
        } 
        else if (data.dateAdded?.toDate) {
          finishDate = data.dateAdded.toDate();
        } else if (data.dateAdded?.seconds) {
          finishDate = new Date(data.dateAdded.seconds * 1000);
        }

        // Filter by selected year OR show all if 'All' is selected
        if (finishDate && (selectedYear === 'All' || finishDate.getFullYear() === selectedYear)) {
          count++;
          monthCounts[finishDate.getMonth()]++;
        }
      });

      setBooksReadThisYear(count);
      setMonthlyStats(months.map((m, i) => ({ month: m, count: monthCounts[i] })));
      
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
          <Text style={[styles.cardTitle, { color: colors.textDark }]}>
            {selectedYear === 'All' ? 'Lifetime Library' : `${selectedYear} Reading Goal`}
          </Text>
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
});