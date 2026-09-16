import React, { useState, useEffect } from 'react';
import { BellIcon, MagnifyingGlassIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { database } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const Header = ({ toggleSidebar, user }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  // Récupération des notifications depuis Firebase
  useEffect(() => {
    const notificationsRef = ref(database, 'notifications');
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const notificationsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotifications(notificationsList);
      } else {
        setNotifications([]);
      }
      setLoadingNotifs(false);
    });
    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Marquer une notification comme lue
  const markAsRead = async (notificationId) => {
    try {
      await update(ref(database, `notifications/${notificationId}`), { read: true });
    } catch (error) {
      console.error('Erreur lors du marquage de la notification:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    // Optionnel : rediriger vers la page concernée
    if (notification.link) {
      // navigation à implémenter si besoin
    }
  };

  // Formater la date relative
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / 60000);
    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays} jours`;
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Search and Menu */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>

            <div className="relative flex-1 max-w-xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher commandes, produits, utilisateurs..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Right side - Notifications and Profile */}
          <div className="flex items-center space-x-4">
            {/* Date and Time */}
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">
                {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
              <p className="text-xs text-gray-500">
                {format(new Date(), 'HH:mm')}
              </p>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 relative"
              >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                    <p className="text-sm text-gray-500">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {loadingNotifs ? (
                      <div className="p-4 text-center text-gray-500">Chargement...</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">Aucune notification</div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">{notification.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(notification.createdAt)}
                            </span>
                          </div>
                          {!notification.read && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Nouveau
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        // Redirection vers une page dédiée (à créer)
                        // navigate('/notifications');
                        setNotificationsOpen(false);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium w-full text-center"
                    >
                      Voir toutes les notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;