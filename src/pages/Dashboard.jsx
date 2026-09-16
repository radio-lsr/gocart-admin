import React, { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import StatsCards from '../components/Dashboard/StatsCards';
import RecentOrders from '../components/Dashboard/RecentOrders';
import TopProducts from '../components/Dashboard/TopProducts';

const Dashboard = () => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    activeDeliveries: 0,
    orderGrowth: 12.5,
    revenueGrowth: 8.3,
    userGrowth: 5.7,
    deliveryGrowth: -2.1,
  });

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isGroupAdmin = currentUser?.role === 'admin';
  const isStoreManager = currentUser?.role === 'store_manager';
  const groupId = currentUser?.groupId;
  const storeId = currentUser?.storeId;

  const [groupStoreIds, setGroupStoreIds] = useState([]);

  // Récupérer les storeIds du groupe (pour admin groupe)
  useEffect(() => {
    if (isGroupAdmin && groupId) {
      const storesRef = ref(database, 'stores');
      get(storesRef)
        .then((snapshot) => {
          const storesData = snapshot.val();
          if (storesData) {
            const ids = Object.keys(storesData).filter(
              (sid) => storesData[sid].groupId === groupId
            );
            setGroupStoreIds(ids);
          } else {
            setGroupStoreIds([]);
          }
        })
        .catch(console.error);
    } else {
      setGroupStoreIds([]);
    }
  }, [isGroupAdmin, groupId]);

  // Charger toutes les données en parallèle
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Charger commandes
        const ordersSnap = await get(ref(database, 'orders'));
        let allOrders = ordersSnap.exists()
          ? Object.entries(ordersSnap.val()).map(([id, data]) => ({ id, ...data }))
          : [];

        // 2. Charger utilisateurs (clients uniquement)
        const usersSnap = await get(ref(database, 'users'));
        let allUsers = usersSnap.exists()
          ? Object.entries(usersSnap.val()).map(([id, data]) => ({ id, ...data }))
          : [];
        allUsers = allUsers.filter((u) => u.role === 'client');

        // 3. Charger livraisons
        const deliveriesSnap = await get(ref(database, 'deliveries'));
        let allDeliveries = deliveriesSnap.exists()
          ? Object.entries(deliveriesSnap.val()).map(([id, data]) => ({ id, ...data }))
          : [];

        // 4. Charger produits
        const productsSnap = await get(ref(database, 'products'));
        let allProducts = productsSnap.exists()
          ? Object.entries(productsSnap.val()).map(([id, data]) => ({ id, ...data }))
          : [];

        // Appliquer les filtres hiérarchiques
        let filteredOrders = [];
        let filteredUsers = [];
        let filteredDeliveries = [];
        let filteredProducts = [];

        if (isSuperAdmin) {
          filteredOrders = allOrders;
          filteredUsers = allUsers;
          filteredDeliveries = allDeliveries;
          filteredProducts = allProducts;
        } else if (isGroupAdmin && groupStoreIds.length > 0) {
          filteredOrders = allOrders.filter((order) => groupStoreIds.includes(order.storeId));
          filteredDeliveries = allDeliveries.filter((del) => groupStoreIds.includes(del.storeId));
          filteredProducts = allProducts.filter((prod) => groupStoreIds.includes(prod.storeId));
          // Utilisateurs : ceux qui ont passé commande dans le groupe
          const userIdsFromOrders = new Set(filteredOrders.map((o) => o.userId).filter(Boolean));
          filteredUsers = allUsers.filter((u) => userIdsFromOrders.has(u.id));
        } else if (isStoreManager && storeId) {
          filteredOrders = allOrders.filter((order) => order.storeId === storeId);
          filteredDeliveries = allDeliveries.filter((del) => del.storeId === storeId);
          filteredProducts = allProducts.filter((prod) => prod.storeId === storeId);
          const userIdsFromOrders = new Set(filteredOrders.map((o) => o.userId).filter(Boolean));
          filteredUsers = allUsers.filter((u) => userIdsFromOrders.has(u.id));
        } else {
          // Aucun droit ou groupe sans magasins
          filteredOrders = [];
          filteredUsers = [];
          filteredDeliveries = [];
          filteredProducts = [];
        }

        setOrders(filteredOrders);
        setUsers(filteredUsers);
        setDeliveries(filteredDeliveries);
        setProducts(filteredProducts);

        // Calcul des statistiques
        const completedOrders = filteredOrders.filter(
          (o) => o.status === 'delivered' || o.paymentStatus === 'paid'
        );
        const totalOrdersCount = filteredOrders.length;
        const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalUsersCount = filteredUsers.length;
        const activeDeliveriesCount = filteredDeliveries.filter(
          (d) => !['delivered', 'cancelled'].includes(d.status)
        ).length;

        setStats((prev) => ({
          ...prev,
          totalOrders: totalOrdersCount,
          totalRevenue,
          totalUsers: totalUsersCount,
          activeDeliveries: activeDeliveriesCount,
        }));

        // Commandes récentes (5 dernières)
        const sortedOrders = [...filteredOrders].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecentOrders(sortedOrders.slice(0, 5));

        // Top produits (basé sur ventes)
        const sortedProducts = [...filteredProducts].sort(
          (a, b) => (b.sales || 0) - (a.sales || 0)
        );
        setTopProducts(sortedProducts.slice(0, 5));
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    // Attendre que groupStoreIds soit chargé pour l'admin groupe
    if (isGroupAdmin && groupStoreIds.length === 0 && groupId) {
      return; // on attend le premier useEffect
    }
    fetchAllData();
  }, [isSuperAdmin, isGroupAdmin, isStoreManager, groupId, storeId, groupStoreIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Chargement du tableau de bord...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">Erreur de chargement des données : {error.message}</p>
      </div>
    );
  }

  if (currentUser?.role === 'caissier') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800">Accès limité</h2>
          <p className="text-yellow-700 mt-2">
            Les caissiers n'ont pas accès au tableau de bord. Veuillez contacter votre administrateur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-1">
          {isSuperAdmin && 'Aperçu global de l’activité'}
          {isGroupAdmin && `Aperçu des magasins de votre groupe`}
          {isStoreManager && `Aperçu de votre magasin`}
        </p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrders orders={recentOrders} />
        <TopProducts products={topProducts} />
      </div>
    </div>
  );
};

export default Dashboard;