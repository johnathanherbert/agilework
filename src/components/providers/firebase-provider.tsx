"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface UserData {
  uid: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface FirebaseContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  signOut: () => Promise<{ error: any }>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(
  undefined
);

export function FirebaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Load user data from Firestore
      if (user) {
        try {
          console.log('👤 Usuário autenticado:', user.uid, user.email);
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            console.log('✅ Documento do usuário encontrado:', data.name);
            setUserData(data);
          } else {
            // If user document doesn't exist, create it from auth data
            console.log('⚠️ Documento do usuário não existe - criando automaticamente...');
            const newUserData: UserData = {
              uid: user.uid,
              email: user.email || '',
              name: user.displayName || user.email?.split('@')[0] || 'Usuário',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            
            await setDoc(userDocRef, newUserData);
            console.log('✅ Documento do usuário criado:', newUserData.name);
            setUserData(newUserData);
          }
        } catch (error) {
          console.error('❌ Erro ao carregar/criar dados do usuário:', error);
        }
      } else {
        console.log('👋 Usuário deslogado');
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null, success: true };
    } catch (error) {
      return { error, success: false };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update user profile with display name
      await updateProfile(user, {
        displayName: name
      });
      
      // Create user document in Firestore
      const newUserData: UserData = {
        uid: user.uid,
        email: user.email || email,
        name: name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'users', user.uid), newUserData);
      console.log('✅ Usuário criado com sucesso:', newUserData);
      
      return { error: null, success: true };
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      return { error, success: false };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const value = {
    user,
    userData,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
