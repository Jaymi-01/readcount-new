import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Switch, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, deleteDoc, Timestamp, addDoc, collection } from 'firebase/firestore';
import { updateProfile, deleteUser, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const [user, setUser] = useState<User | null>(auth.currentUser);

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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUsername(data.username || user.displayName || '');
        setReadingGoal(data.readingGoal || 0);
        setLastUsernameChange(data.lastUsernameChange || null);
      } else { setUsername(user.displayName || ''); }
    } catch (error) { Toast.show({ type: 'error', text1: 'Error' }); } finally { setLoading(false); }
  };

  const handleUpdateUsername = async () => {
    if (!user) return;
    if (newUsername.length < 3) { Toast.show({ type: 'error', text1: 'Too Short' }); return; }
    setModalLoading(true);
    try {
      await updateProfile(user, { displayName: newUsername });
      await updateDoc(doc(db, 'users', user.uid), { username: newUsername, lastUsernameChange: Timestamp.now() });
      setUsername(newUsername); setShowNameModal(false); Toast.show({ type: 'success', text1: 'Updated' });
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Failed' }); } finally { setModalLoading(false); }
  };

  const handleUpdateGoal = async () => {
    if (!user) return;
    const goalNum = parseInt(newGoal);
    if (isNaN(goalNum) || goalNum < 0) { Toast.show({ type: 'error', text1: 'Invalid Goal' }); return; }
    setModalLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { readingGoal: goalNum });
      setReadingGoal(goalNum); setShowGoalModal(false); Toast.show({ type: 'success', text1: 'Updated' });
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Failed' }); } finally { setModalLoading(false); }
  };

  const handleSendReport = async () => {
    if (!user) return;
    if (reportDesc.trim().length < 10) { Toast.show({ type: 'error', text1: 'Too Short' }); return; }
    setModalLoading(true);
    try {
      await addDoc(collection(db, 'reports'), { userId: user.uid, userEmail: user.email, type: reportType, description: reportDesc, status: 'pending', createdAt: Timestamp.now(), platform: Platform.OS });
      setShowReportModal(false); setReportDesc(''); Toast.show({ type: 'success', text1: 'Sent' });
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error' }); } finally { setModalLoading(false); }
  };

  const handleLogout = async () => { try { await signOut(auth); router.replace('/auth'); } catch (e) { console.error(e); } };

  if (loading) return <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Text style={[styles.headerTitle, { color: colors.textDark }]}>Settings</Text></View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>PROFILE</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.row} onPress={() => setShowNameModal(true)}><View><Text style={[styles.label, { color: colors.textDark }]}>Display Name</Text><Text style={[styles.value, { color: colors.textLight }]}>{username}</Text></View><Ionicons name="pencil" size={20} color={colors.primary} /></TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => { setNewGoal(readingGoal.toString()); setShowGoalModal(true); }}><View><Text style={[styles.label, { color: colors.textDark }]}>Yearly Goal</Text><Text style={[styles.value, { color: colors.textLight }]}>{readingGoal} books</Text></View><Ionicons name="trophy-outline" size={20} color={colors.primary} /></TouchableOpacity>
          <View style={styles.divider} /><View style={styles.row}><View><Text style={[styles.label, { color: colors.textDark }]}>Email</Text><Text style={[styles.value, { color: colors.textLight }]}>{user?.email}</Text></View><Ionicons name="lock-closed-outline" size={20} color={colors.textLight} /></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}><Text style={[styles.label, { color: colors.textDark }]}>Dark Mode</Text><Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: '#d8dee9', true: colors.primary }} thumbColor={colors.white} /></View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => setShowReportModal(true)}><Text style={[styles.label, { color: colors.textDark }]}>Report an Issue</Text><Ionicons name="bug-outline" size={20} color={colors.textLight} /></TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout}><Text style={[styles.label, { color: colors.textDark }]}>Log Out</Text><Ionicons name="log-out-outline" size={22} color={colors.textDark} /></TouchableOpacity>
          <View style={styles.divider} /><TouchableOpacity style={styles.row} onPress={() => setShowDeleteModal(true)}><Text style={[styles.label, { color: colors.danger }]}>Delete Account</Text><Ionicons name="trash-outline" size={22} color={colors.danger} /></TouchableOpacity>
        </View>
      </View>

      {/* CENTERED MODALS */}
      {[
        { visible: showNameModal, title: 'Change Name', content: <TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="New Name" value={newUsername} onChangeText={setNewUsername} />, onSave: handleUpdateUsername, onClose: () => setShowNameModal(false) },
        { visible: showGoalModal, title: 'Set Goal', content: <TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="e.g. 24" value={newGoal} onChangeText={setNewGoal} keyboardType="numeric" />, onSave: handleUpdateGoal, onClose: () => setShowGoalModal(false) }
      ].map((m, i) => (
        <Modal key={i} visible={m.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: colors.card }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.textDark }]}>{m.title}</Text><TouchableOpacity onPress={m.onClose}><Ionicons name="close" size={24} color={colors.textDark} /></TouchableOpacity></View>{m.content}<TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={m.onSave}>{modalLoading ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}</TouchableOpacity></View></View>
        </Modal>
      ))}

      <Modal visible={showReportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.textDark }]}>Report Issue</Text><TouchableOpacity onPress={() => setShowReportModal(false)}><Ionicons name="close" size={24} color={colors.textDark} /></TouchableOpacity></View>
            <View style={styles.typeRow}>{(['Bug', 'Feature', 'Other'] as const).map(t => (<TouchableOpacity key={t} style={[styles.typeBtn, { backgroundColor: reportType === t ? colors.primary : colors.background, borderColor: colors.border }]} onPress={() => setReportType(t)}><Text style={[styles.typeBtnText, { color: reportType === t ? 'white' : colors.textLight }]}>{t}</Text></TouchableOpacity>))}</View>
            <TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border, backgroundColor: colors.background, height: 100, textAlignVertical: 'top' }]} placeholder="Details..." value={reportDesc} onChangeText={setReportDesc} multiline />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSendReport}>{modalLoading ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Send Report</Text>}</TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.danger }]}>Delete Account?</Text><TouchableOpacity onPress={() => setShowDeleteModal(false)}><Ionicons name="close" size={24} color={colors.textDark} /></TouchableOpacity></View><Text style={{ color: colors.textLight, textAlign: 'center', marginBottom: 24 }}>This is permanent. All library data will be lost forever.</Text><View style={{ flexDirection: 'row', gap: 12, width: '100%' }}><TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowDeleteModal(false)}><Text style={{ color: colors.textDark, fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: colors.danger }]} onPress={() => {}}><Text style={{ color: 'white', fontWeight: 'bold' }}>Delete</Text></TouchableOpacity></View></View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === 'android' ? 60 : 40 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  section: { marginBottom: 32, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginLeft: 8, opacity: 0.5 },
  card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, minHeight: 64 },
  label: { fontSize: 16, fontWeight: '700' },
  value: { fontSize: 14, marginTop: 2, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 28, padding: 24, alignItems: 'center', elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, width: '100%' },
  modalTitle: { fontSize: 22, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  input: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, marginBottom: 16 },
  saveBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', width: '100%' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, width: '100%' },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  typeBtnText: { fontSize: 12, fontWeight: 'bold' },
});