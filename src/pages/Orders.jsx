import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,  // ✅ Icône pour modifier
} from '@heroicons/react/24/outline';

const Orders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
  });
  const [stores, setStores] = useState([]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const currentGroupId = user?.groupId;
  const currentStoreId = user?.storeId;

  // Charger les magasins
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesList = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name,
          groupId: data[key].groupId,
        }));
        setStores(storesList);
      } else {
        setStores([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Charger les commandes et filtrer selon le rôle
  useEffect(() => {
    const ordersRef = ref(database, 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      let ordersList = [];

      if (data) {
        ordersList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        ordersList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      let filteredByStore = [];

      if (isSuperAdmin) {
        filteredByStore = ordersList;
      } 
      else if (isGroupAdmin && currentGroupId) {
        const accessibleStoreIds = stores
          .filter(s => s.groupId === currentGroupId)
          .map(s => s.id);
        filteredByStore = ordersList.filter(order => accessibleStoreIds.includes(order.storeId));
      } 
      else if (isStoreManager && currentStoreId) {
        filteredByStore = ordersList.filter(order => order.storeId === currentStoreId);
      } 
      else {
        filteredByStore = [];
      }

      setOrders(filteredByStore);
      setFilteredOrders(filteredByStore);
      calculateStats(filteredByStore);
      setLoading(false);
    }, (error) => {
      console.error('Erreur Firebase:', error);
      toast.error('Impossible de charger les commandes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [stores, isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId]);

  const calculateStats = (ordersList) => {
    const totalOrders = ordersList.length;
    const totalRevenue = ordersList
      .filter((o) => o.status === 'completed' || o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingOrders = ordersList.filter((o) => o.status === 'pending').length;
    const completedOrders = ordersList.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
    const cancelledOrders = ordersList.filter((o) => o.status === 'cancelled' || o.status === 'rejected').length;

    setStats({
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      cancelledOrders,
    });
  };

  // Filtres supplémentaires
  useEffect(() => {
    let filtered = [...orders];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          (o.orderNumber && o.orderNumber.toLowerCase().includes(term)) ||
          (o.customerName && o.customerName.toLowerCase().includes(term)) ||
          (o.customerEmail && o.customerEmail.toLowerCase().includes(term)) ||
          (o.customerPhone && o.customerPhone.includes(term)) ||
          (o.id && o.id.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, orders]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      pending: 'En attente',
      approved: 'Approuvée',
      completed: 'Terminée',
      delivered: 'Livrée',
      cancelled: 'Annulée',
      rejected: 'Rejetée',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const calculateTotalItems = (cart) => {
    if (!cart) return 0;
    try {
      const items = Array.isArray(cart) ? cart : Object.values(cart);
      return items.reduce((total, item) => total + (item.quantity || 0), 0);
    } catch {
      return 0;
    }
  };

  // ✅ Vérifier si l'utilisateur peut modifier la commande
  const canEditOrder = (order) => {
    if (isSuperAdmin) return true;
    if (isGroupAdmin && order.storeId) {
      const store = stores.find(s => s.id === order.storeId);
      return store && store.groupId === currentGroupId;
    }
    if (isStoreManager && order.storeId === currentStoreId) return true;
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des commandes</h1>
          <p className="text-gray-600 mt-1">
            {isSuperAdmin && 'Toutes les commandes de tous les magasins'}
            {isGroupAdmin && 'Commandes des magasins de votre groupe'}
            {isStoreManager && 'Commandes de votre magasin'}
          </p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Total commandes</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalOrders}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Revenu total</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {stats.totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">En attente</p>
          <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.pendingOrders}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Terminées</p>
          <p className="text-2xl font-bold text-green-600 mt-2">{stats.completedOrders}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Annulées</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{stats.cancelledOrders}</p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par numéro, client, email..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <FunnelIcon className="h-5 w-5 text-gray-400 mr-2" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvée</option>
                <option value="completed">Terminée</option>
                <option value="cancelled">Annulée</option>
                <option value="rejected">Rejetée</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau des commandes */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° commande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Magasin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Articles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.length > 0 ? (
                currentItems.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.orderNumber || `CMD-${order.id.slice(-6).toUpperCase()}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.userName || 'Client inconnu'}</div>
                      <div className="text-sm text-gray-500">{order.customerEmail || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stores.find(s => s.id === order.storeId)?.name || 'Magasin inconnu'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{calculateTotalItems(order.cart)} articles</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.total?.toFixed(2)} €</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {order.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {/* Bouton Détails */}
                      <button
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Détails
                      </button>
                      {/* ✅ Bouton Modifier (si autorisé) */}
                      {canEditOrder(order) && (
                        <button
                          onClick={() => navigate(`/orders/${order.id}/edit`)}
                          className="text-green-600 hover:text-green-900"
                          title="Modifier la commande"
                        >
                          <PencilIcon className="h-5 w-5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-4">📦</span>
                      <p className="text-gray-500 text-lg mb-2">Aucune commande trouvée</p>
                      <p className="text-gray-400 text-sm">
                        {searchTerm || statusFilter !== 'all'
                          ? 'Essayez de modifier vos filtres'
                          : 'Aucune commande pour le moment'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{indexOfFirstItem + 1}</span> à{' '}
                  <span className="font-medium">{Math.min(indexOfLastItem, filteredOrders.length)}</span> sur{' '}
                  <span className="font-medium">{filteredOrders.length}</span> commandes
                </p>
              </div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      currentPage === i + 1
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;