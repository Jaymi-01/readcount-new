import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Switch, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { updateProfile, deleteUser, signOut } from 'firebase/auth';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const user = auth.currentUser;

  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUsernameChange, setLastUsernameChange] = useState<Timestamp | null>(null);

  // Modals
  const [showNameModal, setShowNameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
    if (!lastUsernameChange) return 31; // More than 30 if never changed
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
    if (daysSinceChange < 30) {
      Toast.show({ 
        type: 'error', 
        text1: 'Cooldown Active', 
        text2: `You can change your name again in ${30 - daysSinceChange} days.` 
      });
      return;
    }

    setModalLoading(true);
    try {
      // Update Firebase Auth
      await updateProfile(user, { displayName: newUsername });

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        username: newUsername,
        lastUsernameChange: Timestamp.now()
      });

      setUsername(newUsername);
      setNewUsername('');
      setShowNameModal(false);
      
      Toast.show({ type: 'success', text1: 'Success', text2: 'Username updated successfully.' });
      
      // Refresh local data to get new timestamp
      fetchUserData();

    } catch (error: any) {
      console.error("Update username error:", error);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: error.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setModalLoading(true);
    try {
      // 1. Delete Firestore Data
      await deleteDoc(doc(db, 'users', user.uid));
      
      // 2. Delete Auth Account
      await deleteUser(user);

      setShowDeleteModal(false);
      Toast.show({ type: 'success', text1: 'Account Deleted', text2: 'We are sorry to see you go.' });
      router.replace('/auth');

    } catch (error: any) {
      console.error("Delete account error:", error);
      if (error.code === 'auth/requires-recent-login') {
         Toast.show({ type: 'error', text1: 'Security Check', text2: 'Please log out and log in again to delete your account.' });
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

      {/* PROFILE SECTION */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>PROFILE</Text>
        
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={styles.row} 
            onPress={() => setShowNameModal(true)}
          >
            <View>
              <Text style={[styles.label, { color: colors.textDark }]}>Display Name</Text>
              <Text style={[styles.value, { color: colors.textLight }]}>{username}</Text>
            </View>
            <Ionicons name="pencil" size={20} color={colors.primary} />
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

      {/* PREFERENCES SECTION */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>PREFERENCES</Text>
        
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textDark }]}>Dark Mode</Text>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>
      </View>

      {/* ACCOUNT ACTIONS */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>ACCOUNT</Text>
        
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Text style={[styles.label, { color: colors.textDark }]}>Log Out</Text>
            <Ionicons name="log-out-outline" size={22} color={colors.textDark} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.row} 
            onPress={() => setShowDeleteModal(true)}
          >
            <Text style={[styles.label, { color: colors.danger }]}>Delete Account</Text>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- EDIT NAME MODAL --- */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark }]}>Change Display Name</Text>
            <Text style={[styles.modalText, { color: colors.textLight }]}>
              You can only change your name once every 30 days.
            </Text>
            
            <TextInput
              style={[styles.input, { color: colors.textDark, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="New Username"
              placeholderTextColor={colors.textLight}
              value={newUsername}
              onChangeText={setNewUsername}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowNameModal(false)}
                disabled={modalLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.primary }]} 
                onPress={handleUpdateUsername}
                disabled={modalLoading}
              >
                {modalLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- DELETE ACCOUNT MODAL --- */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.danger }]}>Delete Account?</Text>
            <Text style={[styles.modalText, { color: colors.textLight }]}>
              Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data will be lost.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowDeleteModal(false)}
                disabled={modalLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.danger }]} 
                onPress={handleDeleteAccount}
                disabled={modalLoading}
              >
                {modalLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 56,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0', // You might want to make this dynamic if strict dark mode border needed
    marginLeft: 16,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e2e8f0', // Neutral gray
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});