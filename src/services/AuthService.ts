import { 
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GithubAuthProvider
} from 'firebase/auth';
import { 
  makeRedirectUri, 
  useAuthRequest,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../../firebase.config';
import { GITHUB_CONFIG, APP_CONFIG } from '../constants';
import type { AuthServiceInterface, TokenResponse } from '../types';
import { setGitHubAccessToken, clearGitHubAccessToken } from './GitHubService';
import { logger } from '../utils/logger';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: GITHUB_CONFIG.ENDPOINTS.AUTHORIZATION,
  tokenEndpoint: GITHUB_CONFIG.ENDPOINTS.TOKEN,
};

export class AuthService implements AuthServiceInterface {
  private getRedirectUri(): string {
    // Always use Firebase callback URL - works for both dev and production
    return 'https://gitswipe-87e04.firebaseapp.com/__/auth/handler';
  }

  useGitHubAuth() {
    const redirectUri = this.getRedirectUri();
    logger.debug('GitHub OAuth configuration', { 
      redirectUri,
      environment: __DEV__ ? 'Development' : 'Production',
      scopes: GITHUB_CONFIG.SCOPES
    });
    const [request, response, promptAsync] = useAuthRequest(
      {
        clientId: GITHUB_CONFIG.CLIENT_ID,
        scopes: [...GITHUB_CONFIG.SCOPES],
        redirectUri,
        extraParams: {
          allow_signup: 'true'
        }
      },
      discovery
    );
    // Return codeVerifier for PKCE
    return { request, response, promptAsync, codeVerifier: request?.codeVerifier };
  }

  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<string> {
    try {
      const redirectUri = this.getRedirectUri();
      logger.info('Starting GitHub token exchange');
      const response = await fetch(GITHUB_CONFIG.ENDPOINTS.TOKEN, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CONFIG.CLIENT_ID,
          client_secret: GITHUB_CONFIG.CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });
      const data = await response.json();
      logger.debug('GitHub token exchange response received', { hasAccessToken: !!data.access_token });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(data)}`);
      }
      if (!data.access_token) {
        throw new Error('No access token in response');
      }
      return data.access_token;
    } catch (error) {
      logger.error('GitHub token exchange failed', error);
      throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async signInWithGitHub(accessToken: string): Promise<User> {
    try {
      // Store the access token for GitHub API calls
      setGitHubAccessToken(accessToken);
      
      logger.info('Signing in with GitHub credential');
      const credential = GithubAuthProvider.credential(accessToken);
      const result = await signInWithCredential(auth, credential);
      
      if (!result.user) {
        throw new Error('No user returned from authentication');
      }
      
      logger.info('Successfully signed in with GitHub', { userId: result.user.uid });
      return result.user;
    } catch (error) {
      logger.error('GitHub sign-in failed', error);
      throw new Error(`GitHub sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async signOut(): Promise<void> {
    try {
      logger.info('Starting user sign out');
      // Clear GitHub access token
      clearGitHubAccessToken();
      await firebaseSignOut(auth);
      logger.info('Successfully signed out');
    } catch (error) {
      logger.error('Sign out failed', error);
      throw new Error(`Sign out failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  getCurrentUser(): User | null {
    return auth.currentUser;
  }
}
