import { User } from 'firebase/auth';

// ─── Auth Types ────────────────────────────────────────────

export interface AuthResponse {
  type: 'success' | 'error' | 'cancel' | 'dismiss' | 'opened' | 'locked';
  authentication?: {
    accessToken?: string;
  };
  params?: {
    code?: string;
  };
  error?: any;
  errorCode?: string;
  url?: string;
}

export interface TokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

export interface AuthServiceInterface {
  useGitHubAuth(): {
    request: any;
    response: any;
    promptAsync: (options?: any) => Promise<any>;
    codeVerifier: string | null | undefined;
  };
  signInWithGitHub(accessToken: string): Promise<User>;
  exchangeCodeForToken(code: string, codeVerifier: string): Promise<string>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  getCurrentUser(): User | null;
}

// ─── GitHub Data Types ─────────────────────────────────────

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  email: string;
}

export interface GitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
  description: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
  open_issues_count?: number;
}

export interface GitHubLabel {
  id?: number;
  name: string;
  color: string;
  description?: string;
}

export interface GitHubProject {
  id: string;
  number: number;
  title: string;
  url: string;
  owner: string;
  fields: ProjectField[];
}

export interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: ProjectFieldOption[];
}

export interface ProjectFieldOption {
  id: string;
  name: string;
}

// ─── Normalized Issue (Internal Data Model) ─────────────────

export interface NormalizedIssue {
  issueId: number;
  nodeId?: string;
  title: string;
  body: string;
  repo: string;
  org: string;
  url: string;
  state: 'open' | 'closed';
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  number: number;
  user: GitHubUser;
  project?: {
    projectId: string;
    projectTitle: string;
    statusFieldId: string;
    statusValue: string;
    itemId?: string;
  };
}

// ─── Issue Source & Filters ─────────────────────────────────

export type IssueSource = 'all' | 'organization';

export type SortOrder = 'updated' | 'created' | 'comments';

export interface IssueFilters {
  source: IssueSource;
  state: 'open' | 'closed';
  repository?: string;
  labels?: string[];
  sortOrder: SortOrder;
  sortDirection: 'asc' | 'desc';
  organization?: string;
  assignee?: string;
}

// ─── API Response Types ─────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  hasNextPage: boolean;
}

export interface ProjectStatusOption {
  id: string;
  name: string;
}

// ─── Navigation Types ───────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}