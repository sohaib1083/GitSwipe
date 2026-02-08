import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { handleError } from '../utils/errors';
import type {
  GitHubUser,
  GitHubOrg,
  GitHubRepo,
  GitHubProject,
  GitHubLabel,
  NormalizedIssue,
  PaginatedResponse,
  ProjectStatusOption,
} from '../types';

// ─── Token Management ──────────────────────────────────────

let githubAccessToken: string | null = null;

export function setGitHubAccessToken(token: string): void {
  githubAccessToken = token;
  AsyncStorage.setItem('github_access_token', token).catch((error) => {
    logger.warn('Failed to persist access token', error);
  });
  logger.info('GitHub access token updated');
}

export async function getStoredAccessToken(): Promise<string | null> {
  if (githubAccessToken) return githubAccessToken;
  try {
    const storedToken = await AsyncStorage.getItem('github_access_token');
    if (storedToken) {
      githubAccessToken = storedToken;
      logger.debug('Retrieved access token from storage');
    }
    return storedToken;
  } catch (error) {
    logger.warn('Failed to get stored access token', error);
    return null;
  }
}

export function clearGitHubAccessToken(): void {
  githubAccessToken = null;
  AsyncStorage.removeItem('github_access_token').catch((error) => {
    logger.warn('Failed to clear access token', error);
  });
  cache.clear();
}

// ─── Service Class ─────────────────────────────────────────

export class GitHubService {
  private async getAccessToken(): Promise<string> {
    if (!githubAccessToken) {
      const storedToken = await getStoredAccessToken();
      if (!storedToken) {
        throw new Error('GitHub access token not set. Please re-authenticate.');
      }
    }
    return githubAccessToken!;
  }

