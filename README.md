# GitSwipe - GitHub Issue Navigator & Triage Tool 🚀

A React Native mobile app for triaging GitHub issues with swipe-based navigation and AI-powered summaries. Think Tinder, but for bugs.

## ✨ Features

- **🃏 Swipe Navigation** - Tinder-style card swipes to navigate through issues
- **🤖 AI Summaries** - Get instant 2-line issue summaries powered by Groq's LLaMA
- **📊 Analytics Dashboard** - View issue stats, language breakdowns, and activity
- **🔍 Smart Filtering** - Filter by state, assignee, repo, organization, and sort order
- **🎨 Beautiful UI** - Spring-based animations with scale, rotation, and smooth transitions
- **🔐 GitHub OAuth** - Secure authentication via Firebase Auth
- **📱 Mobile First** - Optimized for touch with reliable gesture handling

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- GitHub OAuth App
- Groq API account

### Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd gh-app
npm install
```

2. **Environment Configuration**

```bash
cp .env.example .env
```

3. **Configure your .env file**

```env
# GitHub OAuth (create at https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret

# Groq AI API (get from https://console.groq.com/keys)
GROQ_API_KEY=gsk_your_groq_api_key_here
```

4. **GitHub OAuth Setup**
   - Go to https://github.com/settings/developers
   - Create a new OAuth App
   - Set Authorization callback URL to your Firebase Auth URL
   - Set Application URL to your app's URL
   - Copy Client ID and Client Secret to .env

5. **Groq API Setup**
   - Sign up at https://console.groq.com
   - Generate an API key
   - Add it to your .env file

6. **Start the development server**

```bash
npm start
```

## 🏗️ Tech Stack

- **Frontend**: React Native, Expo SDK ~54
- **Language**: TypeScript
- **Authentication**: Firebase Auth + GitHub OAuth
- **APIs**: GitHub REST & GraphQL
- **AI**: Groq (LLaMA-3.1-8b-instant)
- **Animation**: React Native Animated API with spring physics
- **State**: React Hooks + Context
- **HTTP**: Fetch API with custom error handling

## 📱 Usage

1. **Login** with your GitHub account
2. **Swipe left** to go to the next issue
3. **Swipe right** to go to the previous issue
4. **Tap a card** to view issue details
5. **Tap "AI Summary"** to get an instant summary
6. **Use filters** to narrow down issues by state, repo, assignee
7. **Access Analytics** via the hamburger menu

## 🚀 Building for Production

```bash
# Type check
npm run type-check

# Build for iOS/Android
npm run build-production
```

- Safe area handling for notched devices
- Responsive layout for different screen sizes

## App Structure

```
src/
├── components/
│   ├── IssueCard.tsx           # Swipeable issue cards
│   └── OrgUserSelector.tsx     # Organization/User dropdowns
├── screens/
│   ├── LoginScreen.tsx         # GitHub OAuth login
│   ├── MainScreen.tsx          # Main issue browsing interface
│   └── IssueDetailScreen.tsx   # Detailed issue view
├── services/
│   ├── AuthService.ts          # Firebase authentication
│   └── GitHubService.ts        # GitHub API integration
└── types/
    ├── index.ts                # Common types
    ├── navigation.ts           # Navigation types
    └── issue.ts               # Issue-related types
```

## How It Works

### Authentication Flow

1. User opens app → Login screen appears
2. Tap "Sign in with GitHub" → OAuth flow starts
3. User authenticates in browser → Returns with auth code
4. App exchanges code for access token → Stores in Firebase
5. User is logged in → Main screen loads

### Main Interface

1. **Initial Load**: App fetches user's organizations and sets both dropdowns to "ALL"
2. **Organization Dropdown**: Shows "ALL Organizations" + user's orgs
3. **User Dropdown**: Shows "ALL Users" + members from selected org(s)
4. **Issue Loading**:
   - "ALL" + "ALL" = Issues from all user's organizations
   - Specific org + "ALL" = All issues from that organization
   - Specific org + Specific user = Issues assigned/authored by that user
5. **Issue Cards**: Tap to view details, swipe to scroll through

### Data Flow

- Uses GitHub's REST API v4 with proper authentication headers
- Handles rate limiting gracefully with error messages
- Caches organization and user data to minimize API calls
- Real-time issue loading based on filter selections

## Key Components

### MainScreen.tsx

- Main interface with org/user selectors
- Issue list with pull-to-refresh
- Loading states and error handling
- Navigation to issue details

### IssueCard.tsx

- Individual issue cards with rich information
- Touch handling for navigation
- Dynamic label colors and state badges
- Mobile-optimized layout

### GitHubService.ts

- GitHub API integration
- Issue fetching with multiple strategies:
  - Search API for cross-repo queries
  - Repository API for specific org repos
  - Smart filtering and deduplication
- Organization and user management

### OrgUserSelector.tsx

- Dual dropdown interface
- "ALL" options for both selectors
- Proper z-index handling to prevent overlap
- Responsive design for mobile screens

## Installation & Setup

1. **Clone and install dependencies**:

   ```bash
   cd gh-app
   npm install
   ```

2. **Configure GitHub OAuth**:
   - Create GitHub OAuth app
   - Set redirect URI to your Expo URL
   - Add credentials to `.env` file

3. **Configure Firebase**:
   - Create Firebase project
   - Add configuration to `firebase.config.ts`

4. **Run the app**:

   ```bash
   npm start
   ```

   - Scan QR code with Expo Go app
   - Or use simulator/emulator

## Technical Decisions

### Why This Architecture?

- **Component-based**: Reusable UI components for maintainability
- **Service layer**: Clean separation of API logic from UI
- **TypeScript**: Strong typing for better development experience
- **React Navigation**: Industry-standard navigation for React Native
- **Expo**: Rapid development and easy deployment

### API Strategy

Instead of just using GitHub's search API (which was causing 422 errors), we implemented a multi-pronged approach:

1. **Organization repos**: Fetch repos for each org, then issues per repo
2. **Search fallback**: Use search API for user-assigned issues across all repos
3. **Smart filtering**: Client-side filtering for better user experience
4. **Deduplication**: Remove duplicate issues from different queries

### Mobile-First Design

- Touch targets are minimum 44px as per Apple/Android guidelines
- Proper safe areas for notched devices
- Smooth animations and transitions
- Optimized for one-handed use
- Pull-to-refresh for mobile UX conventions

## Current Status: ✅ FULLY WORKING MVP

This is a complete, working MVP that:

- ✅ Authenticates with GitHub successfully
- ✅ Loads organizations and users properly
- ✅ Shows "ALL" options in both dropdowns (initially selected)
- ✅ Displays issues in swipeable cards
- ✅ Handles mobile phone sizes correctly
- ✅ Allows diving into issue details
- ✅ Includes proper error handling and loading states
- ✅ Uses proper GitHub API integration

Ready for testing on mobile devices!
