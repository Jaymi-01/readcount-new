import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, SafeAreaView, Platform, StatusBar } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';

export default function StatsScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [booksReadThisYear, setBooksReadThisYear] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<{month: string, count: number}[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch User Goal
    const fetchGoal = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setYearlyGoal(userDoc.data().readingGoal || 0);
        }
      } catch (error) {
        console.error("Error fetching goal:", error);
      }
    };
    fetchGoal();

    // Fetch Books for Stats
    const currentYear = new Date().getFullYear();
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
        
        // Use dateFinished if it exists (most accurate)
        if (data.dateFinished?.toDate) {
          finishDate = data.dateFinished.toDate();
        } else if (data.dateFinished?.seconds) {
          finishDate = new Date(data.dateFinished.seconds * 1000);
        } 
        // Fallback to dateAdded for books marked as 'read' before we added dateFinished
        else if (data.dateAdded?.toDate) {
          finishDate = data.dateAdded.toDate();
        } else if (data.dateAdded?.seconds) {
          finishDate = new Date(data.dateAdded.seconds * 1000);
        }

        if (finishDate && finishDate.getFullYear() === currentYear) {
          count++;
          monthCounts[finishDate.getMonth()]++;
        }
      });

      setBooksReadThisYear(count);
      setMonthlyStats(months.map((m, i) => ({ month: m, count: monthCounts[i] })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const progress = yearlyGoal > 0 ? Math.min(booksReadThisYear / yearlyGoal, 1) : 0;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textDark }]}>Reading Stats</Text>
          <Text style={[styles.yearLabel, { color: colors.textLight }]}>{new Date().getFullYear()} Overview</Text>
        </View>

        {/* YEARLY GOAL CARD */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textDark }]}>Annual Goal</Text>
          <View style={styles.goalInfo}>
            <Text style={[styles.goalNumber, { color: colors.primary }]}>{booksReadThisYear}</Text>
            <Text style={[styles.goalTotal, { color: colors.textLight }]}>/ {yearlyGoal || '—'} books</Text>
          </View>
          
          <View style={[styles.progressBarBg, { backgroundColor: colors.background }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
          </View>
          
          <Text style={[styles.progressText, { color: colors.textLight }]}>
            {yearlyGoal > 0 
              ? `${Math.round(progress * 100)}% of your goal reached!` 
              : "Set a goal in Settings to track progress!"}
          </Text>
        </View>

        {/* MONTHLY BREAKDOWN */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Monthly Breakdown</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {monthlyStats.map((item, index) => (
              <View key={item.month} style={styles.monthRow}>
                <Text style={[styles.monthName, { color: colors.textDark }]}>{item.month}</Text>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.monthBar, 
                      { 
                        backgroundColor: colors.primary, 
                        width: item.count > 0 ? `${(item.count / Math.max(...monthlyStats.map(s => s.count), 1)) * 100}%` : 0 
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.monthCount, { color: colors.textLight }]}>{item.count}</Text>
              </View>
            ))}
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
  },
  yearLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
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
    marginBottom: 12,
  },
  monthName: {
    width: 40,
    fontSize: 14,
    fontWeight: '600',
  },
  barContainer: {
    flex: 1,
    height: 8,
    marginHorizontal: 12,
    justifyContent: 'center',
  },
  monthBar: {
    height: 8,
    borderRadius: 4,
  },
  monthCount: {
    width: 20,
    fontSize: 14,
    textAlign: 'right',
  },
});