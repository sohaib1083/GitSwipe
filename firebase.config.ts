import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyANdor73E1DgCyTtJu2O3CL8Aqcv9c5V2s",
  authDomain: "gitswipe-87e04.firebaseapp.com",
  projectId: "gitswipe-87e04",
  storageBucket: "gitswipe-87e04.firebasestorage.app",
  messagingSenderId: "600124547404",
  appId: "1:600124547404:android:bfdeb5ffda5e3d859aafe9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };