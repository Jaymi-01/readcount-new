import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, TextInput, 
  ActivityIndicator, SafeAreaView, Platform, StatusBar, Dimensions, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, Timestamp, orderBy 
} from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Note {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

export default function NotesScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const [user, setUser] = useState<User | null>(auth.currentUser);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Delete Confirmation
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'notes'), 
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      console.error("Notes error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      Toast.show({ type: 'error', text1: 'Note content is required' });
      return;
    }

    try {
      const noteData = {
        title: noteTitle.trim() || 'Untitled Note',
        content: noteContent.trim(),
        userId: user?.uid,
        updatedAt: Timestamp.now(),
      };

      if (editingNote) {
        await updateDoc(doc(db, 'notes', editingNote.id), noteData);
        Toast.show({ type: 'success', text1: 'Note updated' });
      } else {
        await addDoc(collection(db, 'notes'), {
          ...noteData,
          createdAt: Timestamp.now(),
        });
        Toast.show({ type: 'success', text1: 'Note saved' });
      }
      setModalVisible(false);
      resetForm();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error saving note' });
    }
  };

  const resetForm = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
  };

  const openEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setModalVisible(true);
  };

  const confirmDelete = (id: string) => {
    setNoteToDelete(id);
    setShowDeleteModal(true);
  };

  const performDelete = async () => {
    if (!noteToDelete) return;
    try {
      await deleteDoc(doc(db, 'notes', noteToDelete));
      Toast.show({ type: 'success', text1: 'Note deleted' });
      setShowDeleteModal(false);
      setNoteToDelete(null);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Delete failed' });
    }
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderNoteItem = ({ item, index }: { item: Note, index: number }) => {
    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 50).springify()} 
        layout={Layout.springify()}
        style={styles.noteWrapper}
      >
        <TouchableOpacity 
          style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => openEditNote(item)}
          activeOpacity={0.7}
        >
          <View style={styles.noteHeader}>
            <Text style={[styles.noteTitle, { color: colors.textDark }]} numberOfLines={1}>
              {item.title}
            </Text>
            <TouchableOpacity onPress={() => confirmDelete(item.id)}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.noteContent, { color: colors.textLight }]} numberOfLines={3}>
            {item.content}
          </Text>
          <Text style={[styles.noteDate, { color: colors.textLight }]}>
            {item.updatedAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textDark }]}>Personal Notes</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textLight }]}>
          Thoughts, highlights, and summaries
        </Text>
      </View>

      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textLight} />
          <TextInput 
            placeholder="Search your notes..." 
            placeholderTextColor={colors.textLight}
            style={[styles.searchInput, { color: colors.textDark }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList 
          data={filteredNotes} 
          renderItem={renderNoteItem} 
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={64} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textLight }]}>No notes yet</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]} 
        onPress={() => { resetForm(); setModalVisible(true); }}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* ADD/EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textDark }]}>
                {editingNote ? 'Edit Note' : 'New Note'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textDark} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput 
                style={[styles.input, { color: colors.textDark, borderColor: colors.border }]}
                value={noteTitle}
                onChangeText={setNoteTitle}
                placeholder="Optional title"
                placeholderTextColor={colors.textLight}
              />
              
              <Text style={styles.inputLabel}>Content</Text>
              <TextInput 
                style={[styles.contentInput, { color: colors.textDark, borderColor: colors.border }]}
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Write your thoughts..."
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: colors.primary }]} 
                onPress={handleSaveNote}
              >
                <Text style={styles.saveBtnText}>Save Note</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, paddingBottom: 32 }]}>
            <Text style={[styles.modalTitle, { color: colors.danger, marginBottom: 12, textAlign: 'center' }]}>Delete Note?</Text>
            <Text style={{ color: colors.textLight, fontSize: 16, marginBottom: 24, textAlign: 'center' }}>Are you sure? This note will be gone forever.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.saveBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, marginTop: 0 }]} 
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.saveBtnText, { color: colors.textDark }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, { flex: 1, backgroundColor: colors.danger, marginTop: 0 }]} 
                onPress={performDelete}
              >
                <Text style={styles.saveBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 40 : 20, marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900' },
  headerSubtitle: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  searchSection: { paddingHorizontal: 24, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 24, paddingBottom: 180 },
  noteWrapper: { marginBottom: 16 },
  noteCard: { padding: 16, borderRadius: 16, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  noteTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginRight: 12 },
  noteContent: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  noteDate: { fontSize: 11, fontWeight: '700', opacity: 0.6 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 100, right: 24, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, zIndex: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 450, borderRadius: 28, padding: 24, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900' },
  inputLabel: { fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', opacity: 0.6 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, fontWeight: '600' },
  contentInput: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, minHeight: 200 },
  saveBtn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
