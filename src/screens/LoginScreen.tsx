/**
 * =====================================================
 * Login Screen for GitSwipe
 * =====================================================
 * 
 * This screen handles the GitHub OAuth login flow:
 * 
 * 1. User sees "Sign in with GitHub" button
 * 2. User taps button → Opens GitHub login in browser
 * 3. User logs in on GitHub → Redirects back to app
 * 4. App receives the auth code → Exchanges for token
 * 5. App signs into Firebase → User is logged in!
 * 
 * =====================================================
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const authService = useMemo(() => new AuthService(), []);
  const { request, response, promptAsync } = authService.useGitHubAuth();

  // Handle OAuth response
  useEffect(() => {
    if (!response) return;
    logger.debug('OAuth response', { type: response.type });

    if (response.type === 'success' && response.params?.code) {
      handleTokenExchange(response.params.code);
    } else {
      if (response.type === 'error') {
        logger.error('OAuth error', response.error);
        Alert.alert('Login Error', 'GitHub authentication failed');
      }
      setIsLoading(false);
    }
  }, [response]);

  // Exchange code → token → Firebase sign-in
  const handleTokenExchange = async (code: string) => {
    try {
      if (!request) throw new Error('OAuth request missing');

      const accessToken = await authService.exchangeCodeForToken(code, request);
      await authService.signInWithGitHub(accessToken);
      logger.info('Login complete!');
    } catch (error) {
      logger.error('Login failed', error);
      Alert.alert(
        'Sign In Error',
        error instanceof Error ? error.message : 'Authentication failed',
      );
      setIsLoading(false);
    }
  };

  const handleLogin = useCallback(async () => {
    if (!request) {
      Alert.alert('Error', 'Authentication not ready. Please try again.');
      return;
    }
    setIsLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      logger.error('Failed to open login', error);
      Alert.alert('Error', 'Failed to open GitHub login');
      setIsLoading(false);
    }
  }, [request, promptAsync]);

  // Button is disabled while loading or if OAuth isn't ready
  const isDisabled = isLoading || !request;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>GitSwipe</Text>
          <Text style={styles.subtitle}>Issue triage, simplified.</Text>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.button, isDisabled && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isDisabled}
          accessibilityLabel="Sign in with GitHub"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Sign in with GitHub</Text>
          )}
        </TouchableOpacity>

        {/* Help text */}
        {!request && (
          <Text style={styles.helpText}>Preparing authentication...</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    alignItems: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#24292e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#586069',
  },
  button: {
    backgroundColor: '#24292e',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#6a737d',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  helpText: {
    marginTop: 16,
    color: '#6a737d',
    fontSize: 14,
  },
});

export default LoginScreen;
