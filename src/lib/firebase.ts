import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | null = null;

// Only initialize on client side OR during build with env vars
const isClient = typeof window !== 'undefined';
const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;

if (isClient || hasConfig) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  // Initialize Firebase services
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Initialize Analytics only on client side if supported
  if (isClient) {
    isSupported().then((supported) => {
      if (supported && app) {
        analytics = getAnalytics(app);
      }
    }).catch((error) => {
      console.warn('Firebase Analytics not supported:', error);
    });
  }
} else {
  // Dummy initialization for server-side rendering without env vars
  // This prevents errors during build
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

export { auth, db, analytics };
export default app;
