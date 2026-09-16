import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  HomeIcon, 
  ShoppingBagIcon, 
  UsersIcon, 
  TruckIcon, 
  BuildingStorefrontIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const Sidebar = ({ isOpen, user }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Déconnexion réussie');
  };

  // Définition des items selon le rôle
  const getNavItems = () => {
    const role = user?.role;
    
    // Super admin : tous les items + gestion des groupes
    if (role === 'super_admin') {
      return [
        { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
        { name: 'Produits', path: '/products', icon: ShoppingBagIcon },
        { name: 'Commandes', path: '/orders', icon: CurrencyDollarIcon },
        { name: 'Utilisateurs', path: '/users', icon: UsersIcon },
        { name: 'Livraisons', path: '/delivery', icon: TruckIcon },
        { name: 'Livreurs', path: '/shoppers', icon: UserGroupIcon },
        { name: 'Magasins', path: '/stores', icon: BuildingStorefrontIcon },
        { name: 'Groupes', path: '/groups', icon: UserGroupIcon }, // gestion des groupes
        { name: 'Analytiques', path: '/analytics', icon: ChartBarIcon },
        { name: 'Paramètres', path: '/settings', icon: Cog6ToothIcon },
      ];
    }
    
    // Admin de groupe : voit ses magasins, utilisateurs, etc.
    if (role === 'admin') {
      return [
        { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
        { name: 'Produits', path: '/products', icon: ShoppingBagIcon },
        { name: 'Commandes', path: '/orders', icon: CurrencyDollarIcon },
        { name: 'Utilisateurs', path: '/users', icon: UsersIcon },
        { name: 'Livraisons', path: '/delivery', icon: TruckIcon },
        { name: 'Livreurs', path: '/shoppers', icon: UserGroupIcon },
        { name: 'Magasins', path: '/stores', icon: BuildingStorefrontIcon },
        { name: 'Analytiques', path: '/analytics', icon: ChartBarIcon },
        { name: 'Paramètres', path: '/settings', icon: Cog6ToothIcon },
      ];
    }
    
    // Store manager : limité
    if (role === 'store_manager') {
      return [
        { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
        { name: 'Produits', path: '/products', icon: ShoppingBagIcon },
        { name: 'Commandes', path: '/orders', icon: CurrencyDollarIcon },
        { name: 'Livraisons', path: '/delivery', icon: TruckIcon },
        { name: 'Livreurs', path: '/shoppers', icon: UserGroupIcon },
        { name: 'Paramètres', path: '/settings', icon: Cog6ToothIcon },
      ];
    }
    
    // Fallback (aucun accès normalement)
    return [];
  };

  const navItems = getNavItems();

  // Affichage du libellé du rôle
  const getRoleLabel = () => {
    const role = user?.role;
    switch (role) {
      case 'super_admin': return 'Super Administrateur';
      case 'admin': return 'Administrateur groupe';
      case 'store_manager': return 'Gestionnaire de magasin';
      default: return 'Utilisateur';
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-900 to-blue-800 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-4 bg-blue-900">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">GC</span>
            </div>
            <span className="text-white text-xl font-bold">goCart Admin</span>
          </div>
        </div>

        {/* User Profile */}
        <div className="px-4 py-6 border-b border-blue-700">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {user?.name?.charAt(0).toUpperCase() || (user?.email?.charAt(0).toUpperCase()) || 'A'}
              </span>
            </div>
            <div>
              <h3 className="text-white font-semibold">{user?.name || user?.email || 'Utilisateur'}</h3>
              <p className="text-blue-300 text-sm">{getRoleLabel()}</p>
              <p className="text-blue-200 text-xs mt-1">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {/* System Status (optionnel) */}
          <div className="mt-8 px-4">
            <div className="bg-blue-800/50 rounded-lg p-4">
              <h4 className="text-white text-sm font-semibold mb-2">Statut du système</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-blue-200 text-xs">Serveur API</span>
                  <span className="inline-flex items-center">
                    <span className="w-2 h-2 mr-1 bg-green-500 rounded-full"></span>
                    <span className="text-green-400 text-xs">En ligne</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-200 text-xs">Base de données</span>
                  <span className="inline-flex items-center">
                    <span className="w-2 h-2 mr-1 bg-green-500 rounded-full"></span>
                    <span className="text-green-400 text-xs">Connecté</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Logout Button */}
        <div className="px-4 py-4 border-t border-blue-700">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full space-x-2 px-4 py-3 text-red-300 hover:text-white hover:bg-red-600 rounded-lg transition-colors duration-200"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;