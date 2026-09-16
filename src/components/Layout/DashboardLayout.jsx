import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Optionnel : afficher un message différent selon le rôle
  const getRoleTitle = () => {
    switch (user?.role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin Groupe';
      case 'store_manager': return 'Gestionnaire';
      default: return '';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} user={user} />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${sidebarOpen ? 'ml-0' : 'ml-0'} transition-all duration-300`}>
        {/* Header */}
        <Header toggleSidebar={toggleSidebar} user={user} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} goCart Admin. Tous droits réservés.
              {user?.role === 'super_admin' && <span className="ml-2 text-xs text-blue-600">(Super Admin)</span>}
            </p>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Version 1.0.0</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 mr-1 bg-green-500 rounded-full"></span>
                En ligne
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;