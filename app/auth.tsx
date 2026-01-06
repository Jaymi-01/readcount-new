import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { COLORS, darkColors } from '../constants/colors';
import { auth, db } from '../firebaseConfig';
import { useTheme } from './context/ThemeContext';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : COLORS;

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // -------------------------------------------------------------------------
  // SIGNUP LOGIC
  // -------------------------------------------------------------------------
  const handleSignup = async () => {
    // 1. Basic Input Validation
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Please fill in all fields.',
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Weak Password',
        text2: 'Password must be at least 6 characters long.',
      });
      return;
    }

    setLoading(true);

    try {
      // 2. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        // 3. Update Profile with Default Name
        await updateProfile(user, { displayName: "Reader" });

        // 4. Create User Document in Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: email,
          username: "Reader", // Default username
          dateAdded: new Date(),
          role: 'user', 
          uid: user.uid
        });
      } catch (firestoreError) {
        console.error("Firestore creation failed, rolling back auth:", firestoreError);
        try { await user.delete(); } catch (e) {} 
        throw new Error("Failed to create user profile. Please try again.");
      }

      Toast.show({
        type: 'success',
        text1: 'Account Created',
        text2: 'Welcome to ReadCount!',
      });

      router.replace('/(tabs)/library');

    } catch (error: any) {
      console.error('Signup Error:', error);
      let errorMessage = "An unexpected error occurred.";

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already associated with an account.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password should be at least 6 characters.";
      }

      Toast.show({
        type: 'error',
        text1: 'Signup Failed',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // LOGIN LOGIC
  // -------------------------------------------------------------------------
  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Please enter both email and password.',
      });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      Toast.show({
        type: 'success',
        text1: 'Welcome Back',
        text2: 'Logged in successfully.',
      });
      
      router.replace('/(tabs)/library');
    } catch (error: any) {
      console.error('Login Error:', error);
      let errorMessage = "Login failed. Please try again.";

      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please try again later.";
      }

      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // FORGOT PASSWORD LOGIC
  // -------------------------------------------------------------------------
  const handleForgotPassword = async () => {
    if (!email) {
      Toast.show({
        type: 'error',
        text1: 'Missing Email',
        text2: 'Please enter your email address.',
      });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSubmitted(true);
      Toast.show({
        type: 'success',
        text1: 'Email Sent',
        text2: 'Check your inbox for password reset instructions.',
      });
    } catch (error: any) {
      console.error('Reset Password Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    // -------------------------------------------------------------------------
    // VIEW: SIGNUP
    // -------------------------------------------------------------------------
    if (mode === 'signup') {
      return (
        <View style={styles.form}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textDark }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.textLight }]}>Sign up to get started</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textDark }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.textDark, borderColor: colors.border }]}
              placeholder="john@example.com"
              placeholderTextColor={colors.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textDark }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.textDark, borderColor: colors.border }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textLight }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => setMode('login')}>
              <Text style={[styles.link, { color: colors.primary }]}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // -------------------------------------------------------------------------
    // VIEW: FORGOT PASSWORD
    // -------------------------------------------------------------------------
    if (mode === 'forgot') {
      return (
        <View style={styles.form}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textDark }]}>Forgot Password?</Text>
            <Text style={[styles.subtitle, { color: colors.textLight }]}>
              {submitted 
                ? "Check your email for a reset link." 
                : "Enter your email and we'll send you a link to reset your password."}
            </Text>
          </View>

          {!submitted ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textDark }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.textDark, borderColor: colors.border }]}
                  placeholder="john@example.com"
                  placeholderTextColor={colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => {
                setSubmitted(false);
                setMode('login');
              }}
            >
              <Text style={styles.buttonText}>Return to Login</Text>
            </TouchableOpacity>
          )}

          {!submitted && (
            <TouchableOpacity style={styles.backButton} onPress={() => setMode('login')}>
              <Text style={[styles.link, { color: colors.textLight }]}>Back to Login</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // -------------------------------------------------------------------------
    // VIEW: LOGIN (Default)
    // -------------------------------------------------------------------------
    return (
      <View style={styles.form}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textDark }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: colors.textLight }]}>Sign in to continue</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textDark }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.textDark, borderColor: colors.border }]}
            placeholder="john@example.com"
            placeholderTextColor={colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.passwordHeader}>
            <Text style={[styles.label, { color: colors.textDark }]}>Password</Text>
            <TouchableOpacity onPress={() => { setSubmitted(false); setMode('forgot'); }}>
              <Text style={[styles.forgotPassword, { color: colors.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.textDark, borderColor: colors.border }]}
            placeholder="••••••••"
            placeholderTextColor={colors.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Logging In...' : 'Log In'}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textLight }]}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={() => setMode('signup')}>
            <Text style={[styles.link, { color: colors.primary }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotPassword: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 8,
  },
});
