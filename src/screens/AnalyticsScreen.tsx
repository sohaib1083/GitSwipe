import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Dimensions, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GitHubService } from '../services/GitHubService';
import { logger } from '../utils/logger';

const SCREEN_WIDTH = Dimensions.get('window').width;
const githubService = new GitHubService();

// Color palette for language chart
const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Swift: '#ffac45',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Shell: '#89e051',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Unknown: '#8c959f',
};

interface AnalyticsScreenProps {
  onMenuPress: () => void;
}

interface AnalyticsData {
  profile: any;
  issueStats: { open: number; closed: number; total: number };
  topRepos: {
    name: string;
    stars: number;
    forks: number;
    language: string;
    openIssues: number;
    isPrivate: boolean;
  }[];
  languageBreakdown: Record<string, number>;
  recentActivity: any[];
  contributionStats: { totalPRs: number; totalIssues: number; totalCommits: number };
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onMenuPress }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [analytics, contributions] = await Promise.all([
        githubService.getAnalyticsData(),
        githubService.getContributionStats(),
      ]);
      setData({
        profile: analytics.profile,
        issueStats: analytics.issueStats,
        topRepos: analytics.topRepos,
        languageBreakdown: analytics.languageBreakdown,
        recentActivity: analytics.recentActivity,
        contributionStats: contributions,
      });
    } catch (e: any) {
      logger.error('Analytics fetch failed', e);
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onMenuPress={onMenuPress} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0969da" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onMenuPress={onMenuPress} />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error || 'No data available'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sortedLangs = Object.entries(data.languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const totalLangRepos = sortedLangs.reduce((sum, [, count]) => sum + count, 0);

  const activitySummary = summarizeActivity(data.recentActivity);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onMenuPress={onMenuPress} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0969da" />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {data.profile.avatar_url && (
            <Image source={{ uri: data.profile.avatar_url }} style={styles.profileAvatar} />
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{data.profile.name || data.profile.login}</Text>
            <Text style={styles.profileLogin}>@{data.profile.login}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard label="Open Issues" value={data.issueStats.open} color="#1a7f37" />
          <StatCard label="Closed Issues" value={data.issueStats.closed} color="#8250df" />
          <StatCard label="PRs Authored" value={data.contributionStats.totalPRs} color="#0969da" />
          <StatCard label="Total Issues" value={data.issueStats.total} color="#bf8700" />
        </View>

        {/* Issue Ratio Bar */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Issue Breakdown</Text>
          {data.issueStats.total > 0 ? (
            <>
              <View style={styles.ratioBar}>
                <View
                  style={[
                    styles.ratioSegment,
                    {
                      flex: data.issueStats.open,
                      backgroundColor: '#1a7f37',
                      borderTopLeftRadius: 4,
                      borderBottomLeftRadius: 4,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.ratioSegment,
                    {
                      flex: data.issueStats.closed,
                      backgroundColor: '#8250df',
                      borderTopRightRadius: 4,
                      borderBottomRightRadius: 4,
                    },
                  ]}
                />
              </View>
              <View style={styles.ratioLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#1a7f37' }]} />
                  <Text style={styles.legendText}>Open ({data.issueStats.open})</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#8250df' }]} />
                  <Text style={styles.legendText}>Closed ({data.issueStats.closed})</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>No issue data available</Text>
          )}
        </View>

        {/* Language Breakdown */}
        {sortedLangs.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.langBar}>
              {sortedLangs.map(([lang, count], i) => (
                <View
                  key={lang}
                  style={[
                    styles.langSegment,
                    {
                      flex: count,
                      backgroundColor: LANG_COLORS[lang] || LANG_COLORS.Unknown,
                      borderTopLeftRadius: i === 0 ? 4 : 0,
                      borderBottomLeftRadius: i === 0 ? 4 : 0,
                      borderTopRightRadius: i === sortedLangs.length - 1 ? 4 : 0,
                      borderBottomRightRadius: i === sortedLangs.length - 1 ? 4 : 0,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.langLegend}>
              {sortedLangs.map(([lang, count]) => (
                <View key={lang} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: LANG_COLORS[lang] || LANG_COLORS.Unknown },
                    ]}
                  />
                  <Text style={styles.legendText}>
                    {lang} ({Math.round((count / totalLangRepos) * 100)}%)
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Repositories */}
        {data.topRepos.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Repositories</Text>
            {data.topRepos.map((repo, i) => (
              <View key={i} style={[styles.repoRow, i > 0 && styles.repoRowBorder]}>
                <View style={styles.repoInfo}>
                  <View style={styles.repoNameRow}>
                    <Text style={styles.repoName} numberOfLines={1}>{repo.name}</Text>
                    {repo.isPrivate && (
                      <View style={styles.privateBadge}>
                        <Text style={styles.privateBadgeText}>Private</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.repoMeta}>
                    <View
                      style={[
                        styles.langDot,
                        { backgroundColor: LANG_COLORS[repo.language] || LANG_COLORS.Unknown },
                      ]}
                    />
                    <Text style={styles.repoMetaText}>{repo.language}</Text>
                    <Text style={styles.repoMetaText}>Stars: {repo.stars}</Text>
                    <Text style={styles.repoMetaText}>Forks: {repo.forks}</Text>
                  </View>
                </View>
                {repo.openIssues > 0 && (
                  <View style={styles.openIssuesBadge}>
                    <Text style={styles.openIssuesBadgeText}>{repo.openIssues}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        {activitySummary.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {activitySummary.map((item, i) => (
              <View key={i} style={[styles.activityRow, i > 0 && styles.activityRowBorder]}>
                <View style={[styles.activityDot, { backgroundColor: item.color }]} />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityText} numberOfLines={2}>{item.text}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ─── Header ───────────────────────────────────────────────── */

const Header: React.FC<{ onMenuPress: () => void }> = ({ onMenuPress }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <View style={styles.menuLine} />
      <View style={[styles.menuLine, { width: 16 }]} />
      <View style={styles.menuLine} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Analytics</Text>
    <View style={{ width: 32 }} />
  </View>
);

/* ─── Stat Card ──────────────────────────────────────────── */

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, { color }]}>{formatNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/* ─── Helpers ─────────────────────────────────────────────── */

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function summarizeActivity(events: any[]): { text: string; color: string; time: string }[] {
  const summary: { text: string; color: string; time: string }[] = [];
  for (const event of events.slice(0, 10)) {
    let text = '';
    let color = '#656d76';
    switch (event.type) {
      case 'PushEvent':
        text = `Pushed ${event.payload?.commits?.length || 0} commit(s) to ${event.repo?.name || 'repo'}`;
        color = '#1a7f37';
        break;
      case 'IssuesEvent':
        text = `${event.payload?.action || 'Updated'} issue in ${event.repo?.name || 'repo'}`;
        color = '#bf8700';
        break;
      case 'PullRequestEvent':
        text = `${event.payload?.action || 'Updated'} PR in ${event.repo?.name || 'repo'}`;
        color = '#0969da';
        break;
      case 'IssueCommentEvent':
        text = `Commented on issue in ${event.repo?.name || 'repo'}`;
        color = '#656d76';
        break;
      case 'CreateEvent':
        text = `Created ${event.payload?.ref_type || 'ref'} in ${event.repo?.name || 'repo'}`;
        color = '#8250df';
        break;
      case 'WatchEvent':
        text = `Starred ${event.repo?.name || 'repo'}`;
        color = '#bf8700';
        break;
      case 'ForkEvent':
        text = `Forked ${event.repo?.name || 'repo'}`;
        color = '#0969da';
        break;
      case 'DeleteEvent':
        text = `Deleted ${event.payload?.ref_type || 'ref'} in ${event.repo?.name || 'repo'}`;
        color = '#cf222e';
        break;
      default:
        text = `${event.type?.replace('Event', '')} in ${event.repo?.name || 'repo'}`;
        break;
    }
    const time = getTimeAgo(event.created_at);
    summary.push({ text, color, time });
  }
  return summary;
}

function getTimeAgo(dateString: string): string {
  const now = Date.now();
  const diff = now - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#656d76' },
  errorText: { fontSize: 15, color: '#cf222e', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#0969da',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

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
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1f2328' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    gap: 14,
  },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f6f8fa' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '600', color: '#1f2328' },
  profileLogin: { fontSize: 13, color: '#656d76', marginTop: 2 },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#656d76', marginTop: 4, fontWeight: '500' },

  // Section Card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2328',
    marginBottom: 12,
  },
  emptyText: { fontSize: 13, color: '#8c959f' },

  // Ratio Bar
  ratioBar: { flexDirection: 'row', height: 10, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  ratioSegment: { height: 10 },
  ratioLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#656d76' },

  // Language Bar
  langBar: { flexDirection: 'row', height: 10, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  langSegment: { height: 10 },
  langLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 6 },
  langDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },

  // Repos
  repoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  repoRowBorder: { borderTopWidth: 1, borderTopColor: '#f0f2f4' },
  repoInfo: { flex: 1, marginRight: 8 },
  repoNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repoName: { fontSize: 14, fontWeight: '500', color: '#0969da', flex: 1 },
  privateBadge: {
    backgroundColor: '#fff8c5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d4a72c',
  },
  privateBadgeText: { fontSize: 10, color: '#9a6700', fontWeight: '600' },
  repoMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  repoMetaText: { fontSize: 12, color: '#656d76' },
  openIssuesBadge: {
    backgroundColor: '#dafbe1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  openIssuesBadgeText: { fontSize: 12, fontWeight: '600', color: '#1a7f37' },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 10,
  },
  activityRowBorder: { borderTopWidth: 1, borderTopColor: '#f0f2f4' },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  activityInfo: { flex: 1 },
  activityText: { fontSize: 13, color: '#1f2328', lineHeight: 18 },
  activityTime: { fontSize: 11, color: '#8c959f', marginTop: 2 },
});

export default AnalyticsScreen;
