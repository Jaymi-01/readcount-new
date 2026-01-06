import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp, 
  doc 
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

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
  
  // Ensure we handle array or string for ID
  const recipientId = Array.isArray(id) ? id[0] : id;
  const recipientName = Array.isArray(name) ? name[0] : name;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Generate a consistent chat ID based on user IDs
  const chatId = [currentUser?.uid, recipientId].sort().join('_');

  useEffect(() => {
    if (!currentUser || !recipientId) {
        console.log("Missing user or recipient ID", { currentUser: currentUser?.uid, recipientId });
        setLoading(false);
        return;
    }

    console.log("Listening to chat:", chatId);

    // Reference to the messages subcollection inside the chat document
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Snapshot received: ${snapshot.size} messages`);
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({
          id: doc.id,
          ...doc.data()
        } as Message);
      });
      setMessages(msgs);
      setLoading(false);
      
      // Scroll to bottom on new message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, (error) => {
        console.error("Snapshot error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, recipientId, chatId]);

  const sendMessage = async () => {
    if (inputText.trim().length === 0 || !currentUser) return;

    const text = inputText.trim();
    setInputText(''); // Clear input immediately for better UX

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: text,
        senderId: currentUser.uid,
        createdAt: Timestamp.now(),
        participants: [currentUser.uid, recipientId] // Optional: useful for indexing
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Ideally show a toast or error indicator here
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser?.uid;
    return (
      <View style={[
        styles.messageContainer, 
        isMe ? styles.myMessageContainer : styles.theirMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble, 
          isMe ? { backgroundColor: colors.primary } : { backgroundColor: colors.card },
          isMe ? styles.myMessageBubble : styles.theirMessageBubble
        ]}>
          <Text style={[
            styles.messageText, 
            isMe ? { color: colors.white } : { color: colors.textDark }
          ]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: recipientName || 'Chat',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.textDark,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.textDark} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          style={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
             <View style={{ padding: 20, alignItems: 'center', marginTop: 50 }}>
                <Text style={{ color: colors.textLight }}>No messages yet.</Text>
                <Text style={{ color: colors.textLight, fontSize: 12 }}>Say hello!</Text>
             </View>
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.textDark }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textLight}
        />
        <TouchableOpacity onPress={sendMessage} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="send" size={20} color={colors.white} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    maxWidth: '75%',
    borderRadius: 20,
  },
  myMessageBubble: {
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
