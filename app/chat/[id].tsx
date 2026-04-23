import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TextInput, FlatList, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, darkColors } from '../../constants/colors';
import { DoodleBackground } from '../../components/DoodleBackground';
import { useTheme } from '../../context/ThemeContext';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, setDoc, increment, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import Toast from 'react-native-toast-message';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp;
}

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const currentUser = auth.currentUser;
  
  const recipientId = Array.isArray(id) ? id[0] : id;
  const recipientName = Array.isArray(name) ? name[0] : name;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const chatId = [currentUser?.uid, recipientId].sort().join('_');

  useEffect(() => {
    if (!currentUser || !recipientId) return;
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, recipientId, chatId]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser) return;
    const text = inputText.trim();
    setInputText('');
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text, senderId: currentUser.uid, createdAt: Timestamp.now()
      });
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(chatRef, {
        participants: [currentUser.uid, recipientId],
        lastMessage: text,
        lastMessageAt: Timestamp.now(),
        [`unreadCounts.${recipientId}`]: increment(1)
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const handleReport = async () => {
    if (!currentUser || reportReason.trim().length < 5) {
      Toast.show({ type: 'error', text1: 'Too Short', text2: 'Please give a reason.' });
      return;
    }
    try {
      await addDoc(collection(db, 'reports'), {
        userId: currentUser.uid,
        reportedUserId: recipientId,
        type: 'User Report',
        description: `Chat Report: ${reportReason}`,
        status: 'pending',
        createdAt: Timestamp.now(),
        platform: Platform.OS,
      });
      setReportModalVisible(false);
      setReportReason('');
      Toast.show({ type: 'success', text1: 'Report Sent', text2: 'We will review this user.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send report.' });
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser?.uid;
    return (
      <View style={[styles.messageRow, isMe ? styles.myMsgRow : styles.theirMsgRow]}>
        <View style={[styles.bubble, isMe ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.msgText, { color: isMe ? '#FFF' : colors.textDark }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <DoodleBackground colors={colors} />
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <Stack.Screen options={{ 
        headerShown: true,
        headerTitle: recipientName,
        headerTitleAlign: 'center',
        headerTintColor: colors.textDark,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '900', fontSize: 18 },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.textDark} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={() => setReportModalVisible(true)} style={styles.headerBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.textDark} />
          </TouchableOpacity>
        ),
      }} />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputArea, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: 'transparent', color: colors.textDark, borderColor: colors.border }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textLight}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, { backgroundColor: colors.primary }]} 
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={reportModalVisible} transparent animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textDark }]}>Report User</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textDark} />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Reason for report</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.textDark, borderColor: colors.border, backgroundColor: 'transparent' }]}
              placeholder="Tell us what's wrong..."
              placeholderTextColor={colors.textLight}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.danger }]} onPress={handleReport}>
              <Text style={styles.saveBtnText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 20 },
  messageRow: { marginBottom: 12, maxWidth: '80%' },
  myMsgRow: { alignSelf: 'flex-end' },
  theirMsgRow: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  msgText: { fontSize: 15, fontWeight: '500' },
  inputArea: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, alignItems: 'center', borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, borderWidth: 1, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  headerBtn: { padding: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 28, padding: 24, alignItems: 'center', elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, width: '100%' },
  modalTitle: { fontSize: 22, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  inputLabel: { fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', opacity: 0.6, alignSelf: 'flex-start' },
  modalInput: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, height: 120, textAlignVertical: 'top', marginBottom: 24 },
  saveBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', width: '100%' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
});