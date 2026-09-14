import React, { useState, useEffect, useCallback } from 'react';
import { 
   StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, TextInput, 
   ActivityIndicator, Platform, StatusBar, Dimensions, ScrollView, KeyboardAvoidingView
 } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, Timestamp 
} from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../../context/ThemeContext';
import Toast from 'react-native-toast-message';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { DoodleBackground } from '../../components/DoodleBackground';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Note {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
  bookId?: string | null;
  bookTitle?: string | null;
}

interface SimpleBook {
  id: string;
  title: string;
  author: string;
}

export default function NotesScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const [user, setUser] = useState<User | null>(auth.currentUser);

  const params = useLocalSearchParams<{ bookId?: string; bookTitle?: string }>();
  const [filterBookId, setFilterBookId] = useState<string | null>(params.bookId || null);
  const [filterBookTitle, setFilterBookTitle] = useState<string | null>(params.bookTitle || null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [userBooks, setUserBooks] = useState<SimpleBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Editor State
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBookTitle, setSelectedBookTitle] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Book Picker Modal
  const [showBookPickerModal, setShowBookPickerModal] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');

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
    if (params.bookId) {
      setFilterBookId(params.bookId);
      setFilterBookTitle(params.bookTitle || null);
    }
  }, [params.bookId, params.bookTitle]);

  useEffect(() => {
    if (!user) {
      setUserBooks([]);
      return;
    }
    const qBooks = query(collection(db, 'books'), where('userId', '==', user.uid));
    const unsubBooks = onSnapshot(qBooks, (snapshot) => {
      const booksData = snapshot.docs.map(d => ({
        id: d.id,
        title: d.data().title || 'Untitled',
        author: d.data().author || '',
      }));
      setUserBooks(booksData);
    });
    return unsubBooks;
  }, [user]);

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
          bookId: data.bookId || null,
          bookTitle: data.bookTitle || null,
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
        bookId: selectedBookId || null,
        bookTitle: selectedBookTitle || null,
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
    } catch {
      Toast.show({ type: 'error', text1: 'Error saving note' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setSelectedBookId(null);
    setSelectedBookTitle(null);
  };

  const openEditor = (note: Note | null = null) => {
    if (note) {
      setEditingNote(note);
      setNoteTitle(note.title);
      setNoteContent(note.content);
      setSelectedBookId(note.bookId || null);
      setSelectedBookTitle(note.bookTitle || null);
    } else {
      resetForm();
      if (filterBookId) {
        setSelectedBookId(filterBookId);
        setSelectedBookTitle(filterBookTitle);
      }
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
    } catch {
      Toast.show({ type: 'error', text1: 'Delete failed' });
    }
  };

  const filteredNotes = notes.filter(n => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      n.title.toLowerCase().includes(q) || 
      n.content.toLowerCase().includes(q) ||
      (n.bookTitle && n.bookTitle.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (filterBookId) {
      return n.bookId === filterBookId;
    }
    return true;
  });

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
          <View>
            {item.bookTitle ? (
              <View style={[styles.noteBookBadge, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="book-outline" size={11} color={colors.primary} />
                <Text style={[styles.noteBookBadgeText, { color: colors.primary }]} numberOfLines={1}>
                  {item.bookTitle}
                </Text>
              </View>
            ) : null}
            {item.title ? (
              <Text style={[styles.noteTitle, { color: colors.textDark }]} numberOfLines={1}>
                {item.title}
              </Text>
            ) : null}
            <Text style={[styles.noteContent, { color: colors.textLight }]} numberOfLines={4}>
              {item.content}
            </Text>
          </View>
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
      <SafeAreaView style={[styles.editorContainer, { backgroundColor: 'transparent' }]}>
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
            <TouchableOpacity 
              style={[styles.bookPickerTrigger, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { setBookSearchQuery(''); setShowBookPickerModal(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="book-outline" size={16} color={selectedBookTitle ? colors.primary : colors.textLight} />
              <Text 
                style={[styles.bookPickerText, { color: selectedBookTitle ? colors.textDark : colors.textLight }]} 
                numberOfLines={1}
              >
                {selectedBookTitle ? `Book: ${selectedBookTitle}` : 'Link note to a book (optional)...'}
              </Text>
              {selectedBookTitle ? (
                <TouchableOpacity 
                  onPress={() => { setSelectedBookId(null); setSelectedBookTitle(null); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textLight} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              )}
            </TouchableOpacity>

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

        {/* BOOK PICKER MODAL IN EDITOR */}
        <Modal visible={showBookPickerModal} transparent animationType="slide" onRequestClose={() => setShowBookPickerModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.pickerModalContent, { backgroundColor: colors.card }]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, { color: colors.textDark }]}>Link to a Book</Text>
                <TouchableOpacity onPress={() => setShowBookPickerModal(false)}>
                  <Ionicons name="close" size={24} color={colors.textDark} />
                </TouchableOpacity>
              </View>

              <View style={[styles.pickerSearchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="search" size={16} color={colors.textLight} />
                <TextInput 
                  placeholder="Search your books..."
                  placeholderTextColor={colors.textLight}
                  style={[styles.pickerSearchInput, { color: colors.textDark }]}
                  value={bookSearchQuery}
                  onChangeText={setBookSearchQuery}
                />
              </View>

              <ScrollView style={{ maxHeight: 320, width: '100%' }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity 
                  style={[styles.bookPickerOption, !selectedBookId && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => {
                    setSelectedBookId(null);
                    setSelectedBookTitle(null);
                    setShowBookPickerModal(false);
                  }}
                >
                  <Ionicons name="document-text-outline" size={18} color={!selectedBookId ? colors.primary : colors.textLight} />
                  <Text style={[styles.bookPickerOptionTitle, { color: !selectedBookId ? colors.primary : colors.textDark, fontWeight: !selectedBookId ? 'bold' : '600', marginLeft: 10, flex: 1 }]}>
                    General Note (No Book)
                  </Text>
                  {!selectedBookId && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>

                {userBooks
                  .filter(b => b.title.toLowerCase().includes(bookSearchQuery.toLowerCase()) || b.author.toLowerCase().includes(bookSearchQuery.toLowerCase()))
                  .map(b => (
                    <TouchableOpacity 
                      key={b.id}
                      style={[styles.bookPickerOption, selectedBookId === b.id && { backgroundColor: colors.primary + '15' }]}
                      onPress={() => {
                        setSelectedBookId(b.id);
                        setSelectedBookTitle(b.title);
                        setShowBookPickerModal(false);
                      }}
                    >
                      <Ionicons name="book" size={18} color={selectedBookId === b.id ? colors.primary : colors.textLight} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.bookPickerOptionTitle, { color: selectedBookId === b.id ? colors.primary : colors.textDark, fontWeight: selectedBookId === b.id ? 'bold' : '600' }]} numberOfLines={1}>
                          {b.title}
                        </Text>
                        {b.author ? (
                          <Text style={[styles.bookPickerOptionAuthor, { color: colors.textLight }]} numberOfLines={1}>
                            {b.author}
                          </Text>
                        ) : null}
                      </View>
                      {selectedBookId === b.id && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <DoodleBackground colors={colors} />
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

      {filterBookId ? (
        <View style={[styles.filterBanner, { backgroundColor: colors.card, borderColor: colors.primary + '50' }]}>
          <View style={styles.filterBannerLeft}>
            <View style={[styles.filterIconBox, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="book" size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.filterBannerLabel, { color: colors.textLight }]}>FILTERED BOOK</Text>
              <Text style={[styles.filterBannerTitle, { color: colors.textDark }]} numberOfLines={1}>
                {filterBookTitle || 'Selected Book'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.filterClearBtn, { backgroundColor: colors.primary + '15' }]}
            onPress={() => { setFilterBookId(null); setFilterBookTitle(null); }}
          >
            <Text style={[styles.filterClearText, { color: colors.primary }]}>Show All</Text>
            <Ionicons name="close-circle" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList 
          data={filteredNotes} 
          renderItem={renderNoteItem} 
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
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
  
  // Note Book Badge
  noteBookBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  noteBookBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 120,
  },

  // Filter Banner
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 24,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  filterIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBannerLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  filterBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  filterClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  filterClearText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Editor Styles
  editorContainer: { flex: 1 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  doneBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  doneBtnText: { fontSize: 15, fontWeight: '900' },
  editorScroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 100 },
  bookPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  bookPickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  titleInput: { fontSize: 28, fontWeight: '900', marginBottom: 12 },
  editorDivider: { height: 1, width: 40, marginBottom: 20, opacity: 0.2 },
  contentInput: { fontSize: 17, lineHeight: 26, minHeight: SCREEN_HEIGHT * 0.6 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 24, padding: 24, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  smallBtn: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  // Picker Modal Styles
  pickerModalContent: {
    width: '100%',
    maxHeight: 460,
    borderRadius: 24,
    padding: 20,
    elevation: 10,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  pickerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  bookPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  bookPickerOptionTitle: {
    fontSize: 14,
  },
  bookPickerOptionAuthor: {
    fontSize: 11,
    marginTop: 2,
  },
});
