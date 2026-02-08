import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Linking, TextInput, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { GitHubService } from '../services/GitHubService';
import type { NormalizedIssue } from '../types';
import { logger } from '../utils/logger';

interface IssueDetailModalProps {
  visible: boolean;
  issue: NormalizedIssue | null;
  onClose: () => void;
  onIssueUpdated: (updatedIssue: NormalizedIssue) => void;
  orgMembers?: string[];
}

const githubService = new GitHubService();

const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  visible, issue, onClose, onIssueUpdated, orgMembers,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [repoLabels, setRepoLabels] = useState<string[]>([]);

  const repoParts = useMemo(() => {
    if (!issue) return { owner: '', repo: '' };
    const [owner, repo] = issue.repo.split('/');
    return { owner: owner || '', repo: repo || '' };
  }, [issue]);

  useEffect(() => {
    if (visible && issue) {
      loadComments();
      loadRepoLabels();
    } else {
      setComments([]);
      setNewComment('');
      setShowCommentInput(false);
    }
  }, [visible, issue?.issueId]);

  const loadComments = async () => {
    if (!issue) return;
    setCommentsLoading(true);
    try {
      const data = await githubService.getIssueComments(repoParts.owner, repoParts.repo, issue.number);
      setComments(data);
    } catch (e) {
      logger.warn('Failed to load comments', e);
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadRepoLabels = async () => {
    if (!issue) return;
    try {
      const labels = await githubService.getRepoLabels(repoParts.owner, repoParts.repo);
      setRepoLabels(labels.map(l => l.name));
    } catch (e) {
      logger.warn('Failed to load labels', e);
    }
  };

  const handleToggleState = useCallback(async () => {
    if (!issue) return;
    const newState = issue.state === 'open' ? 'closed' : 'open';
    setActionLoading('state');
    try {
      await githubService.updateIssueState(repoParts.owner, repoParts.repo, issue.number, newState);
      onIssueUpdated({ ...issue, state: newState });
      Alert.alert('Updated', `Issue ${newState === 'closed' ? 'closed' : 'reopened'}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update issue state');
    } finally {
      setActionLoading(null);
    }
  }, [issue, repoParts, onIssueUpdated]);

  const handleAssign = useCallback(async (login: string) => {
    if (!issue) return;
    setActionLoading('assign');
    try {
      const currentAssignees = issue.assignees.map(a => a.login);
      const newAssignees = currentAssignees.includes(login)
        ? currentAssignees.filter(a => a !== login)
        : [...currentAssignees, login];
      await githubService.assignIssue(repoParts.owner, repoParts.repo, issue.number, newAssignees);
      const updatedAssignees = newAssignees.map(l => {
        const existing = issue.assignees.find(a => a.login === l);
        return existing || { id: 0, login: l, name: l, avatar_url: '', email: '' };
      });
      onIssueUpdated({ ...issue, assignees: updatedAssignees });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update assignees');
    } finally {
      setActionLoading(null);
    }
  }, [issue, repoParts, onIssueUpdated]);

  const handleToggleLabel = useCallback(async (labelName: string) => {
    if (!issue) return;
    setActionLoading('labels');
    try {
      const currentLabels = issue.labels.map(l => l.name);
      const newLabels = currentLabels.includes(labelName)
        ? currentLabels.filter(l => l !== labelName)
        : [...currentLabels, labelName];
      await githubService.updateLabels(repoParts.owner, repoParts.repo, issue.number, newLabels);
      onIssueUpdated({
        ...issue,
        labels: newLabels.map(name => {
          const existing = issue.labels.find(l => l.name === name);
          return existing || { name, color: '666666' };
        }),
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update labels');
    } finally {
      setActionLoading(null);
    }
  }, [issue, repoParts, onIssueUpdated]);

  const handleAddComment = useCallback(async () => {
    if (!issue || !newComment.trim()) return;
    setActionLoading('comment');
    try {
      await githubService.addComment(repoParts.owner, repoParts.repo, issue.number, newComment.trim());
      setNewComment('');
      setShowCommentInput(false);
      loadComments();
      Alert.alert('Done', 'Comment added');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add comment');
    } finally {
      setActionLoading(null);
    }
  }, [issue, newComment, repoParts]);

  const handleOpenOnGitHub = useCallback(() => {
    if (issue?.url) Linking.openURL(issue.url);
  }, [issue]);

  if (!issue) return null;

  const isOpen = issue.state === 'open';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>#{issue.number}</Text>
          <TouchableOpacity onPress={handleOpenOnGitHub} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>GitHub</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Title + Meta */}
          <Text style={styles.title}>{issue.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.repoLink}>{issue.repo}</Text>
            <View style={[styles.stateBadge, isOpen ? styles.stateOpen : styles.stateClosed]}>
              <Text style={[styles.stateText, isOpen ? styles.stateTextOpen : styles.stateTextClosed]}>
                {issue.state}
              </Text>
            </View>
          </View>

          {/* Labels */}
          {issue.labels.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Labels</Text>
              <View style={styles.labelsRow}>
                {issue.labels.map((label, i) => (
                  <View
                    key={i}
                    style={[styles.label, { backgroundColor: `#${label.color}18`, borderColor: `#${label.color}` }]}
                  >
                    <View style={[styles.labelDot, { backgroundColor: `#${label.color}` }]} />
                    <Text style={styles.labelName}>{label.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Assignees */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignees</Text>
            {issue.assignees.length > 0 ? (
              <View style={styles.assigneesRow}>
                {issue.assignees.map((a, i) => (
                  <View key={i} style={styles.assigneePill}>
                    {a.avatar_url ? (
                      <Image source={{ uri: a.avatar_url }} style={styles.assigneeImg} />
                    ) : null}
                    <Text style={styles.assigneeName}>{a.login}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.dimText}>No one assigned</Text>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            {issue.body ? (
              <Text style={styles.bodyText}>{issue.body}</Text>
            ) : (
              <Text style={styles.dimText}>No description provided</Text>
            )}
          </View>

          {/* Comments */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Comments {commentsLoading ? '' : `(${comments.length})`}
            </Text>
            {commentsLoading ? (
              <ActivityIndicator size="small" color="#0969da" />
            ) : comments.length > 0 ? (
              comments.map((c, i) => (
                <View key={i} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{c.user?.login || 'unknown'}</Text>
                    <Text style={styles.commentDate}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.commentBody}>{c.body}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.dimText}>No comments yet</Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.actionsTitle}>Actions</Text>

            {/* Assign */}
            {orgMembers && orgMembers.length > 0 && (
              <View style={styles.actionGroup}>
                <Text style={styles.actionLabel}>Assign / Unassign</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.actionRow}>
                    {orgMembers.slice(0, 10).map((m) => {
                      const isAssigned = issue.assignees.some(a => a.login === m);
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.actionBtn, isAssigned && styles.actionBtnActive]}
                          onPress={() => handleAssign(m)}
                          disabled={actionLoading === 'assign'}
                        >
                          <Text style={[styles.actionBtnText, isAssigned && styles.actionBtnTextActive]}>
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Labels */}
            {repoLabels.length > 0 && (
              <View style={styles.actionGroup}>
                <Text style={styles.actionLabel}>Labels</Text>
                <View style={styles.labelsRow}>
                  {repoLabels.slice(0, 15).map((name) => {
                    const isActive = issue.labels.some(l => l.name === name);
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[styles.labelToggle, isActive && styles.labelToggleActive]}
                        onPress={() => handleToggleLabel(name)}
                        disabled={actionLoading === 'labels'}
                      >
                        <Text style={[styles.labelToggleText, isActive && styles.labelToggleTextActive]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Close / Reopen */}
            <TouchableOpacity
              style={[styles.stateBtn, isOpen ? styles.closeBtnStyle : styles.reopenBtnStyle]}
              onPress={handleToggleState}
              disabled={actionLoading === 'state'}
            >
              {actionLoading === 'state' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.stateBtnText}>
                  {isOpen ? 'Close Issue' : 'Reopen Issue'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Comment */}
            {showCommentInput ? (
              <View style={styles.commentInputGroup}>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  placeholder="Write a comment..."
                  placeholderTextColor="#8c959f"
                  value={newComment}
                  onChangeText={setNewComment}
                  autoFocus
                />
                <View style={styles.commentActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => { setShowCommentInput(false); setNewComment(''); }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, !newComment.trim() && styles.submitBtnDisabled]}
                    onPress={handleAddComment}
                    disabled={!newComment.trim() || actionLoading === 'comment'}
                  >
                    {actionLoading === 'comment' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addCommentBtn}
                onPress={() => setShowCommentInput(true)}
              >
                <Text style={styles.addCommentBtnText}>Add Comment</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
    backgroundColor: '#fff',
  },
  headerBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  headerBtnText: { fontSize: 15, color: '#0969da', fontWeight: '500' },
  headerTitle: { fontSize: 15, color: '#656d76', fontWeight: '500', flex: 1, textAlign: 'center' },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 20, fontWeight: '600', color: '#1f2328', lineHeight: 28, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  repoLink: { fontSize: 14, color: '#0969da', fontWeight: '500' },
  stateBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  stateOpen: { backgroundColor: '#dafbe1' },
  stateClosed: { backgroundColor: '#fbefff' },
  stateText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  stateTextOpen: { color: '#1a7f37' },
  stateTextClosed: { color: '#8250df' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#656d76',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  labelDot: { width: 6, height: 6, borderRadius: 3 },
  labelName: { fontSize: 12, fontWeight: '500', color: '#1f2328' },
  assigneesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  assigneePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d0d7de',
    gap: 6,
  },
  assigneeImg: { width: 20, height: 20, borderRadius: 10 },
  assigneeName: { fontSize: 13, color: '#1f2328', fontWeight: '500' },
  dimText: { fontSize: 14, color: '#8c959f' },
  bodyText: { fontSize: 15, color: '#1f2328', lineHeight: 22 },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#1f2328' },
  commentDate: { fontSize: 12, color: '#656d76' },
  commentBody: { fontSize: 14, color: '#1f2328', lineHeight: 20 },
  actionsSection: {
    borderTopWidth: 1,
    borderTopColor: '#e1e4e8',
    paddingTop: 20,
    marginTop: 8,
  },
  actionsTitle: { fontSize: 15, fontWeight: '600', color: '#1f2328', marginBottom: 16 },
  actionGroup: { marginBottom: 20 },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#656d76',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  actionBtnActive: { backgroundColor: '#0969da', borderColor: '#0969da' },
  actionBtnText: { fontSize: 13, color: '#1f2328' },
  actionBtnTextActive: { color: '#fff', fontWeight: '600' },
  labelToggle: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d7de',
    marginBottom: 4,
  },
  labelToggleActive: { backgroundColor: '#ddf4ff', borderColor: '#0969da' },
  labelToggleText: { fontSize: 12, color: '#1f2328' },
  labelToggleTextActive: { color: '#0969da', fontWeight: '600' },
  stateBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  closeBtnStyle: { backgroundColor: '#cf222e' },
  reopenBtnStyle: { backgroundColor: '#1a7f37' },
  stateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  addCommentBtn: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  addCommentBtnText: { fontSize: 14, color: '#1f2328', fontWeight: '500' },
  commentInputGroup: { marginBottom: 12 },
  commentInput: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    color: '#1f2328',
    textAlignVertical: 'top',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  commentActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelBtnText: { color: '#656d76', fontSize: 14 },
  submitBtn: { backgroundColor: '#0969da', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default IssueDetailModal;
