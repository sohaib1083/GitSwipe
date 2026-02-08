import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Image,
  Pressable, ActivityIndicator, Animated, Easing,
} from 'react-native';
import type { NormalizedIssue } from '../types';
import { getIssueSummary } from '../services/GroqService';

const SCREEN_WIDTH = Dimensions.get('window').width;
export const CARD_WIDTH = SCREEN_WIDTH - 32;

/* ─── Shimmer loader component ───────────────────────── */
const ShimmerLoader: React.FC = () => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={shimStyles.container}>
      <View style={shimStyles.row}>
        <ActivityIndicator size="small" color="#8250df" />
        <Text style={shimStyles.label}>Generating summary...</Text>
      </View>
      <Animated.View style={[shimStyles.line1, { opacity }]} />
      <Animated.View style={[shimStyles.line2, { opacity }]} />
    </View>
  );
};

const shimStyles = StyleSheet.create({
  container: {
    backgroundColor: '#f6f0ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d8d0f0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8250df',
  },
  line1: {
    height: 10,
    width: '90%',
    backgroundColor: '#d8d0f0',
    borderRadius: 5,
    marginBottom: 6,
  },
  line2: {
    height: 10,
    width: '65%',
    backgroundColor: '#d8d0f0',
    borderRadius: 5,
  },
});

/* ─── IssueCard ──────────────────────────────────────── */

