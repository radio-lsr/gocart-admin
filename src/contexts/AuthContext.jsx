import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, database } from '../firebase';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (firebaseUser) => {
    if (!firebaseUser) return null;
    try {
      const userRef = ref(database, `users/${firebaseUser.uid}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();

      console.log('📦 Données utilisateur depuis RTDB:', userData);

      if (!userData) {
        console.error(`❌ Aucune donnée trouvée pour l'utilisateur ${firebaseUser.uid}`);
        toast.error('Compte non configuré. Contactez l’administrateur.');
        await signOut(auth);
        return null;
      }

      const role = userData.role;
      if (!role) {
        console.error(`❌ Rôle manquant pour l'utilisateur ${firebaseUser.uid}`);
        toast.error('Votre compte n’a pas de rôle défini.');
        await signOut(auth);
        return null;
      }

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: userData.username || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
        role: role,
        phone: userData.phone || '',
        groupId: userData.groupId || null,
        storeId: userData.storeId || null,
        marketName: userData.marketName || '',
        status: userData.status || 'pending',
        createdAt: userData.createdAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Erreur lors du chargement RTDB:', error);
      toast.error('Erreur de chargement du profil');
      await signOut(auth);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 onAuthStateChanged - uid:', firebaseUser?.uid);
      if (firebaseUser) {
        const userData = await loadUserData(firebaseUser);
        setUser(userData);
        if (userData) localStorage.setItem('admin_user', JSON.stringify(userData));
        else localStorage.removeItem('admin_user');
      } else {
        setUser(null);
        localStorage.removeItem('admin_user');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Connexion réussie !');
      return { success: true };
    } catch (error) {
      toast.error(error.message || 'Erreur de connexion');
      return { success: false, error };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Connexion avec Google réussie !');
      return { success: true };
    } catch (error) {
      toast.error(error.message || 'Erreur de connexion avec Google');
      return { success: false, error };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('admin_user');
      toast.success('Déconnexion réussie');
    } catch (error) {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const refreshUserData = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const userData = await loadUserData(firebaseUser);
      setUser(userData);
      return userData;
    }
    return null;
  };

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
    refreshUserData,
    isSuperAdmin: user?.role === 'super_admin',
    isAdmin: user?.role === 'admin',
    isStoreManager: user?.role === 'store_manager',
    isCashier: user?.role === 'caissier',
    isApproved: user?.status === 'approved',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};