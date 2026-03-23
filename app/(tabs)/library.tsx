import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, TextInput, 
  ActivityIndicator, SafeAreaView, Platform, StatusBar, Dimensions, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, Timestamp, getDoc, setDoc, getDocs 
} from 'firebase/firestore';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 2;

type BookStatus = 'reading' | 'toread' | 'read';

interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  rating?: number;
  userId: string;
  dateAdded: any;
  dateFinished?: any;
  dateStartedReading?: any;
  processedDate: Date;
}

export default function LibraryScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const [user, setUser] = useState<User | null>(auth.currentUser);

  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<BookStatus>('reading');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayName, setDisplayName] = useState('Reader');
  
  const [selectedYear, setSelectedYear] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Modal State (Add/Edit)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<BookStatus>('reading');
  const [rating, setRating] = useState(0);

  // Delete Confirmation State
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Inline Menu State
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setDisplayName(user.displayName || 'Reader');
      }
    }, [user])
  );

  const toggleInlineMenu = (id: string) => {
    setExpandedBookId(expandedBookId === id ? null : id);
  };

  const closeExpandedMenu = () => {
    if (expandedBookId) setExpandedBookId(null);
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'books'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => {
        const d = doc.data();
        let date = d.dateFinished || d.dateAdded;
        let processedDate = new Date();
        if (date?.toDate) processedDate = date.toDate();
        else if (date?.seconds) processedDate = new Date(date.seconds * 1000);
        else processedDate = new Date(date);

        // Migrate legacy reviews to stars if rating is missing
        let migrateRating = d.rating || 0;
        if (!migrateRating && d.review === 'good') migrateRating = 5;
        if (!migrateRating && d.review === 'bad') migrateRating = 1;

        return { id: doc.id, ...d, processedDate, rating: migrateRating };
      }) as Book[];
      setAllBooks(booksData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleSaveBook = async () => {
    if (!title.trim() || !author.trim()) {
      Toast.show({ type: 'error', text1: 'Missing Info' });
      return;
    }
    try {
      const bookData: any = { title, author, status, rating, userId: user?.uid };
      if (editingBook) {
        await updateDoc(doc(db, 'books', editingBook.id), bookData);
        Toast.show({ type: 'success', text1: 'Updated' });
      } else {
        bookData.dateAdded = Timestamp.now();
        await addDoc(collection(db, 'books'), bookData);
        Toast.show({ type: 'success', text1: 'Added' });
      }
      setModalVisible(false);
      resetForm();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    }
  };

  const resetForm = () => {
    setEditingBook(null); setTitle(''); setAuthor(''); setStatus(filterStatus); setRating(0);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book); 
    setTitle(book.title); 
    setAuthor(book.author); 
    setStatus(book.status); 
    setRating(book.rating || 0); 
    setModalVisible(true);
  };

  const confirmDelete = (id: string) => {
    setBookToDelete(id);
    setShowDeleteModal(true);
  };

  const performDelete = async () => {
    if (!bookToDelete) return;
    try {
      await deleteDoc(doc(db, 'books', bookToDelete));
      Toast.show({ type: 'success', text1: 'Deleted' });
      setShowDeleteModal(false);
      setBookToDelete(null);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Delete Failed' });
    }
  };

  const yearsWithCounts = allBooks.reduce((acc: any, book) => {
    const year = book.processedDate.getFullYear().toString();
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});

  const availableYears = ['All', ...Object.keys(yearsWithCounts).sort((a,b) => parseInt(b) - parseInt(a))];

  const getTabCount = (s: BookStatus) => {
    return allBooks.filter(b => {
      const matchesYear = selectedYear === 'All' || b.processedDate.getFullYear().toString() === selectedYear;
      return b.status === s && matchesYear;
    }).length;
  };

  const filteredBooks = allBooks.filter(b => {
    const matchesStatus = b.status === filterStatus;
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = selectedYear === 'All' || b.processedDate.getFullYear().toString() === selectedYear;
    return matchesStatus && matchesSearch && matchesYear;
  });

  const renderBookItem = ({ item, index }: { item: Book, index: number }) => {
    const coverColor = colors.covers[index % colors.covers.length];
    const isExpanded = expandedBookId === item.id;

    return (
      <Animated.View 
        entering={FadeInDown.delay(Math.min(index * 50, 400)).springify()} 
        style={styles.bookWrapper}
      >
        <View style={styles.coverContainer}>
          <View style={[styles.bookCover, { backgroundColor: coverColor }]}>
            <View style={styles.coverTexture} />
            <Text style={styles.coverTitle} numberOfLines={3}>{item.title}</Text>
            <View style={styles.coverDivider} />
            <Text style={styles.coverAuthor} numberOfLines={1}>{item.author}</Text>
            <View style={styles.coverFooter}>
              <Text style={styles.dateText}>{item.processedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
              {item.rating && item.rating > 0 ? (
                <View style={styles.miniRating}>
                  <Ionicons name="star" size={10} color={colors.secondary} />
                  <Text style={styles.miniRatingText}>{item.rating}</Text>
                </View>
              ) : null}
            </View>

            {isExpanded && (
              <View style={[styles.inlineMenu, { backgroundColor: colors.card }]}>
                <TouchableOpacity style={styles.inlineAction} onPress={() => { setExpandedBookId(null); openEditModal(item); }}>
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                  <Text style={[styles.inlineActionText, { color: colors.textDark }]}>EDIT</Text>
                </TouchableOpacity>
                <View style={[styles.inlineDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.inlineAction} onPress={() => { setExpandedBookId(null); confirmDelete(item.id); }}>
                  <Ionicons name="trash" size={16} color={colors.danger} />
                  <Text style={[styles.inlineActionText, { color: colors.danger }]}>DELETE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.coverActions} 
            onPress={() => toggleInlineMenu(item.id)}
            activeOpacity={0.6}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textLight }]}>Welcome back,</Text>
            <Text style={[styles.username, { color: colors.textDark }]} numberOfLines={1}>{displayName}</Text>
          </View>
          <TouchableOpacity style={[styles.filterChip, { backgroundColor: colors.card, borderColor: selectedYear !== 'All' ? colors.primary : colors.border }]} onPress={() => setShowFilterModal(true)}>
            <Ionicons name="options-outline" size={20} color={selectedYear !== 'All' ? colors.primary : colors.textDark} />
            {selectedYear !== 'All' && (
              <View style={styles.activeFilterLabel}>
                <Text style={[styles.filterYearText, { color: colors.primary }]}>{selectedYear}</Text>
                <TouchableOpacity onPress={() => setSelectedYear('All')}><Ionicons name="close-circle" size={16} color={colors.primary} /></TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textLight} /><TextInput placeholder="Search shelf..." placeholderTextColor={colors.textLight} style={[styles.searchInput, { color: colors.textDark }]} value={searchQuery} onChangeText={setSearchQuery} />
          </View>
        </View>

        <View style={styles.filterTabs}>
          {(['reading', 'toread', 'read'] as BookStatus[]).map((s) => (
            <TouchableOpacity key={s} onPress={() => setFilterStatus(s)} style={[styles.tab, filterStatus === s && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}>
              <Text style={[styles.tabText, { color: filterStatus === s ? colors.textDark : colors.textLight }]}>{s === 'toread' ? 'TO READ' : s.toUpperCase()} ({getTabCount(s)})</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
          ) : (
            <FlatList 
              data={filteredBooks} 
              renderItem={renderBookItem} 
              keyExtractor={item => item.id} 
              numColumns={2} 
              contentContainerStyle={styles.listContent} 
              columnWrapperStyle={styles.columnWrapper} 
              showsVerticalScrollIndicator={false} 
              style={{ flex: 1 }}
              onScrollBeginDrag={closeExpandedMenu}
              scrollEventThrottle={16}
              ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="library-outline" size={64} color={colors.border} /><Text style={[styles.emptyText, { color: colors.textLight }]}>No books found</Text></View>} 
            />
          )}
        </View>

        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => { resetForm(); setModalVisible(true); }}><Ionicons name="add" size={32} color="white" /></TouchableOpacity>
      </View>

      {/* FILTER MODAL */}
      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.textDark }]}>Filter by Year</Text><TouchableOpacity onPress={() => setShowFilterModal(false)}><Ionicons name="close" size={24} color={colors.textDark} /></TouchableOpacity></View>
            <ScrollView style={{ width: '100%', maxHeight: 350 }}>
              {availableYears.map(year => (
                <TouchableOpacity key={year} onPress={() => { setSelectedYear(year); setShowFilterModal(false); }} style={[styles.yearOption, selectedYear === year && { backgroundColor: colors.primaryLight }]}><Text style={[styles.yearOptionText, { color: colors.textDark }]}>{year === 'All' ? 'All Time' : year}</Text><Text style={[styles.yearOptionCount, { color: colors.textLight }]}>{year === 'All' ? allBooks.length : yearsWithCounts[year]} books</Text></TouchableOpacity>
              ))}
            </ScrollView>
            {selectedYear !== 'All' && <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.danger }]} onPress={() => { setSelectedYear('All'); setShowFilterModal(false); }}><Ionicons name="trash-bin-outline" size={18} color={colors.danger} /><Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear Year Filter</Text></TouchableOpacity>}
          </View>
        </View>
      </Modal>

      {/* ADD/EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.textDark }]}>{editingBook ? 'Edit Book' : 'New Book'}</Text><TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.textDark} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title</Text><TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border }]} value={title} onChangeText={setTitle} />
              <Text style={styles.inputLabel}>Author</Text><TextInput style={[styles.input, { color: colors.textDark, borderColor: colors.border }]} value={author} onChangeText={setAuthor} />
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.statusRow}>
                {(['reading', 'toread', 'read'] as BookStatus[]).map((s) => (
                  <TouchableOpacity key={s} onPress={() => setStatus(s)} style={[styles.statusBtn, { borderColor: colors.border }, status === s && { backgroundColor: colors.primary, borderColor: colors.primary }]}><Text style={[styles.statusBtnText, { color: status === s ? 'white' : colors.textLight }]}>{s === 'toread' ? 'To Read' : s}</Text></TouchableOpacity>
                ))}
              </View>
              {status === 'read' && (
                <>
                  <Text style={styles.inputLabel}>Rating</Text>
                  <View style={styles.ratingRow}>{[1, 2, 3, 4, 5].map((s) => (<TouchableOpacity key={s} onPress={() => setRating(s)}><Ionicons name={s <= rating ? "star" : "star-outline"} size={32} color={s <= rating ? colors.secondary : colors.border} /></TouchableOpacity>))}</View>
                </>
              )}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveBook}><Text style={styles.saveBtnText}>Save Book</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, paddingBottom: 32 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.danger }]}>Delete Book?</Text><TouchableOpacity onPress={() => setShowDeleteModal(false)}><Ionicons name="close" size={24} color={colors.textDark} /></TouchableOpacity></View>
            <Text style={{ color: colors.textLight, fontSize: 16, marginBottom: 24, textAlign: 'center' }}>Are you sure you want to delete this book from your shelf? This action cannot be undone.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, marginTop: 0 }]} onPress={() => setShowDeleteModal(false)}><Text style={[styles.saveBtnText, { color: colors.textDark }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: colors.danger, marginTop: 0 }]} onPress={performDelete}><Text style={styles.saveBtnText}>Delete</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 40 : 20, marginBottom: 12 },
  greeting: { fontSize: 14, fontWeight: '600' },
  username: { fontSize: 24, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 8 },
  activeFilterLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.1)', paddingLeft: 8 },
  filterYearText: { fontSize: 14, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 100, right: 24, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, zIndex: 100 },
  searchSection: { paddingHorizontal: 24, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
  filterTabs: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 20 },
  tab: { paddingVertical: 8 },
  tabText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 180 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 16 },
  bookWrapper: { width: COLUMN_WIDTH },
  coverContainer: { width: '100%', aspectRatio: 2/3 },
  bookCover: { width: '100%', height: '100%', borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 4, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8 },
  coverActions: { position: 'absolute', top: 12, right: 12, zIndex: 20 },
  coverTexture: { position: 'absolute', left: 10, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(0,0,0,0.15)' },
  coverTitle: { color: 'white', fontSize: 15, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  coverDivider: { width: 30, height: 2, backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 10 },
  coverAuthor: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  coverFooter: { position: 'absolute', bottom: 12, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, alignItems: 'center' },
  dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 'bold' },
  miniRating: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  miniRatingText: { color: 'white', fontSize: 9, fontWeight: 'bold', marginLeft: 2 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 28, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, width: '100%' },
  modalTitle: { fontSize: 24, fontWeight: '900' },
  yearOption: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', padding: 18, borderRadius: 16, marginBottom: 8 },
  yearOptionText: { fontSize: 16, fontWeight: 'bold' },
  yearOptionCount: { fontSize: 14, fontWeight: '600' },
  clearBtn: { flexDirection: 'row', gap: 10, width: '100%', paddingVertical: 16, borderRadius: 16, borderWidth: 1, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { fontSize: 14, fontWeight: 'bold' },
  inputLabel: { fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', opacity: 0.6 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  statusRow: { flexDirection: 'row', gap: 8, width: '100%' },
  statusBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  statusBtnText: { fontSize: 11, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', gap: 12, marginTop: 12, justifyContent: 'center' },
  saveBtn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  menuContent: { width: '85%', maxWidth: 340, borderRadius: 24, padding: 24, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  menuTitle: { fontSize: 18, fontWeight: '900', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
  menuDivider: { height: 1, width: '100%', marginBottom: 16, opacity: 0.1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 },
  menuIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuText: { fontSize: 16, fontWeight: '800' },
  inlineMenu: { position: 'absolute', top: 12, right: 12, width: '60%', borderRadius: 16, paddingVertical: 4, zIndex: 50, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16, width: '100%' },
  inlineActionText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  inlineDivider: { height: 1, width: '100%', opacity: 0.1 },
});