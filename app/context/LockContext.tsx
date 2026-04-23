import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, darkColors } from '../../constants/colors';
import { auth, db } from '../../firebaseConfig';
import { useTheme } from './ThemeContext';

const SECURE_STORE_KEY = 'app_passlock_pin';
const ASYNC_STORAGE_TIMEOUT_KEY = 'app_passlock_timeout';
const ASYNC_STORAGE_LAST_ACTIVE_KEY = 'app_passlock_last_active';
const ASYNC_STORAGE_BIOMETRIC_KEY = 'app_passlock_biometric_enabled';
const FALLBACK_PIN_KEY = 'app_passlock_pin_fallback';

type LockContextType = {
  isLocked: boolean;
  hasPin: boolean;
  pinTimeout: number; 
  biometricEnabled: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  setPinTimeout: (minutes: number) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  authenticateBiometric: () => Promise<void>;
};

const LockContext = createContext<LockContextType | undefined>(undefined);

export const useLock = () => {
  const context = useContext(LockContext);
  if (!context) {
    throw new Error('useLock must be used within a LockProvider');
  }
  return context;
};

export const LockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;

  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinTimeout, setPinTimeoutState] = useState(0); 
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [user, setUser] = useState<User | null>(null);

  const getStoredPin = async () => {
    try {
      const isSecureAvailable = Platform.OS !== 'web' && await SecureStore.isAvailableAsync();
      if (isSecureAvailable) {
        return await SecureStore.getItemAsync(SECURE_STORE_KEY);
      } else {
        return await AsyncStorage.getItem(FALLBACK_PIN_KEY);
      }
    } catch (e) {
      return null;
    }
  };

  const savePinLocally = async (pin: string) => {
    const isSecureAvailable = Platform.OS !== 'web' && await SecureStore.isAvailableAsync();
    if (isSecureAvailable) {
      await SecureStore.setItemAsync(SECURE_STORE_KEY, pin);
    } else {
      await AsyncStorage.setItem(FALLBACK_PIN_KEY, pin);
    }
  };

  const deletePinLocally = async () => {
    const isSecureAvailable = Platform.OS !== 'web' && await SecureStore.isAvailableAsync();
    if (isSecureAvailable) {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    } else {
      await AsyncStorage.removeItem(FALLBACK_PIN_KEY);
    }
  };

  const syncPinFromCloud = useCallback(async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const cloudPin = data.appLockPin;
        const localPin = await getStoredPin();
        
        if (cloudPin && !localPin) {
          await savePinLocally(cloudPin);
          setHasPin(true);
          setIsLocked(true);
        } else if (!cloudPin && localPin) {
          await updateDoc(doc(db, 'users', userId), { appLockPin: localPin });
        }

        // Sync biometric preference
        if (data.biometricEnabled !== undefined) {
          setBiometricEnabledState(data.biometricEnabled);
          await AsyncStorage.setItem(ASYNC_STORAGE_BIOMETRIC_KEY, data.biometricEnabled.toString());
        }
      }
    } catch (e) {
      console.error('Cloud sync error:', e);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        syncPinFromCloud(u.uid);
      }
    });
    return unsubscribe;
  }, [syncPinFromCloud]);

  const checkPin = useCallback(async () => {
    const pin = await getStoredPin();
    const pinExists = !!pin;
    setHasPin(pinExists);
    
    if (pinExists && auth.currentUser) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const timeout = await AsyncStorage.getItem(ASYNC_STORAGE_TIMEOUT_KEY);
    if (timeout) {
      setPinTimeoutState(parseInt(timeout));
    }
    const bioEnabled = await AsyncStorage.getItem(ASYNC_STORAGE_BIOMETRIC_KEY);
    if (bioEnabled !== null) {
      setBiometricEnabledState(bioEnabled === 'true');
    }
  }, []);

  useEffect(() => {
    checkPin();
    loadSettings();
  }, [checkPin, loadSettings, user]);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      const pin = await getStoredPin();
      if (pin && auth.currentUser) {
        const lastActive = await AsyncStorage.getItem(ASYNC_STORAGE_LAST_ACTIVE_KEY);
        if (lastActive) {
          const lastActiveTime = parseInt(lastActive);
          const currentTime = Date.now();
          const diffMinutes = (currentTime - lastActiveTime) / 1000 / 60;
          if (diffMinutes >= pinTimeout) {
            setIsLocked(true);
          }
        } else {
          setIsLocked(true);
        }
      }
    } else if (nextAppState.match(/inactive|background/)) {
      await AsyncStorage.setItem(ASYNC_STORAGE_LAST_ACTIVE_KEY, Date.now().toString());
    }
    setAppState(nextAppState);
  }, [appState, pinTimeout]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  const setPin = async (pin: string) => {
    await savePinLocally(pin);
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { appLockPin: pin });
    }
    setHasPin(true);
    setIsLocked(false); 
  };

  const removePin = async () => {
    await deletePinLocally();
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { appLockPin: null, biometricEnabled: false });
    }
    setBiometricEnabledState(false);
    await AsyncStorage.removeItem(ASYNC_STORAGE_BIOMETRIC_KEY);
    setHasPin(false);
    setIsLocked(false);
  };

  const setPinTimeout = async (minutes: number) => {
    await AsyncStorage.setItem(ASYNC_STORAGE_TIMEOUT_KEY, minutes.toString());
    setPinTimeoutState(minutes);
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { appLockTimeout: minutes });
    }
  };

  const setBiometricEnabled = async (enabled: boolean) => {
    setBiometricEnabledState(enabled);
    await AsyncStorage.setItem(ASYNC_STORAGE_BIOMETRIC_KEY, enabled.toString());
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { biometricEnabled: enabled });
    }
  };

  const unlock = async (enteredPin: string) => {
    const storedPin = await getStoredPin();
    if (enteredPin === storedPin) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const authenticateBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Read Count',
        fallbackLabel: 'Enter PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Biometric auth error:', e);
    }
  };

  return (
    <LockContext.Provider value={{ 
      isLocked, hasPin, pinTimeout, biometricEnabled, 
      setPin, removePin, setPinTimeout, setBiometricEnabled, 
      unlock, authenticateBiometric 
    }}>
      {children}
      {isLocked && user && (
        <LockScreen 
          onUnlock={unlock} 
          colors={colors} 
          biometricEnabled={biometricEnabled} 
          onBiometricAuth={authenticateBiometric}
        />
      )}
    </LockContext.Provider>
  );
};

