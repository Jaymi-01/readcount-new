import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, TextInput, 
  ActivityIndicator, SafeAreaView, Platform, StatusBar, Dimensions, ScrollView, KeyboardAvoidingView, Keyboard
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
import Animated, { FadeInDown, Layout, FadeIn, FadeOut } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  // Editor State
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  const fetchNotes = useCallback(() => {
    if (!user) {
      setLoading(false);
      return () => {};
    }
    
    const q = query(
      collection(db, 'notes'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          content: data.content || '',
          userId: data.userId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }) as Note[];

      const sortedNotes = notesData.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA;
      });

      setNotes(sortedNotes);
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const unsubscribe = fetchNotes();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [fetchNotes]);

  const handleSaveNote = async () => {
    if (!noteContent.trim() && !noteTitle.trim()) {
      setEditorVisible(false);
      return;
    }

    setIsSaving(true);
    try {
      const noteData = {
        title: noteTitle.trim(),
        content: noteContent.trim(),
        userId: user?.uid,
        updatedAt: Timestamp.now(),
      };

      if (editingNote) {
        await updateDoc(doc(db, 'notes', editingNote.id), noteData);
      } else {
        await addDoc(collection(db, 'notes'), {
          ...noteData,
          createdAt: Timestamp.now(),
        });
      }
      setEditorVisible(false);
      resetForm();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error saving note' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
  };

  const openEditor = (note: Note | null = null) => {
    if (note) {
      setEditingNote(note);
      setNoteTitle(note.title);
      setNoteContent(note.content);
    } else {
      resetForm();
    }
    setEditorVisible(true);
  };

  const confirmDelete = (id: string) => {
    setNoteToDelete(id);
    setShowDeleteModal(true);
  };

  const performDelete = async () => {
    if (!noteToDelete) return;
    try {
      await deleteDoc(doc(db, 'notes', noteToDelete));
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
          onPress={() => openEditor(item)}
          activeOpacity={0.7}
        >
          {item.title ? (
            <Text style={[styles.noteTitle, { color: colors.textDark }]} numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          <Text style={[styles.noteContent, { color: colors.textLight }]} numberOfLines={4}>
            {item.content}
          </Text>
          <View style={styles.noteFooter}>
            <Text style={[styles.noteDate, { color: colors.textLight }]}>
              {item.updatedAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
            </Text>
            <TouchableOpacity onPress={() => confirmDelete(item.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (editorVisible) {
    return (
      <SafeAreaView style={[styles.editorContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={handleSaveNote} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity 
            onPress={handleSaveNote} 
            disabled={isSaving}
            style={[styles.doneBtn, { backgroundColor: colors.primary + '15' }]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.doneBtnText, { color: colors.primary }]}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.editorScroll} showsVerticalScrollIndicator={false}>
            <TextInput
              style={[styles.titleInput, { color: colors.textDark }]}
              placeholder="Title"
              placeholderTextColor={colors.textLight + '80'}
              value={noteTitle}
              onChangeText={setNoteTitle}
              multiline
            />
            <View style={[styles.editorDivider, { backgroundColor: colors.border }]} />
            <TextInput
              style={[styles.contentInput, { color: colors.textDark }]}
              placeholder="Start writing..."
              placeholderTextColor={colors.textLight + '80'}
              value={noteContent}
              onChangeText={setNoteContent}
              multiline
              autoFocus={!editingNote}
              textAlignVertical="top"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textDark }]}>My Notes</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textLight }]}>
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </Text>
      </View>

      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textLight} />
          <TextInput 
            placeholder="Search notes..." 
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
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textLight }]}>No notes yet</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]} 
        onPress={() => openEditor()}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* DELETE CONFIRMATION */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark, textAlign: 'center' }]}>Delete Note?</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity 
                style={[styles.smallBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]} 
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={{ color: colors.textDark, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.smallBtn, { flex: 1, backgroundColor: colors.danger }]} 
                onPress={performDelete}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Delete</Text>
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
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  headerSubtitle: { fontSize: 14, fontWeight: '700', marginTop: 4, opacity: 0.6 },
  searchSection: { paddingHorizontal: 24, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 180 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 16 },
  noteWrapper: { width: (SCREEN_WIDTH - 48) / 2 },
  noteCard: { padding: 16, borderRadius: 20, borderWidth: 1, minHeight: 120, justifyContent: 'space-between' },
  noteTitle: { fontSize: 16, fontWeight: '900', marginBottom: 6 },
  noteContent: { fontSize: 13, lineHeight: 18, opacity: 0.8 },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  noteDate: { fontSize: 10, fontWeight: '800', opacity: 0.5 },
  deleteBtn: { padding: 4 },
  emptyState: { alignItems: 'center', marginTop: 100, width: SCREEN_WIDTH - 32 },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 100, right: 24, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  
  // Editor Styles
  editorContainer: { flex: 1 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  doneBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  doneBtnText: { fontSize: 15, fontWeight: '900' },
  editorScroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 100 },
  titleInput: { fontSize: 28, fontWeight: '900', marginBottom: 12 },
  editorDivider: { height: 1, width: 40, marginBottom: 20, opacity: 0.2 },
  contentInput: { fontSize: 17, lineHeight: 26, minHeight: SCREEN_HEIGHT * 0.6 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  modalContent: { width: '100%', borderRadius: 24, padding: 24, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  smallBtn: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});
