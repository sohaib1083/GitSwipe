import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { User } from 'firebase/auth';
import * as Linking from 'expo-linking';
import { View, StyleSheet } from 'react-native';
import { AuthService } from './src/services/AuthService';
import { getStoredAccessToken, GitHubService } from './src/services/GitHubService';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import DrawerMenu, { ActiveScreen } from './src/components/DrawerMenu';
import ErrorBoundary from './src/components/ErrorBoundary';
import { logger } from './src/utils/logger';
import type { GitHubUser } from './src/types';

const Stack = createStackNavigator();

const linking = {
  prefixes: ['gitswipe://', 'exp://localhost:8081/'],
  config: {
    screens: {
      Login: '--/auth',
      Main: 'main',
    },
  },
};

const githubService = new GitHubService();

/* ─── Authenticated App Shell ──────────────────────────────── */

const AppShell: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('issues');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  useEffect(() => {
    githubService.getCurrentUser()
      .then(u => setGithubUser(u))
      .catch(() => {});
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerVisible(prev => !prev);
  }, []);

  const handleNavigate = useCallback((screen: ActiveScreen) => {
    setActiveScreen(screen);
  }, []);

  return (
    <View style={styles.shell}>
      {activeScreen === 'issues' ? (
        <MainScreen onMenuPress={toggleDrawer} />
      ) : (
        <AnalyticsScreen onMenuPress={toggleDrawer} />
      )}
      <DrawerMenu
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        user={githubUser}
      />
    </View>
  );
};

/* ─── Root App ──────────────────────────────────────────────── */

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const authService = useMemo(() => new AuthService(), []);

  // Debug deep linking
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      logger.debug('Deep link received', { url });
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      setUser(user);
      
      if (user) {
        try {
          const storedToken = await getStoredAccessToken();
          if (storedToken) {
            logger.info('GitHub access token restored on app start');
          } else {
            logger.warn('No stored GitHub access token found');
          }
        } catch (error) {
          logger.warn('Failed to restore GitHub access token', error);
        }
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, [authService]);

  if (isLoading) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
              <Stack.Screen name="Main" component={AppShell} />
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
});

export default App;
