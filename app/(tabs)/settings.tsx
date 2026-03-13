import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { deleteUser, signOut, updateProfile } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { COLORS, darkColors } from '../../constants/colors';
import { auth, db } from '../../firebaseConfig';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const user = auth.currentUser;

  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [readingGoal, setReadingGoal] = useState(0);
  const [newGoal, setNewGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUsernameChange, setLastUsernameChange] = useState<Timestamp | null>(null);

  // Modals
  const [showNameModal, setShowNameModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<'Bug' | 'Feature' | 'Other'>('Bug');
  const [reportDesc, setReportDesc] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUsername(data.username || user.displayName || '');
        setReadingGoal(data.readingGoal || 0);
        setLastUsernameChange(data.lastUsernameChange || null);
      } else {
        setUsername(user.displayName || '');
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load user data.' });
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysSinceLastChange = () => {
    if (!lastUsernameChange) return 31;
    const now = new Date();
    const lastChange = lastUsernameChange.toDate();
    const diffTime = Math.abs(now.getTime() - lastChange.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const handleUpdateUsername = async () => {
    if (!user) return;
    if (newUsername.length < 3) {
      Toast.show({ type: 'error', text1: 'Invalid Username', text2: 'Must be at least 3 characters.' });
      return;
    }
    const daysSinceChange = calculateDaysSinceLastChange();
    const isVip = user.email === 'millerjoel7597@gmail.com';
    if (daysSinceChange < 30 && !isVip) {
      Toast.show({ type: 'error', text1: 'Cooldown Active', text2: `Wait ${30 - daysSinceChange} more days.` });
      return;
    }
    setModalLoading(true);
    try {
      await updateProfile(user, { displayName: newUsername });
      await updateDoc(doc(db, 'users', user.uid), {
        username: newUsername,
        lastUsernameChange: Timestamp.now()
      });
      setUsername(newUsername);
      setNewUsername('');
      setShowNameModal(false);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Username updated.' });
      fetchUserData();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: error.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateGoal = async () => {
    if (!user) return;
    const goalNum = parseInt(newGoal);
    if (isNaN(goalNum) || goalNum < 0) {
      Toast.show({ type: 'error', text1: 'Invalid Goal', text2: 'Enter a valid number.' });
      return;
    }
    setModalLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { readingGoal: goalNum });
      setReadingGoal(goalNum);
      setShowGoalModal(false);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Reading goal updated.' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: error.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!user) return;
    if (reportDesc.trim().length < 10) {
      Toast.show({ type: 'error', text1: 'Too Short', text2: 'Please provide more detail.' });
      return;
    }
    setModalLoading(true);
    try {
      await addDoc(collection(db, 'reports'), {
        userId: user.uid,
        userEmail: user.email,
        type: reportType,
        description: reportDesc,
        status: 'pending',
        createdAt: Timestamp.now(),
        platform: Platform.OS,
      });
      setShowReportModal(false);
      setReportDesc('');
      Toast.show({ type: 'success', text1: 'Report Sent', text2: 'Thank you for your feedback!' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send report.' });
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setModalLoading(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      setShowDeleteModal(false);
      Toast.show({ type: 'success', text1: 'Account Deleted' });
      router.replace('/auth');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
         Toast.show({ type: 'error', text1: 'Security Check', text2: 'Log out and in again to delete.' });
      } else {
         Toast.show({ type: 'error', text1: 'Delete Failed', text2: error.message });
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/auth');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textDark }]}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>PROFILE</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.row} onPress={() => setShowNameModal(true)}>
            <View>
              <Text style={[styles.label, { color: colors.textDark }]}>Display Name</Text>
              <Text style={[styles.value, { color: colors.textLight }]}>{username}</Text>
            </View>
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => { setNewGoal(readingGoal.toString()); setShowGoalModal(true); }}>
            <View>
              <Text style={[styles.label, { color: colors.textDark }]}>Yearly Reading Goal</Text>
              <Text style={[styles.value, { color: colors.textLight }]}>{readingGoal} books</Text>
            </View>
            <Ionicons name="trophy-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View>
              <Text style={[styles.label, { color: colors.textDark }]}>Email</Text>
              <Text style={[styles.value, { color: colors.textLight }]}>{user?.email}</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textLight} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textDark }]}>Dark Mode</Text>
            <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: '#767577', true: colors.primary }} thumbColor={colors.white} />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => setShowReportModal(true)}>
            <Text style={[styles.label, { color: colors.textDark }]}>Report an Issue</Text>
            <Ionicons name="bug-outline" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Text style={[styles.label, { color: colors.textDark }]}>Log Out</Text>
            <Ionicons name="log-out-outline" size={22} color={colors.textDark} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => setShowDeleteModal(true)}>
            <Text style={[styles.label, { color: colors.danger }]}>Delete Account</Text>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* NAME MODAL */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark }]}>Change Display Name</Text>
            <TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="New Username" value={newUsername} onChangeText={setNewUsername} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowNameModal(false)}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleUpdateUsername} disabled={modalLoading}>
                {modalLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* GOAL MODAL */}
      <Modal visible={showGoalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark }]}>Set Annual Goal</Text>
            <TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="e.g. 24" value={newGoal} onChangeText={setNewGoal} keyboardType="numeric" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowGoalModal(false)}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleUpdateGoal} disabled={modalLoading}>
                {modalLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE MODAL */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.danger }]}>Delete Account?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowDeleteModal(false)}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.danger }]} onPress={handleDeleteAccount} disabled={modalLoading}>
                {modalLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmButtonText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* REPORT MODAL */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxWidth: 400 }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark }]}>Report an Issue</Text>
            <View style={styles.typeSelector}>
              {(['Bug', 'Feature', 'Other'] as const).map((type) => (
                <TouchableOpacity key={type} style={[styles.typeBtn, { backgroundColor: reportType === type ? colors.primary : colors.background, borderColor: colors.border }]} onPress={() => setReportType(type)}>
                  <Text style={[styles.typeBtnText, { color: reportType === type ? 'white' : colors.textLight }]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border, backgroundColor: colors.background, height: 120, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="What happened?" value={reportDesc} onChangeText={setReportDesc} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowReportModal(false)}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleSendReport} disabled={modalLoading}>
                {modalLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmButtonText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 60 },
  headerTitle: { fontSize: 34, fontWeight: 'bold' },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 8, letterSpacing: 0.5 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, minHeight: 56 },
  label: { fontSize: 16, fontWeight: '500' },
  value: { fontSize: 14, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginLeft: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  input: { width: '100%', height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 20, fontSize: 16 },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 12 },
  modalButton: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { backgroundColor: '#e2e8f0' },
  cancelButtonText: { color: '#475569', fontWeight: '600' },
  confirmButtonText: { color: 'white', fontWeight: '600' },
  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 20, width: '100%' },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  typeBtnText: { fontSize: 12, fontWeight: 'bold' },
});