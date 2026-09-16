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
  TruckIcon,
  MapPinIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Correction des icônes Leaflet (par défaut)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Delivery = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [shoppers, setShoppers] = useState({}); // { shopperId: { displayName, location, ... } }
  const [stores, setStores] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    picking: 0,
    on_the_way: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [selectedOrder, setSelectedOrder] = useState(null); // pour la carte
  const [showMapModal, setShowMapModal] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const currentGroupId = user?.groupId;
  const currentStoreId = user?.storeId;

  // Charger les magasins (pour filtrer par groupe)
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

  // Charger les livreurs (pour afficher leur nom et position)
  useEffect(() => {
    const shoppersRef = ref(database, 'shoppers');
    const unsubscribe = onValue(shoppersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const shopperMap = {};
        Object.keys(data).forEach(key => {
          shopperMap[key] = {
            displayName: data[key].displayName || data[key].userId || 'Livreur',
            location: data[key].location || null, // { lat, lng } ou null
            phoneNumber: data[key].phoneNumber,
          };
        });
        setShoppers(shopperMap);
      }
    });
    return () => unsubscribe();
  }, []);

  // Charger les commandes (orders) de type delivery
  useEffect(() => {
    const ordersRef = ref(database, 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let ordersList = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));

        // Garder uniquement les commandes de type delivery
        ordersList = ordersList.filter(order => order.orderType === 'delivery');

        // Déterminer les storeIds accessibles
        let accessibleStoreIds = [];
        if (isSuperAdmin) {
          accessibleStoreIds = stores.map(s => s.id);
        } else if (isGroupAdmin && currentGroupId) {
          accessibleStoreIds = stores.filter(s => s.groupId === currentGroupId).map(s => s.id);
        } else if (isStoreManager && currentStoreId) {
          accessibleStoreIds = [currentStoreId];
        } else {
          accessibleStoreIds = [];
        }

        // Filtrer les commandes selon les magasins autorisés
        let filtered = ordersList;
        if (accessibleStoreIds.length > 0) {
          filtered = ordersList.filter(order => accessibleStoreIds.includes(order.storeId));
        } else if (!isSuperAdmin) {
          filtered = [];
        }

        setOrders(filtered);
        calculateStats(filtered);
      } else {
        setOrders([]);
        setStats({
          total: 0,
          pending: 0,
          assigned: 0,
          picking: 0,
          on_the_way: 0,
          delivered: 0,
          cancelled: 0,
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [stores, isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId]);

  const calculateStats = (list) => {
    const total = list.length;
    const pending = list.filter(o => o.status === 'pending').length;
    const assigned = list.filter(o => o.status === 'assigned').length;
    const picking = list.filter(o => o.status === 'picking').length;
    const on_the_way = list.filter(o => o.status === 'on_the_way').length;
    const delivered = list.filter(o => o.status === 'delivered').length;
    const cancelled = list.filter(o => o.status === 'cancelled').length;
    setStats({ total, pending, assigned, picking, on_the_way, delivered, cancelled });
  };

  // Filtrage supplémentaire (recherche + statut)
  useEffect(() => {
    let filtered = [...orders];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        (order.orderId && order.orderId.toLowerCase().includes(term)) ||
        (order.deliveryAddress?.street && order.deliveryAddress.street.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, orders]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusLabel = (status) => {
    const map = {
      pending: 'En attente',
      assigned: 'Assignée',
      picking: 'Courses',
      on_the_way: 'En route',
      delivered: 'Livrée',
      cancelled: 'Annulée',
    };
    return map[status] || status;
  };

  const getStatusColor = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      picking: 'bg-purple-100 text-purple-800',
      on_the_way: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const handleShowLocation = (order) => {
    if (!order.shopperId) {
      toast.error('Aucun livreur assigné à cette commande');
      return;
    }
    const shopper = shoppers[order.shopperId];
    if (!shopper || !shopper.location || !shopper.location.lat || !shopper.location.lng) {
      toast.error('Position du livreur non disponible');
      return;
    }
    setSelectedOrder(order);
    setShowMapModal(true);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des livraisons</h1>
          <p className="text-gray-600 mt-1">
            {isSuperAdmin && 'Toutes les livraisons'}
            {isGroupAdmin && `Livraisons des magasins de votre groupe`}
            {isStoreManager && `Livraisons de votre magasin`}
          </p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-sm text-yellow-600">En attente</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-sm text-blue-600">Assignées</p>
          <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-sm text-purple-600">Courses</p>
          <p className="text-2xl font-bold text-purple-600">{stats.picking}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-sm text-indigo-600">En route</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.on_the_way}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-sm text-green-600">Livrées</p>
          <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-sm text-red-600">Annulées</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par commande ou adresse..."
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
                <option value="assigned">Assigné</option>
                <option value="picking">Courses</option>
                <option value="on_the_way">En route</option>
                <option value="delivered">Livré</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Livreur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créée le</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.length > 0 ? (
                currentItems.map((order) => {
                  const shopper = order.shopperId ? shoppers[order.shopperId] : null;
                  const address = order.deliveryAddress
                    ? `${order.deliveryAddress.street || ''}, ${order.deliveryAddress.city || ''}`
                    : '-';
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.orderId ? order.orderId.slice(-6) : order.id.slice(-6)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.userEmail || order.userId || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shopper ? shopper.displayName : (order.shopperId ? 'Livreur' : 'Non assigné')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                        {address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => navigate(`/delivery/${order.id}`)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Détails
                        </button>
                        {order.shopperId && shoppers[order.shopperId]?.location && (
                          <button
                            onClick={() => handleShowLocation(order)}
                            className="text-green-600 hover:text-green-900"
                            title="Voir position du livreur"
                          >
                            <MapPinIcon className="h-5 w-5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <TruckIcon className="h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-500 text-lg mb-2">Aucune livraison trouvée</p>
                      <p className="text-gray-400 text-sm">
                        {searchTerm || statusFilter !== 'all'
                          ? 'Essayez de modifier vos filtres'
                          : 'Aucune livraison pour le moment'}
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
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                Précédent
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{indexOfFirstItem + 1}</span> à{' '}
                  <span className="font-medium">{Math.min(indexOfLastItem, filteredOrders.length)}</span> sur{' '}
                  <span className="font-medium">{filteredOrders.length}</span> livraisons
                </p>
              </div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === i + 1 ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Modal avec carte */}
      {showMapModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium">
                Position du livreur - Commande {selectedOrder.orderId?.slice(-6)}
              </h3>
              <button
                onClick={() => setShowMapModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 p-4">
              {selectedOrder.shopperId && shoppers[selectedOrder.shopperId]?.location ? (
                <div style={{ height: '500px', width: '100%' }}>
                  <MapContainer
                    center={[
                      shoppers[selectedOrder.shopperId].location.lat,
                      shoppers[selectedOrder.shopperId].location.lng,
                    ]}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker
                      position={[
                        shoppers[selectedOrder.shopperId].location.lat,
                        shoppers[selectedOrder.shopperId].location.lng,
                      ]}
                    >
                      <Popup>
                        {shoppers[selectedOrder.shopperId].displayName}<br />
                        {shoppers[selectedOrder.shopperId].phoneNumber}
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Position non disponible pour ce livreur
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowMapModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Delivery;