const LockScreen: React.FC<{ 
  onUnlock: (pin: string) => Promise<boolean>, 
  colors: any,
  biometricEnabled: boolean,
  onBiometricAuth: () => Promise<void>
}> = ({ onUnlock, colors, biometricEnabled, onBiometricAuth }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (biometricEnabled) {
      onBiometricAuth();
    }
  }, []);

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (newPin.length === 4) {
        validatePin(newPin);
      }
    }
  };

  const validatePin = async (enteredPin: string) => {
    const success = await onUnlock(enteredPin);
    if (success) {
      setPin('');
      setError(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setPin('');
      setError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setError(false), 1000);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <SafeAreaView style={[styles.lockScreenContainer, { backgroundColor: colors.background }]}>
      <View style={styles.lockHeader}>
        <Ionicons name="lock-closed" size={48} color={colors.primary} />
        <Text style={[styles.lockTitle, { color: colors.textDark }]}>App Locked</Text>
        <Text style={[styles.lockSubtitle, { color: colors.textLight }]}>Enter PIN or use Biometrics</Text>
      </View>

      <View style={styles.dotsContainer}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: colors.primary },
              pin.length >= i ? { backgroundColor: colors.primary } : null,
              error ? { borderColor: '#FF3B30', backgroundColor: pin.length >= i ? '#FF3B30' : 'transparent' } : null
            ]}
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <TouchableOpacity key={num} style={styles.key} onPress={() => handlePress(num.toString())}>
            <Text style={[styles.keyText, { color: colors.textDark }]}>{num}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity 
          style={styles.key} 
          onPress={onBiometricAuth}
          disabled={!biometricEnabled}
        >
          {biometricEnabled && (
            <Ionicons name="finger-print" size={32} color={colors.primary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.key} onPress={() => handlePress('0')}>
          <Text style={[styles.keyText, { color: colors.textDark }]}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.key} onPress={handleDelete}>
          <Ionicons name="backspace-outline" size={28} color={colors.textDark} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  lockScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockHeader: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 60,
    gap: 20,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'center',
  },
  key: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
  },
});
