import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Users from './pages/Users';
import Delivery from './pages/Delivery';
import Stores from './pages/Stores';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import OrderDetails from './pages/OrderDetails';
import OrderEdit from './pages/OrderEdit'; // ✅ Nouvel import
import UserForm from './pages/UserForm';
import StoreForm from './pages/StoreForm';
import Shoppers from './pages/Shoppers';
import GroupsManager from './pages/GroupsManager';
import DeliveryDetails from './pages/DeliveryDetails';

// Hiérarchie des rôles (du plus élevé au moins élevé)
const roleHierarchy = {
  super_admin: 4,
  admin: 3,
  store_manager: 2,
  caissier: 1,
};

// Composant de protection avec gestion hiérarchique
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Si aucun rôle requis, on autorise tout utilisateur connecté
  if (!requiredRole) {
    return <Layout>{children}</Layout>;
  }

  const userRoleLevel = roleHierarchy[user.role] || 0;
  
  // Vérifier si le rôle requis est unique ou un tableau
  const hasRequiredRole = () => {
    if (Array.isArray(requiredRole)) {
      return requiredRole.some(role => {
        const requiredLevel = roleHierarchy[role] || 0;
        return userRoleLevel >= requiredLevel;
      });
    } else {
      const requiredLevel = roleHierarchy[requiredRole] || 0;
      return userRoleLevel >= requiredLevel;
    }
  };

  if (!hasRequiredRole()) {
    return <Navigate to="/dashboard" />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Route publique */}
          <Route path="/login" element={<Login />} />

          {/* Route de test (sans authentification) */}
          <Route path="/test-products" element={<Products />} />

          {/* Routes protégées */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />

          {/* Admin uniquement (niveau admin ou supérieur) */}
          <Route path="/orders" element={<ProtectedRoute requiredRole="admin"><Orders /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute requiredRole="admin"><OrderDetails /></ProtectedRoute>} />
          {/* ✅ Nouvelle route pour l'édition d'une commande */}
          <Route path="/orders/:id/edit" element={<ProtectedRoute requiredRole="admin"><OrderEdit /></ProtectedRoute>} />
          
          <Route path="/users" element={<ProtectedRoute requiredRole="admin"><Users /></ProtectedRoute>} />
          <Route path="/stores" element={<ProtectedRoute requiredRole="admin"><Stores /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute requiredRole="admin"><Analytics /></ProtectedRoute>} />
          <Route path="/stores/new" element={<ProtectedRoute requiredRole="admin"><StoreForm /></ProtectedRoute>} />
          <Route path="/stores/:id" element={<ProtectedRoute requiredRole="admin"><StoreForm /></ProtectedRoute>} />
          <Route path="/shoppers" element={<ProtectedRoute requiredRole="admin"><Shoppers /></ProtectedRoute>} />

          {/* Store manager uniquement */}
          <Route path="/delivery" element={<ProtectedRoute requiredRole="store_manager"><Delivery /></ProtectedRoute>} />
          <Route path="/delivery/:id" element={<ProtectedRoute requiredRole={['admin', 'store_manager']}><DeliveryDetails /></ProtectedRoute>} />

          {/* Caissier ou plus (Settings accessible à tous les utilisateurs connectés) */}
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Gestion des utilisateurs (admin ou store_manager) */}
          <Route path="/users/new" element={<ProtectedRoute requiredRole={['admin', 'store_manager']}><UserForm /></ProtectedRoute>} />
          <Route path="/users/:id" element={<ProtectedRoute requiredRole={['admin', 'store_manager']}><UserForm /></ProtectedRoute>} />

          {/* 🆕 Gestion des groupes (super_admin uniquement) */}
          <Route path="/groups" element={<ProtectedRoute requiredRole="super_admin"><GroupsManager /></ProtectedRoute>} />
          
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;