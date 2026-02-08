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
import { setGitHubAccessToken } from '../services/GitHubService';
import { ALERT_MESSAGES } from '../constants';
import type { AuthResponse } from '../types';
import { logger } from '../utils/logger';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const authService = useMemo(() => new AuthService(), []);
  const { request, response, promptAsync, codeVerifier } = authService.useGitHubAuth();

  const handleCodeExchange = useCallback(async (code: string) => {
    logger.debug('Starting code exchange', { hasCode: !!code });
    try {
      if (!codeVerifier) {
        throw new Error('No codeVerifier available for PKCE');
      }
      logger.info('Exchanging authorization code for access token');
      const accessToken = await authService.exchangeCodeForToken(code, codeVerifier);
      setGitHubAccessToken(accessToken);
      logger.info('Access token received, signing in with Firebase');
      await authService.signInWithGitHub(accessToken);
      logger.info('Successfully signed in with Firebase');
    } catch (error) {
      logger.error('Authentication error', error);
      Alert.alert(
        ALERT_MESSAGES.SIGN_IN_ERROR,
        error instanceof Error ? error.message : ALERT_MESSAGES.AUTH_FAILED
      );
      setIsLoading(false);
    }
  }, [authService, codeVerifier]);

  const handleAuthResponse = useCallback((authResponse: AuthResponse | null) => {
    logger.debug('Authentication response received', {
      type: authResponse?.type,
      hasParams: !!authResponse?.params,
      hasAuth: !!authResponse?.authentication
    });

    if (authResponse?.type === 'success') {
      logger.debug('Authentication success - checking for code/token');

      if (authResponse.params?.code) {
        logger.info('Found authorization code, exchanging for token');
        handleCodeExchange(authResponse.params.code);
      } else if (authResponse.authentication?.accessToken) {
        logger.info('Found access token directly');
        handleCodeExchange(authResponse.authentication.accessToken);
      } else {
        logger.warn('No authorization code or token found in response');
        Alert.alert(ALERT_MESSAGES.AUTH_ERROR, 'No authorization code received');
        setIsLoading(false);
      }
    } else if (authResponse?.type === 'error') {
      logger.error('Authentication error response', authResponse);
      Alert.alert(ALERT_MESSAGES.AUTH_ERROR, ALERT_MESSAGES.GITHUB_AUTH_FAILED);
      setIsLoading(false);
    } else if (authResponse?.type === 'cancel') {
      logger.info('Authentication cancelled by user');
      setIsLoading(false);
    }
  }, [handleCodeExchange]);

  useEffect(() => {
    handleAuthResponse(response as AuthResponse | null);
  }, [response, handleAuthResponse]);

  const handleGitHubAuth = useCallback(async () => {
    if (!request) {
      Alert.alert(ALERT_MESSAGES.ERROR, ALERT_MESSAGES.AUTH_NOT_READY);
      return;
    }

    logger.info('Starting GitHub authentication', { requestUrl: request.url });

    setIsLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      logger.error('Authentication prompt error', error);
      Alert.alert(
        ALERT_MESSAGES.ERROR,
        error instanceof Error ? error.message : ALERT_MESSAGES.AUTH_FAILED
      );
      setIsLoading(false);
    }
  }, [request, promptAsync]);

  const isButtonDisabled = isLoading || !request;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>GitSwipe</Text>
          <Text style={styles.subtitle}>Issue triage, simplified.</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, isButtonDisabled && styles.buttonDisabled]}
          onPress={handleGitHubAuth}
          disabled={isButtonDisabled}
          accessibilityLabel="Sign in with GitHub"
          accessibilityRole="button"
          accessibilityState={{ disabled: isButtonDisabled }}
        >
          {isLoading ? (
            <ActivityIndicator color="white" accessibilityLabel="Loading" />
          ) : (
            <Text style={styles.buttonText}>Sign in with GitHub</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2328',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#656d76',
    marginTop: 6,
  },
  button: {
    backgroundColor: '#1f2328',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LoginScreen;
