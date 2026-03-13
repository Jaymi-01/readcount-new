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
  RefreshControl,
  Alert,
  Platform,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, darkColors } from '../../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import Toast from 'react-native-toast-message';

interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  reportCount?: number;
  isBanned?: boolean;
}

const ADMIN_EMAIL = 'millerjoel7597@gmail.com';

export default function DMScreen() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<{ [userId: string]: number }>({});
  
  const currentUser = auth.currentUser;
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersList: User[] = [];
      const currentUserId = auth.currentUser?.uid;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (doc.id !== currentUserId) {
          usersList.push({
            id: doc.id,
            name: data.username || data.email?.split('@')[0] || 'Unknown User',
            email: data.email,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username || 'User')}&background=random`,
            reportCount: data.reportCount || 0,
            isBanned: data.isBanned || false
          });
        }
      });
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: { [userId: string]: number } = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const participants = data.participants as string[];
        const otherUserId = participants.find(uid => uid !== currentUser.uid);
        
        if (otherUserId && data.unreadCounts) {
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
  }, [currentUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleBanToggle = async (user: User) => {
    if (!isAdmin) return;

    const action = user.isBanned ? "Unban" : "Ban";
    Alert.alert(
      `${action} User`,
      `Are you sure you want to ${action.toLowerCase()} ${user.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: action, 
          style: user.isBanned ? "default" : "destructive",
          onPress: async () => {
            try {
              const updates: any = { isBanned: !user.isBanned };
              if (action === "Unban") updates.reportCount = 0;
              await updateDoc(doc(db, 'users', user.id), updates);
              Toast.show({ type: 'success', text1: 'Success', text2: `User has been ${action.toLowerCase()}ned.` });
            } catch (error) {
              console.error("Ban error:", error);
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update user status.' });
            }
          }
        }
      ]
    );
  };

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
    const isHighRisk = (item.reportCount || 0) >= 5;

    return (
      <TouchableOpacity 
        style={[
          styles.userCard, 
          { backgroundColor: colors.card, borderColor: colors.border },
          item.isBanned && { opacity: 0.5 }
        ]} 
        onPress={() => navigateToChat(item.id, item.name)}
        onLongPress={() => handleBanToggle(item)}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.textDark }]} numberOfLines={1}>
            {item.name}
          </Text>
          
          {isAdmin && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              {item.isBanned ? (
                <Text style={{ color: colors.danger, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 }}>BANNED</Text>
              ) : (
                <Text style={{ 
                  color: isHighRisk ? colors.secondary : colors.textLight, 
                  fontWeight: isHighRisk ? '900' : '700', 
                  fontSize: 10,
                  letterSpacing: 0.5
                }}>
                  REPORTS: {item.reportCount || 0}
                </Text>
              )}
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textDark }]}>Messages</Text>
        {isAdmin && <Text style={[styles.adminBadge, { color: colors.secondary }]}>ADMIN</Text>}
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.textDark }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.listContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textLight }]}>ALL USERS</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.usersList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.textLight }]}>
                  No users found.
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  adminBadge: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  loader: {
    marginTop: 50,
  },
  listContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 12,
    marginLeft: 24,
    letterSpacing: 1,
  },
  usersList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
});