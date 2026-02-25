import {
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GithubAuthProvider,
} from 'firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { auth } from '../../firebase.config';
import { GITHUB_CONFIG } from '../constants';
import type { AuthServiceInterface } from '../types';
import { setGitHubAccessToken, clearGitHubAccessToken } from './GitHubService';
import { logger } from '../utils/logger';

WebBrowser.maybeCompleteAuthSession();

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
};

const isExpoGo = Constants.appOwnership === 'expo';
const redirectUri = isExpoGo
  ? AuthSession.makeRedirectUri({ path: 'auth' })
  : 'gitswipe://auth';

export class AuthService implements AuthServiceInterface {
  useGitHubAuth() {
    logger.debug('OAuth Config', { redirectUri, isExpoGo });

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
      {
        clientId: GITHUB_CONFIG.CLIENT_ID,
        scopes: ['user', 'repo'],
        redirectUri,
      },
      discovery,
    );

    return { request, response, promptAsync };
  }

  /**
   * Exchange authorization code for access token using PKCE.
   * Uses AuthSession.exchangeCodeAsync which sends the code_verifier
   * that matches the code_challenge from the auth request — this is
   * the industry-standard OAuth 2.0 + PKCE flow for mobile apps.
   */
  async exchangeCodeForToken(
    code: string,
    request: AuthSession.AuthRequest,
  ): Promise<string> {
    logger.info('Exchanging code for token (PKCE)...');

    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: GITHUB_CONFIG.CLIENT_ID,
        clientSecret: GITHUB_CONFIG.CLIENT_SECRET,
        code,
        redirectUri,
        extraParams: request.codeVerifier
          ? { code_verifier: request.codeVerifier }
          : {},
      },
      discovery,
    );

    if (!tokenResult.accessToken) {
      throw new Error('No access token received from GitHub');
    }

    logger.info('Token exchange successful');
    return tokenResult.accessToken;
  }

  async signInWithGitHub(accessToken: string): Promise<User> {
    logger.info('Signing in to Firebase...');
    setGitHubAccessToken(accessToken);

    const credential = GithubAuthProvider.credential(accessToken);
    const result = await signInWithCredential(auth, credential);

    if (!result.user) {
      throw new Error('Firebase sign-in failed');
    }

    logger.info('Signed in', { uid: result.user.uid });
    return result.user;
  }

  async signOut(): Promise<void> {
    clearGitHubAccessToken();
    await firebaseSignOut(auth);
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  getCurrentUser(): User | null {
    return auth.currentUser;
  }
}