  private async apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'GitSwipe-Mobile-App',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) throw new Error('GitHub API authentication failed. Please re-login.');
      if (response.status === 403) throw new Error('GitHub API access forbidden. Check token permissions.');
      if (response.status === 404) throw new Error('GitHub API resource not found.');
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private async graphqlRequest(query: string, variables: Record<string, any> = {}): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'GitSwipe-Mobile-App',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`GraphQL request failed: ${response.status}`);
    return response.json();
  }

  // ─── User / Org / Repo ─────────────────────────────────────

  async getCurrentUser(): Promise<GitHubUser> {
    return this.apiRequest<GitHubUser>('/user');
  }

  async getUserOrgs(): Promise<GitHubOrg[]> {
    return this.apiRequest<GitHubOrg[]>('/user/orgs');
  }

  async getUserRepos(page: number = 1, perPage: number = 100): Promise<GitHubRepo[]> {
    return this.apiRequest<GitHubRepo[]>(
      `/user/repos?sort=updated&per_page=${perPage}&page=${page}&type=all`
    );
  }

  async getOrgRepos(org: string): Promise<GitHubRepo[]> {
    return this.apiRequest<GitHubRepo[]>(`/orgs/${org}/repos?sort=updated&per_page=100`);
  }

  async getOrgMembers(org: string): Promise<GitHubUser[]> {
    return this.apiRequest<GitHubUser[]>(`/orgs/${org}/members`);
  }

  async getRepoLabels(owner: string, repo: string): Promise<GitHubLabel[]> {
    return this.apiRequest<GitHubLabel[]>(`/repos/${owner}/${repo}/labels?per_page=100`);
  }

  // ─── Issue Fetching ────────────────────────────────────────

  async fetchAllIssues(
    page: number = 1,
    perPage: number = 20,
    state: 'open' | 'closed' = 'open',
    sort: string = 'updated',
    direction: string = 'desc',
    repo?: string,
    labels?: string[],
    searchQuery?: string,
  ): Promise<PaginatedResponse<NormalizedIssue>> {
    // Default: show issues assigned to the current user
    const user = await this.getCurrentUser();
    let q = `is:issue state:${state} assignee:${user.login}`;
    if (repo) q += ` repo:${repo}`;
    if (labels && labels.length > 0) q += ` ${labels.map(l => `label:"${l}"`).join(' ')}`;
    if (searchQuery) q += ` ${searchQuery}`;

    const encoded = encodeURIComponent(q);
    const data = await this.apiRequest<any>(
      `/search/issues?q=${encoded}&sort=${sort}&order=${direction}&page=${page}&per_page=${perPage}`
    );

    return {
      items: (data.items || []).map((i: any) => this.normalizeSearchIssue(i)),
      totalCount: data.total_count || 0,
      hasNextPage: (data.items || []).length === perPage,
    };
  }

  async fetchOrgIssues(
    org: string,
    page: number = 1,
    perPage: number = 20,
    state: 'open' | 'closed' = 'open',
    sort: string = 'updated',
    direction: string = 'desc',
    repo?: string,
    assignee?: string,
    labels?: string[],
    searchQuery?: string,
  ): Promise<PaginatedResponse<NormalizedIssue>> {
    let q = `is:issue state:${state}`;
    if (repo) {
      q += ` repo:${repo}`;
    } else {
      q += ` org:${org}`;
    }
    if (assignee === 'me') {
      const user = await this.getCurrentUser();
      q += ` assignee:${user.login}`;
    } else if (assignee === 'unassigned') {
      q += ` no:assignee`;
    } else if (assignee && assignee !== 'all') {
      q += ` assignee:${assignee}`;
    }
    if (labels && labels.length > 0) q += ` ${labels.map(l => `label:"${l}"`).join(' ')}`;
    if (searchQuery) q += ` ${searchQuery}`;

    const encoded = encodeURIComponent(q);
    const data = await this.apiRequest<any>(
      `/search/issues?q=${encoded}&sort=${sort}&order=${direction}&page=${page}&per_page=${perPage}`
    );

    return {
      items: (data.items || []).map((i: any) => this.normalizeSearchIssue(i)),
      totalCount: data.total_count || 0,
      hasNextPage: (data.items || []).length === perPage,
    };
  }

  async fetchProjectIssues(
    owner: string,
    projectNumber: number,
    cursor?: string,
    perPage: number = 50,
    statusFilter?: string,
    assigneeFilter?: string,
    repoFilter?: string,
  ): Promise<PaginatedResponse<NormalizedIssue> & { endCursor?: string }> {
    const query = `
      query($owner: String!, $number: Int!, $first: Int!, $after: String) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            title
            items(first: $first, after: $after) {
              totalCount
              pageInfo { endCursor hasNextPage }
              nodes {
                id
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { id name } }
                    }
                  }
                }
                content {
                  ... on Issue {
                    id number title body state url createdAt updatedAt
                    labels(first: 20) { nodes { name color } }
                    assignees(first: 10) { nodes { id login name avatarUrl email } }
                    author { login avatarUrl }
                    repository { name nameWithOwner owner { login } }
                    comments { totalCount }
                  }
                }
              }
            }
          }
        }
      }
    `;

    let result: any;
    try {
      result = await this.graphqlRequest(query, {
        owner, number: projectNumber, first: perPage, after: cursor || null,
      });
      // If organization query returned null, try as user
      const projectData = result.data?.organization?.projectV2;
      if (!projectData && !result.errors) {
        throw new Error('Not found as organization');
      }
    } catch {
      // Retry as user-owned project
      const userQuery = query.replace('organization(login: $owner)', 'user(login: $owner)');
      result = await this.graphqlRequest(userQuery, {
        owner, number: projectNumber, first: perPage, after: cursor || null,
      });
    }

    if (result.errors) {
      logger.warn('GraphQL errors fetching project issues', result.errors);
      return { items: [], totalCount: 0, hasNextPage: false };
    }

    const projectData = result.data?.organization?.projectV2 || result.data?.user?.projectV2;
    if (!projectData) return { items: [], totalCount: 0, hasNextPage: false };

    const itemsData = projectData.items;
    const issues: NormalizedIssue[] = [];

    for (const node of (itemsData.nodes || [])) {
      const content = node.content;
      if (!content || !content.number) continue;

      let statusValue = '';
      let statusFieldId = '';
      for (const fv of (node.fieldValues?.nodes || [])) {
        if (fv?.name && fv?.field?.name?.toLowerCase().includes('status')) {
          statusValue = fv.name;
          statusFieldId = fv.field.id;
        }
      }

      if (statusFilter && statusFilter !== 'all' && statusValue.toLowerCase() !== statusFilter.toLowerCase()) continue;
      if (repoFilter && content.repository?.nameWithOwner !== repoFilter) continue;
      if (assigneeFilter) {
        const logins = (content.assignees?.nodes || []).map((a: any) => a.login);
        if (assigneeFilter === 'unassigned' && logins.length > 0) continue;
        if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && !logins.includes(assigneeFilter)) continue;
      }

      issues.push({
        issueId: content.number,
        nodeId: content.id,
        title: content.title,
        body: content.body || '',
        repo: content.repository?.nameWithOwner || '',
        org: content.repository?.owner?.login || owner,
        url: content.url,
        state: content.state?.toLowerCase() === 'open' ? 'open' : 'closed',
        labels: (content.labels?.nodes || []).map((l: any) => ({ name: l.name, color: l.color })),
        assignees: (content.assignees?.nodes || []).map((a: any) => ({
          id: a.id || 0, login: a.login, name: a.name || a.login,
          avatar_url: a.avatarUrl || '', email: a.email || '',
        })),
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        commentCount: content.comments?.totalCount || 0,
        number: content.number,
        user: {
          id: 0, login: content.author?.login || '',
          name: content.author?.login || '', avatar_url: content.author?.avatarUrl || '', email: '',
        },
        project: {
          projectId: projectData.id, projectTitle: projectData.title,
          statusFieldId, statusValue, itemId: node.id,
        },
      });
    }

    return {
      items: issues,
      totalCount: itemsData.totalCount || 0,
      hasNextPage: itemsData.pageInfo?.hasNextPage || false,
      endCursor: itemsData.pageInfo?.endCursor,
    };
  }

  // ─── Projects ──────────────────────────────────────────────

  async getOrgProjects(org: string): Promise<GitHubProject[]> {
    try {
      const query = `
        query($org: String!) {
          organization(login: $org) {
            projectsV2(first: 20) {
              nodes {
                id number title url
                fields(first: 30) {
                  nodes {
                    ... on ProjectV2SingleSelectField { id name dataType options { id name } }
                    ... on ProjectV2Field { id name dataType }
                  }
                }
              }
            }
          }
        }
      `;
      const result = await this.graphqlRequest(query, { org });
      if (result.errors) {
        if (result.errors.some((e: any) => e.type === 'INSUFFICIENT_SCOPES')) {
          logger.warn('Token lacks project scope', { org });
          return [];
        }
        return [];
      }
      return (result.data?.organization?.projectsV2?.nodes || []).map((p: any) => ({
        ...p, owner: org, fields: (p.fields?.nodes || []).filter((f: any) => f.id),
      }));
    } catch (error) {
      logger.warn('Error fetching org projects', error);
      return [];
    }
  }

  async getUserProjects(): Promise<GitHubProject[]> {
    try {
      const query = `
        query {
          viewer {
            login
            projectsV2(first: 20) {
              nodes {
                id number title url
                fields(first: 30) {
                  nodes {
                    ... on ProjectV2SingleSelectField { id name dataType options { id name } }
                    ... on ProjectV2Field { id name dataType }
                  }
                }
              }
            }
          }
        }
      `;
      const result = await this.graphqlRequest(query);
      if (result.errors) return [];
      const login = result.data?.viewer?.login || '';
      return (result.data?.viewer?.projectsV2?.nodes || []).map((p: any) => ({
        ...p, owner: login, fields: (p.fields?.nodes || []).filter((f: any) => f.id),
      }));
    } catch (error) {
      logger.warn('Error fetching user projects', error);
      return [];
    }
  }

  async getViewerAccessibleProjects(): Promise<GitHubProject[]> {
    // Search for recently accessed projects via the viewer's repositories.
    // This catches projects in orgs that don't appear in /user/orgs.
    try {
      const query = `
        query {
          viewer {
            login
            repositories(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
              nodes {
                owner { login }
                name
                nameWithOwner
                projectsV2(first: 10) {
                  nodes {
                    id number title url
                    fields(first: 30) {
                      nodes {
                        ... on ProjectV2SingleSelectField { id name dataType options { id name } }
                        ... on ProjectV2Field { id name dataType }
                      }
                    }
                    owner {
                      ... on Organization { login }
                      ... on User { login }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const result = await this.graphqlRequest(query);
      if (result.errors) {
        logger.warn('GraphQL errors in getViewerAccessibleProjects', result.errors);
        return [];
      }

      const allProjects: GitHubProject[] = [];
      const seenIds = new Set<string>();

      for (const repo of (result.data?.viewer?.repositories?.nodes || [])) {
        for (const p of (repo.projectsV2?.nodes || [])) {
          if (!p || seenIds.has(p.id)) continue;
          seenIds.add(p.id);
          allProjects.push({
            ...p,
            owner: p.owner?.login || repo.owner?.login || '',
            fields: (p.fields?.nodes || []).filter((f: any) => f.id),
          });
        }
      }

      return allProjects;
    } catch (error) {
      logger.warn('Error fetching viewer accessible projects', error);
      return [];
    }
  }

  getProjectStatusOptions(project: GitHubProject): ProjectStatusOption[] {
    const statusField = project.fields?.find(f => f.name?.toLowerCase().includes('status'));
    if (!statusField?.options?.length) return [];
    return statusField.options.map(o => ({ id: o.id, name: o.name }));
  }

  getProjectStatusFieldId(project: GitHubProject): string | undefined {
    return project.fields?.find(f => f.name?.toLowerCase().includes('status'))?.id;
  }

  // ─── Issue Actions ─────────────────────────────────────────

  async updateIssueState(owner: string, repo: string, issueNumber: number, state: 'open' | 'closed'): Promise<any> {
    return this.apiRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
  }

  async assignIssue(owner: string, repo: string, issueNumber: number, assignees: string[]): Promise<any> {
    return this.apiRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignees }),
    });
  }

  async updateLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<any> {
    return this.apiRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels }),
    });
  }

  async addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<any> {
    return this.apiRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }

  async getIssueComments(owner: string, repo: string, issueNumber: number): Promise<any[]> {
    return this.apiRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
  }

  async updateProjectItemStatus(
    projectId: string, itemId: string, fieldId: string, optionId: string,
  ): Promise<any> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(
          input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }
        ) { projectV2Item { id } }
      }
    `;
    return this.graphqlRequest(mutation, {
      projectId, itemId, fieldId, value: { singleSelectOptionId: optionId },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────

  private normalizeSearchIssue(raw: any): NormalizedIssue {
    const repoUrl: string = raw.repository_url || '';
    const repoParts = repoUrl.replace('https://api.github.com/repos/', '').split('/');
    const org = repoParts[0] || '';
    const repoName = repoParts[1] || '';
    const fullName = `${org}/${repoName}`;

    return {
      issueId: raw.id,
      nodeId: raw.node_id,
      title: raw.title,
      body: raw.body || '',
      repo: fullName,
      org,
      url: raw.html_url,
      state: raw.state === 'open' ? 'open' : 'closed',
      labels: (raw.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
      assignees: (raw.assignees || []).map((a: any) => ({
        id: a.id, login: a.login, name: a.login,
        avatar_url: a.avatar_url, email: '',
      })),
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      commentCount: raw.comments || 0,
      number: raw.number,
      user: {
        id: raw.user?.id || 0, login: raw.user?.login || '',
        name: raw.user?.login || '', avatar_url: raw.user?.avatar_url || '', email: '',
      },
    };
  }

  // ─── Analytics Methods ──────────────────────────────────────

  async getAnalyticsData(): Promise<{
    profile: any;
    repos: any[];
    issueStats: { open: number; closed: number; total: number };
    recentActivity: any[];
    topRepos: any[];
    languageBreakdown: Record<string, number>;
  }> {
    try {
      const [profile, repos] = await Promise.all([
        this.getCurrentUser(),
        this.getUserRepos(1, 100),
      ]);

      // Count issues assigned to user
      const [openResult, closedResult] = await Promise.all([
        this.apiRequest<any>(`/search/issues?q=assignee:${profile.login}+is:issue+state:open&per_page=1`),
        this.apiRequest<any>(`/search/issues?q=assignee:${profile.login}+is:issue+state:closed&per_page=1`),
      ]);

      const issueStats = {
        open: openResult.total_count || 0,
        closed: closedResult.total_count || 0,
        total: (openResult.total_count || 0) + (closedResult.total_count || 0),
      };

      // Get recent events
      let recentActivity: any[] = [];
      try {
        recentActivity = await this.apiRequest<any[]>(
          `/users/${profile.login}/events?per_page=20`,
        );
      } catch (e) {
        logger.warn('Failed to fetch activity', e);
      }

      // Top repos by stars
      const topRepos = [...repos]
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 8)
        .map(r => ({
          name: r.full_name || r.name,
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          language: r.language || 'Unknown',
          openIssues: r.open_issues_count || 0,
          isPrivate: r.private,
        }));

      // Language breakdown
      const languageBreakdown: Record<string, number> = {};
      for (const repo of repos) {
        if (repo.language) {
          languageBreakdown[repo.language] = (languageBreakdown[repo.language] || 0) + 1;
        }
      }

      return { profile, repos, issueStats, recentActivity, topRepos, languageBreakdown };
    } catch (error) {
      throw handleError(error);
    }
  }

  async getContributionStats(): Promise<{
    totalPRs: number;
    totalIssues: number;
    totalCommits: number;
  }> {
    const user = await this.getCurrentUser();
    try {
      const [prResult, issueResult] = await Promise.all([
        this.apiRequest<any>(`/search/issues?q=author:${user.login}+is:pr&per_page=1`),
        this.apiRequest<any>(`/search/issues?q=author:${user.login}+is:issue&per_page=1`),
      ]);

      return {
        totalPRs: prResult.total_count || 0,
        totalIssues: issueResult.total_count || 0,
        totalCommits: 0, // Commits require per-repo queries, skipping for perf
      };
    } catch (error) {
      throw handleError(error);
    }
  }
}