interface IssueCardProps {
  issue: NormalizedIssue;
  onPress?: () => void;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, onPress }) => {
  const isOpen = issue.state === 'open';
  const timeAgo = getTimeAgo(issue.updatedAt);

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  const handleAISummary = useCallback(async () => {
    if (summary || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const result = await getIssueSummary(
        issue.title,
        issue.body || '',
        issue.labels.map(l => l.name),
        issue.repo,
      );
      setSummary(result);
    } catch {
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }, [issue, summary, summaryLoading]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress ? styles.cardPressed : null,
      ]}
    >
      {/* Header: Repo + State Badge */}
      <View style={styles.header}>
        <View style={styles.repoRow}>
          {issue.user?.avatar_url ? (
            <Image source={{ uri: issue.user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
          <Text style={styles.repoText} numberOfLines={1}>{issue.repo}</Text>
        </View>
        <View style={[styles.stateBadge, isOpen ? styles.stateOpen : styles.stateClosed]}>
          <View style={[styles.stateDot, isOpen ? styles.stateDotOpen : styles.stateDotClosed]} />
          <Text style={[styles.stateText, isOpen ? styles.stateTextOpen : styles.stateTextClosed]}>
            {issue.state}
          </Text>
        </View>
      </View>

      {/* Issue Number + Title */}
      <View style={styles.titleSection}>
        <Text style={styles.issueNumber}>#{issue.number}</Text>
        <Text style={styles.title} numberOfLines={3}>{issue.title}</Text>
      </View>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <View style={styles.labelsRow}>
          {issue.labels.slice(0, 4).map((label, i) => (
            <View
              key={i}
              style={[
                styles.label,
                { backgroundColor: `#${label.color}20`, borderColor: `#${label.color}` },
              ]}
            >
              <Text style={[styles.labelText, { color: `#${label.color}` }]} numberOfLines={1}>
                {label.name}
              </Text>
            </View>
          ))}
          {issue.labels.length > 4 && (
            <View style={styles.labelMore}>
              <Text style={styles.labelMoreText}>+{issue.labels.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {/* AI Summary: Shimmer / Result / Button */}
      {summaryLoading ? (
        <ShimmerLoader />
      ) : summary ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>AI Summary</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      ) : (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleAISummary();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.aiButton,
            pressed && styles.aiButtonPressed,
          ]}
        >
          <Text style={styles.aiButtonIcon}>✦</Text>
          <Text style={styles.aiButtonText}>
            {summaryError ? 'Retry Summary' : 'AI Summary'}
          </Text>
        </Pressable>
      )}

      {/* Description */}
      {issue.body ? (
        <Text style={styles.body} numberOfLines={summary ? 2 : 3}>
          {issue.body.replace(/\r?\n/g, ' ').replace(/#{1,6}\s/g, '').trim()}
        </Text>
      ) : (
        <Text style={styles.bodyEmpty}>No description provided.</Text>
      )}

      {/* Footer: Assignees + Meta */}
      <View style={styles.footer}>
        <View style={styles.assigneesRow}>
          {issue.assignees.slice(0, 3).map((a, i) => (
            a.avatar_url ? (
              <Image
                key={i}
                source={{ uri: a.avatar_url }}
                style={[styles.assigneeAvatar, i > 0 && { marginLeft: -8 }]}
              />
            ) : (
              <View
                key={i}
                style={[styles.assigneeAvatarPlaceholder, i > 0 && { marginLeft: -8 }]}
              >
                <Text style={styles.assigneeInitial}>
                  {a.login.charAt(0).toUpperCase()}
                </Text>
              </View>
            )
          ))}
          {issue.assignees.length > 3 && (
            <Text style={styles.moreAssignees}>+{issue.assignees.length - 3}</Text>
          )}
        </View>
        <View style={styles.metaRow}>
          {issue.commentCount > 0 && (
            <Text style={styles.metaText}>{issue.commentCount} comments</Text>
          )}
          <Text style={styles.metaText}>{timeAgo}</Text>
        </View>
      </View>
    </Pressable>
  );
};

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

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#1f2328',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  repoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f6f8fa',
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d0d7de',
  },
  repoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0969da',
    flex: 1,
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  stateOpen: { backgroundColor: '#dafbe1' },
  stateClosed: { backgroundColor: '#fbefff' },
  stateDot: { width: 7, height: 7, borderRadius: 3.5 },
  stateDotOpen: { backgroundColor: '#1a7f37' },
  stateDotClosed: { backgroundColor: '#8250df' },
  stateText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  stateTextOpen: { color: '#1a7f37' },
  stateTextClosed: { color: '#8250df' },
  titleSection: { marginBottom: 12 },
  issueNumber: {
    fontSize: 12,
    color: '#656d76',
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2328',
    lineHeight: 24,
  },
  labelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  label: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  labelText: { fontSize: 11, fontWeight: '600' },
  labelMore: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#f6f8fa',
  },
  labelMoreText: { fontSize: 11, color: '#656d76', fontWeight: '600' },

  // Card pressed
  cardPressed: {
    opacity: 0.96,
  },

  // AI Summary
  aiButton: {
    backgroundColor: '#f0f0ff',
    borderWidth: 1,
    borderColor: '#c8c8ff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    minHeight: 40,
  },
  aiButtonPressed: {
    backgroundColor: '#e4e0ff',
    borderColor: '#a8a0df',
  },
  aiButtonIcon: {
    fontSize: 14,
    color: '#8250df',
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5a4fcf',
  },
  summaryBox: {
    backgroundColor: '#f6f0ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d8d0f0',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8250df',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: '#1f2328',
    lineHeight: 18,
  },

  body: {
    fontSize: 14,
    color: '#656d76',
    lineHeight: 20,
    marginBottom: 16,
  },
  bodyEmpty: {
    fontSize: 14,
    color: '#8c959f',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f2f4',
    paddingTop: 14,
  },
  assigneesRow: { flexDirection: 'row', alignItems: 'center' },
  assigneeAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#f6f8fa',
  },
  assigneeAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#0969da',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeInitial: { fontSize: 11, fontWeight: '700', color: '#fff' },
  moreAssignees: { fontSize: 11, color: '#656d76', marginLeft: 4, fontWeight: '500' },
  metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metaText: { fontSize: 12, color: '#8c959f', fontWeight: '400' },
});

export default IssueCard;
