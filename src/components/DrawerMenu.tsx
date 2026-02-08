import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, TouchableWithoutFeedback, Image,
} from 'react-native';
import { AuthService } from '../services/AuthService';
import { clearGitHubAccessToken } from '../services/GitHubService';
import type { GitHubUser } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

export type ActiveScreen = 'issues' | 'analytics';

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  user: GitHubUser | null;
}

const authService = new AuthService();

const DrawerMenu: React.FC<DrawerMenuProps> = ({
  visible, onClose, activeScreen, onNavigate, user,
}) => {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSignOut = async () => {
    try {
      clearGitHubAccessToken();
      await authService.signOut();
    } catch (e) {
      // ignore
    }
  };

  const menuItems: { key: ActiveScreen; label: string; description: string }[] = [
    { key: 'issues', label: 'Issues', description: 'Triage and manage issues' },
    { key: 'analytics', label: 'Analytics', description: 'GitHub stats and insights' },
  ];

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            { opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        {/* User Profile */}
        <View style={styles.profileSection}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(user?.login || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{user?.name || user?.login || 'User'}</Text>
          <Text style={styles.userLogin}>@{user?.login || 'unknown'}</Text>
        </View>

        {/* Nav Items */}
        <View style={styles.navSection}>
          {menuItems.map((item) => {
            const isActive = activeScreen === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => {
                  onNavigate(item.key);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
                <Text style={styles.navDescription}>{item.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sign Out */}
        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.version}>GitSwipe v1.0</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e1e4e8',
    paddingTop: 60,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f4',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
    backgroundColor: '#f6f8fa',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
    backgroundColor: '#0969da',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2328',
  },
  userLogin: {
    fontSize: 13,
    color: '#656d76',
    marginTop: 2,
  },
  navSection: {
    paddingTop: 12,
    paddingHorizontal: 12,
    flex: 1,
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: '#ddf4ff',
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2328',
  },
  navLabelActive: {
    color: '#0969da',
    fontWeight: '600',
  },
  navDescription: {
    fontSize: 12,
    color: '#656d76',
    marginTop: 2,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#f0f2f4',
    paddingTop: 16,
  },
  signOutBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  signOutText: {
    fontSize: 14,
    color: '#cf222e',
    fontWeight: '500',
  },
  version: {
    fontSize: 11,
    color: '#8c959f',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default DrawerMenu;
