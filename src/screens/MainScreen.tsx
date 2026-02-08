import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Alert, PanResponder, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GitHubService } from '../services/GitHubService';
import SourceSelector from '../components/SourceSelector';
import FilterBar from '../components/FilterBar';
import IssueCard, { CARD_WIDTH } from '../components/IssueCard';
import IssueDetailModal from '../components/IssueDetailModal';
import { logger } from '../utils/logger';
import type {
  IssueSource, IssueFilters, NormalizedIssue, GitHubOrg, GitHubUser,
} from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.25;
const SWIPE_OUT_DURATION = 280;

const githubService = new GitHubService();

interface MainScreenProps {
  onMenuPress: () => void;
}

const MainScreen: React.FC<MainScreenProps> = ({ onMenuPress }) => {
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);
  const [issues, setIssues] = useState<NormalizedIssue[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<IssueFilters>({
    source: 'all',
    state: 'open',
    sortOrder: 'updated',
    sortDirection: 'desc',
  });

  const [orgs, setOrgs] = useState<GitHubOrg[]>([]);
  const [orgMembers, setOrgMembers] = useState<string[]>([]);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<NormalizedIssue | null>(null);

  // ─── Animation: single Animated.Value for swipe ────────
  const position = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef(false);
  const currentIndexRef = useRef(0);
  const issuesRef = useRef<NormalizedIssue[]>([]);

  // Keep refs in sync
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { issuesRef.current = issues; }, [issues]);

  // ─── Initial Data ─────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [user, userOrgs] = await Promise.all([
          githubService.getCurrentUser(),
          githubService.getUserOrgs(),
        ]);
        setCurrentUser(user);
        setOrgs(userOrgs);
        logger.info('Initial data loaded', { orgs: userOrgs.length });
      } catch (error) {
        logger.error('Failed to load initial data', error);
      }
    })();
  }, []);

  // ─── Fetch Issues ─────────────────────────────────────

  useEffect(() => {
    setIssues([]);
    setCurrentIndex(0);
    setPage(1);
    setHasMore(true);
    fetchIssues(1, true);
  }, [
    filters.source, filters.state, filters.sortOrder, filters.sortDirection,
    filters.repository, filters.organization, filters.assignee,
  ]);

  const fetchIssues = useCallback(async (pageNum: number = 1, isReset: boolean = false) => {
    if (isReset) setLoading(true);
    else setLoadingMore(true);

    try {
      let result;

      if (filters.source === 'all') {
        result = await githubService.fetchAllIssues(
          pageNum, 20, filters.state, filters.sortOrder, filters.sortDirection,
          filters.repository, filters.labels,
        );
      } else if (filters.source === 'organization') {
        if (!filters.organization) {
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        result = await githubService.fetchOrgIssues(
          filters.organization, pageNum, 20, filters.state,
          filters.sortOrder, filters.sortDirection,
          filters.repository, filters.assignee, filters.labels,
        );
      }

      if (result) {
        if (isReset) {
          setIssues(result.items);
          setCurrentIndex(0);
        } else {
          setIssues(prev => [...prev, ...result!.items]);
        }
        setTotalCount(result.totalCount);
        setHasMore(result.hasNextPage);
        setPage(pageNum);
      }
    } catch (error: any) {
      logger.error('Failed to fetch issues', error);
      Alert.alert('Error', error.message || 'Failed to load issues');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  // ─── Source / Filter Handlers ─────────────────────────

  const handleSourceChange = useCallback((source: IssueSource) => {
    const newFilters: IssueFilters = {
      source,
      state: 'open',
      sortOrder: 'updated',
      sortDirection: 'desc',
    };
    if (source === 'organization' && orgs.length > 0) {
      newFilters.organization = orgs[0].login;
    }
    setFilters(newFilters);
  }, [orgs]);

  const handleFiltersChange = useCallback(async (newFilters: IssueFilters) => {
    if (newFilters.organization && newFilters.organization !== filters.organization) {
      loadOrgData(newFilters.organization);
    }
    setFilters(newFilters);
  }, [filters.organization]);

  const loadOrgData = async (orgLogin: string) => {
    try {
      const members = await githubService.getOrgMembers(orgLogin);
      setOrgMembers(members.map(m => m.login));
    } catch (e) {
      logger.warn('Failed to load org data', e);
    }
  };

  // ─── Auto-load more ──────────────────────────────────

  useEffect(() => {
    if (issues.length > 0 && currentIndex >= issues.length - 3 && hasMore && !loadingMore) {
      fetchIssues(page + 1, false);
    }
  }, [currentIndex, issues.length, hasMore, loadingMore, page]);

  // ─── Swipe: spring-based fluid animation ─────────────
  // Refs for everything so PanResponder never has stale closures.
  // Safety timeout guarantees isAnimating is always released.

  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAnimationLock = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    isAnimatingRef.current = false;
  }, []);

  const completeSwipe = useCallback((newIndex: number) => {
    position.setValue(0);
    currentIndexRef.current = newIndex;
    setCurrentIndex(newIndex);
    resetAnimationLock();
  }, [position, resetAnimationLock]);

  const forceSwipe = useCallback((direction: 'left' | 'right') => {
    if (isAnimatingRef.current) return;

    const idx = currentIndexRef.current;
    const len = issuesRef.current.length;
    const newIndex = direction === 'left' ? idx + 1 : idx - 1;

    if (newIndex < 0 || newIndex >= len) {
      // Bounce back at edge with a springy feel
      Animated.spring(position, {
        toValue: 0,
        useNativeDriver: true,
        friction: 6,
        tension: 80,
      }).start();
      return;
    }

    isAnimatingRef.current = true;

    // Safety timeout: if animation callback never fires, force complete
    safetyTimerRef.current = setTimeout(() => {
      if (isAnimatingRef.current) {
        completeSwipe(newIndex);
      }
    }, 500);

    const toX = direction === 'left' ? -SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.5;

    Animated.spring(position, {
      toValue: toX,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
      restDisplacementThreshold: 100,
      restSpeedThreshold: 100,
    }).start(() => {
      completeSwipe(newIndex);
    });
  }, [position, completeSwipe]);

  // Store forceSwipe in a ref so PanResponder always has the latest
  const forceSwipeRef = useRef(forceSwipe);
  useEffect(() => { forceSwipeRef.current = forceSwipe; }, [forceSwipe]);

  // Clean up safety timer on unmount
  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (isAnimatingRef.current) return false;
        // Higher dead zone — 15px before capturing, must be clearly horizontal
        return Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        position.stopAnimation();
        position.setValue(0);
        resetAnimationLock();
      },
      onPanResponderMove: (_, gs) => {
        position.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        const swipedLeft = gs.dx < -SWIPE_THRESHOLD || (gs.dx < -25 && gs.vx < -SWIPE_VELOCITY_THRESHOLD);
        const swipedRight = gs.dx > SWIPE_THRESHOLD || (gs.dx > 25 && gs.vx > SWIPE_VELOCITY_THRESHOLD);

        if (swipedLeft) {
          forceSwipeRef.current('left');
        } else if (swipedRight) {
          forceSwipeRef.current('right');
        } else {
          // Spring back to center — smooth bounce
          Animated.spring(position, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
            tension: 80,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        position.stopAnimation();
        position.setValue(0);
        resetAnimationLock();
      },
    })
  ).current;

  // ─── Detail Modal ─────────────────────────────────────

  const handleOpenDetail = useCallback(() => {
    if (issues[currentIndex]) {
      setSelectedIssue(issues[currentIndex]);
      setDetailVisible(true);
    }
  }, [issues, currentIndex]);

  const handleIssueUpdated = useCallback((updated: NormalizedIssue) => {
    setIssues(prev => prev.map(i =>
      i.issueId === updated.issueId && i.repo === updated.repo ? updated : i
    ));
    setSelectedIssue(updated);
  }, []);

  // ─── Interpolations ──────────────────────────────────

  const rotate = position.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  const topCardScale = position.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.6, 0, SCREEN_WIDTH * 0.6],
    outputRange: [0.88, 1, 0.88],
    extrapolate: 'clamp',
  });

  const topCardOpacity = position.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });

  const nextCardScale = position.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.4, 0, SCREEN_WIDTH * 0.4],
    outputRange: [1, 0.9, 1],
    extrapolate: 'clamp',
  });

  const nextCardOpacity = position.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.4, 0, SCREEN_WIDTH * 0.4],
    outputRange: [1, 0.5, 1],
    extrapolate: 'clamp',
  });

  const nextCardTranslateY = position.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.4, 0, SCREEN_WIDTH * 0.4],
    outputRange: [0, 12, 0],
    extrapolate: 'clamp',
  });

  // Swipe direction hint overlays
  const leftHintOpacity = position.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD * 0.5, 0],
    outputRange: [0.9, 0.3, 0],
    extrapolate: 'clamp',
  });

  const rightHintOpacity = position.interpolate({
    inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD * 1.5],
    outputRange: [0, 0.3, 0.9],
    extrapolate: 'clamp',
  });

  // ─── Render ───────────────────────────────────────────

  const currentIssue = issues[currentIndex];
  const nextIssue = issues[currentIndex + 1];
  const needsSelection = filters.source === 'organization' && !filters.organization;
  const progress = issues.length > 0 ? ((currentIndex + 1) / issues.length) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={styles.menuLine} />
          <View style={[styles.menuLine, { width: 16 }]} />
          <View style={styles.menuLine} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GitSwipe</Text>
        <View style={styles.headerRight}>
          {!loading && issues.length > 0 && (
            <Text style={styles.headerCount}>
              {currentIndex + 1} / {issues.length}{hasMore ? '+' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Source Tabs */}
      <View style={styles.tabsWrapper}>
        <SourceSelector selected={filters.source} onChange={handleSourceChange} />
      </View>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        orgs={orgs}
        orgMembers={orgMembers}
      />

      {/* Progress Bar */}
      {issues.length > 0 && !loading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Card Area */}
      <View style={styles.cardArea}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0969da" />
            <Text style={styles.loadingText}>Loading issues...</Text>
          </View>
        ) : needsSelection ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Select an organization</Text>
            <Text style={styles.emptySubtitle}>Use the filters above to choose</Text>
          </View>
        ) : issues.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No issues found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
          </View>
        ) : currentIssue ? (
          <View style={styles.cardsStack}>
            {/* Next card underneath */}
            {nextIssue && (
              <Animated.View
                style={[
                  styles.cardLayer,
                  {
                    transform: [
                      { scale: nextCardScale },
                      { translateY: nextCardTranslateY },
                    ],
                    opacity: nextCardOpacity,
                  },
                ]}
                pointerEvents="none"
              >
                <IssueCard key={`${nextIssue.repo}-${nextIssue.number}`} issue={nextIssue} />
              </Animated.View>
            )}

            {/* Current card (swipeable) */}
            <Animated.View
              style={[
                styles.cardLayer,
                {
                  transform: [
                    { translateX: position },
                    { rotate },
                    { scale: topCardScale },
                  ],
                  opacity: topCardOpacity,
                },
              ]}
              {...panResponder.panHandlers}
            >
              {/* Swipe direction hints */}
              <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, { opacity: leftHintOpacity }]}>
                <Text style={styles.swipeHintText}>NEXT</Text>
              </Animated.View>
              <Animated.View style={[styles.swipeHint, styles.swipeHintRight, { opacity: rightHintOpacity }]}>
                <Text style={styles.swipeHintText}>PREV</Text>
              </Animated.View>

              <IssueCard key={`${currentIssue.repo}-${currentIssue.number}`} issue={currentIssue} onPress={handleOpenDetail} />
            </Animated.View>
          </View>
        ) : null}
      </View>

      {/* Loading more indicator */}
      {loadingMore && (
        <View style={styles.loadingMoreRow}>
          <ActivityIndicator size="small" color="#656d76" />
          <Text style={styles.loadingMoreText}>Loading more...</Text>
        </View>
      )}

      <IssueDetailModal
        visible={detailVisible}
        issue={selectedIssue}
        onClose={() => setDetailVisible(false)}
        onIssueUpdated={handleIssueUpdated}
        orgMembers={orgMembers}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  menuBtn: { width: 32, gap: 4 },
  menuLine: { width: 20, height: 2, backgroundColor: '#1f2328', borderRadius: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2328', letterSpacing: -0.3 },
  headerRight: { width: 80, alignItems: 'flex-end' },
  headerCount: { fontSize: 12, color: '#656d76', fontWeight: '500' },

  // Tabs
  tabsWrapper: { paddingVertical: 10, backgroundColor: '#fff' },

  // Progress
  progressContainer: { paddingHorizontal: 16, paddingBottom: 4, backgroundColor: '#fff' },
  progressTrack: { height: 3, backgroundColor: '#e1e4e8', borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#0969da', borderRadius: 1.5 },

  // Card Area
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardsStack: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLayer: {
    position: 'absolute',
  },

  // Swipe hints
  swipeHint: {
    position: 'absolute',
    top: 20,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
  },
  swipeHintLeft: {
    right: 16,
    borderColor: '#0969da',
    backgroundColor: 'rgba(9,105,218,0.08)',
  },
  swipeHintRight: {
    left: 16,
    borderColor: '#656d76',
    backgroundColor: 'rgba(101,109,118,0.08)',
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0969da',
    letterSpacing: 1,
  },

  center: { alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#656d76' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1f2328', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#656d76', textAlign: 'center' },

  // Loading More
  loadingMoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#fff',
  },
  loadingMoreText: { fontSize: 12, color: '#656d76' },
});

export default MainScreen;
