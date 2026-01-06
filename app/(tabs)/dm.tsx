import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

export default function DMScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<{ [userId: string]: number }>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  // Listen for unread counts
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Listen to all chats where the current user is a participant
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: { [userId: string]: number } = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const participants = data.participants as string[];
        
        // Find the OTHER user in the chat
        const otherUserId = participants.find(uid => uid !== currentUser.uid);
        
        if (otherUserId && data.unreadCounts) {
           // Get the unread count for the CURRENT user
           const myUnreadCount = data.unreadCounts[currentUser.uid] || 0;
           if (myUnreadCount > 0) {
             counts[otherUserId] = myUnreadCount;
           }
        }
      });
      setUnreadCounts(counts);
    }, (error) => {
      console.error("Error listening to unread counts:", error);
    });

    return () => unsubscribe();
  }, []);

  const fetchUsers = async () => {
    try {
      console.log("Fetching users...");
      const querySnapshot = await getDocs(collection(db, 'users'));
      console.log(`Found ${querySnapshot.size} user documents.`);
      
      const usersList: User[] = [];
      const currentUserId = auth.currentUser?.uid;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Exclude current user
        if (doc.id !== currentUserId) {
          usersList.push({
            id: doc.id,
            name: data.username || data.email?.split('@')[0] || 'Unknown User',
            email: data.email,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username || 'User')}&background=random`
          });
        }
      });

      console.log(`Filtered users count: ${usersList.length}`);
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navigateToChat = (userId: string, userName: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: userId, name: userName }
    });
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const unreadCount = unreadCounts[item.id] || 0;

    return (
      <TouchableOpacity 
        style={[styles.userCard, { backgroundColor: colors.card }]} 
        onPress={() => navigateToChat(item.id, item.name)}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.userName, { color: colors.textDark }]} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textDark }]}>Messages</Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={20} color={colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.textDark }]}
          placeholder="Search users..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.listContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>All Users</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.usersList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textLight, textAlign: 'center' }}>
                  No other users found.
                </Text>
                <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                  Create another account to test messaging!
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginTop: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  listContainer: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 15,
    marginLeft: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  usersList: {
    paddingHorizontal: 15,
  },
  userCard: {
    width: 100,
    alignItems: 'center',
    marginHorizontal: 5,
    padding: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eee',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444', // Danger color
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

