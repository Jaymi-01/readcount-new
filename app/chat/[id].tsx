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
  ActivityIndicator,
  Image,
  Alert,
  Modal
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
  doc,
  setDoc,
  updateDoc,
  increment,
  getDoc
} from 'firebase/firestore';
// Removed Firebase Storage imports
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { auth, db } from '../../firebaseConfig';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp;
  imageUrl?: string;
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
  const [uploading, setUploading] = useState(false);
  
  // Image Viewer State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Report Modal State
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const [isBanned, setIsBanned] = useState(false);

  // Generate a consistent chat ID based on user IDs
  const chatId = [currentUser?.uid, recipientId].sort().join('_');

  useEffect(() => {
    if (!currentUser) return;
    // Check if current user is banned
    const checkBanStatus = async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists() && userDoc.data().isBanned) {
        setIsBanned(true);
      }
    };
    checkBanStatus();
  }, [currentUser]);

  // Mark messages as read (reset unread count) when entering chat
  useEffect(() => {
    if (!currentUser || !recipientId) return;

    const resetUnreadCount = async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        
        if (chatDoc.exists()) {
          await updateDoc(chatRef, {
            [`unreadCounts.${currentUser.uid}`]: 0
          });
        }
      } catch (error) {
        console.error("Error resetting unread count:", error);
      }
    };

    resetUnreadCount();
  }, [currentUser, recipientId, chatId]);

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

  const openReportModal = () => {
    setReportReason('');
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert("Reason Required", "Please enter a reason for reporting this user.");
      return;
    }
    if (!currentUser) return;

    setReporting(true);
    try {
      // 1. Create Report
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser.uid,
        reportedId: recipientId,
        timestamp: Timestamp.now(),
        reason: reportReason.trim()
      });

      // 2. Increment reportCount on reported user
      const reportedUserRef = doc(db, 'users', recipientId);
      await updateDoc(reportedUserRef, {
        reportCount: increment(1)
      });

      setReportModalVisible(false);
      Alert.alert("Reported", "User has been reported to the admin.");
    } catch (error) {
      console.error("Report error:", error);
      Alert.alert("Error", "Failed to report user.");
    } finally {
      setReporting(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // crop to square/fixed ratio
        quality: 0.4, // Keep quality low to save space (Firestore 1MB limit)
        base64: true, // Request Base64
      });

      if (!result.canceled && result.assets[0].base64) {
        // Construct data URI
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        // Check size (approx)
        if (base64Img.length > 1000000) { // 1MB
            Alert.alert("Image too large", "Please select a smaller image.");
            return;
        }

        await sendMessage(base64Img);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const saveImageToGallery = async () => {
    if (!selectedImage) return;
    setDownloading(true);

    try {
      // 1. Request Permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Need permission to save images.");
        setDownloading(false);
        return;
      }

      // 2. Write Base64 to temporary file
      // Casting to any to avoid TS errors on constants that are definitely available at runtime
      const FS: any = FileSystem;
      const fileDir = FS.documentDirectory || FS.cacheDirectory;
      if (!fileDir) {
        throw new Error("Storage directory not available");
      }
      
      const filename = fileDir + `photo_${Date.now()}.jpg`;
      // Extract base64 data only (remove "data:image/jpeg;base64,")
      const base64Data = selectedImage.split(',')[1];
      
      await FS.writeAsStringAsync(filename, base64Data, {
        encoding: FS.EncodingType.Base64,
      });

      // 3. Save to Gallery
      await MediaLibrary.saveToLibraryAsync(filename);
      
      Alert.alert("Saved", "Image saved to gallery!");

      // 4. Cleanup
      await FS.deleteAsync(filename, { idempotent: true });

    } catch (error: any) {
      console.error("Download error:", error);
      Alert.alert("Error", "Failed to save image.");
    } finally {
      setDownloading(false);
    }
  };

  const sendMessage = async (imageUrl?: string) => {
    if (isBanned) {
      Alert.alert("Banned", "You are banned from sending messages.");
      return;
    }
    if ((inputText.trim().length === 0 && !imageUrl) || !currentUser) return;
    
    // Safety check for size again if passing blindly
    if (imageUrl && imageUrl.length > 1040000) { 
        Alert.alert("Error", "Image is too large to send.");
        return;
    }

    const text = inputText.trim();
    if (!imageUrl) setInputText(''); // Clear input if sending text only

    // Optimistically set uploading to true if it's an image, though it's instant for base64
    if (imageUrl) setUploading(true);

    try {
      // 1. Add message to subcollection
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: text, // Can be empty if sending image only
        imageUrl: imageUrl || null,
        senderId: currentUser.uid,
        createdAt: Timestamp.now(),
        participants: [currentUser.uid, recipientId]
      });

      // 2. Update chat metadata (last message, unread counts)
      const chatRef = doc(db, 'chats', chatId);
      
      // Use setDoc with merge to ensure document exists, then update
      await setDoc(chatRef, {
        lastMessage: imageUrl ? 'Sent an image' : text,
        lastMessageTimestamp: Timestamp.now(),
        participants: [currentUser.uid, recipientId],
      }, { merge: true });

      // Increment recipient's unread count
      await updateDoc(chatRef, {
        [`unreadCounts.${recipientId}`]: increment(1)
      });

    } catch (error: any) {
      console.error("Error sending message:", error);
      if (error.code === 'resource-exhausted') {
         Alert.alert("Failed", "Image too large for database.");
      }
    } finally {
      setUploading(false);
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
          {item.imageUrl && (
            <TouchableOpacity onPress={() => setSelectedImage(item.imageUrl!)}>
              <Image 
                source={{ uri: item.imageUrl }} 
                style={styles.messageImage} 
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          {item.text ? (
            <Text style={[
              styles.messageText, 
              isMe ? { color: colors.white } : { color: colors.textDark },
              item.imageUrl && { marginTop: 8 }
            ]}>
              {item.text}
            </Text>
          ) : null}
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
          headerRight: () => (
            <TouchableOpacity onPress={openReportModal} style={{ marginRight: 10 }}>
              <Ionicons name="warning-outline" size={24} color={colors.danger} />
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

      {isBanned ? (
        <View style={[styles.bannedContainer, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.danger, fontWeight: 'bold' }}>
            You have been banned from using chat.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}
        >
          <TouchableOpacity 
            onPress={pickImage} 
            disabled={uploading}
            style={styles.attachButton}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textDark }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textLight}
          />
          <TouchableOpacity onPress={() => sendMessage()} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
            <Ionicons name="send" size={20} color={colors.white} />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}

      {/* Full Screen Image Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.downloadButton} 
            onPress={saveImageToGallery}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons name="download-outline" size={30} color="white" />
            )}
          </TouchableOpacity>

          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullScreenImage} 
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={reportModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.reportModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.reportTitle, { color: colors.textDark }]}>Report User</Text>
            <Text style={[styles.reportSubtitle, { color: colors.textLight }]}>
              Please explain why you are reporting this user.
            </Text>
            
            <TextInput
              style={[styles.reportInput, { 
                backgroundColor: colors.background, 
                color: colors.textDark,
                borderColor: colors.border 
              }]}
              multiline
              numberOfLines={4}
              placeholder="Reason for reporting..."
              placeholderTextColor={colors.textLight}
              value={reportReason}
              onChangeText={setReportReason}
            />

            <View style={styles.reportButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setReportModalVisible(false)}
                disabled={reporting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.danger }]} 
                onPress={submitReport}
                disabled={reporting}
              >
                {reporting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
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
  attachButton: {
    padding: 10,
    marginRight: 5,
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
  bannedContainer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  downloadButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },

  // Report Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reportModalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  reportInput: {
    width: '100%',
    height: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  reportButtons: {
    flexDirection: 'row',
    width: '100%',
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
    backgroundColor: '#e2e8f0',
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
