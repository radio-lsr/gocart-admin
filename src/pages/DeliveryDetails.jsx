import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  TruckIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  UserIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Correction des icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DeliveryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [shopper, setShopper] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [shopperLocation, setShopperLocation] = useState(null); // Position temps réel

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const currentGroupId = user?.groupId;
  const currentStoreId = user?.storeId;

  useEffect(() => {
    if (!id) return;

    const orderRef = ref(database, `orders/${id}`);
    const unsubscribeOrder = onValue(orderRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Vérifier les droits d'accès
        let hasAccess = false;
        if (isSuperAdmin) hasAccess = true;
        else if (isGroupAdmin && currentGroupId) hasAccess = true; // à affiner si nécessaire
        else if (isStoreManager && currentStoreId) hasAccess = data.storeId === currentStoreId;
        else hasAccess = false;

        if (!hasAccess) {
          toast.error('Vous n’avez pas accès à cette livraison');
          navigate('/delivery');
          return;
        }

        setOrder({ id, ...data });
        if (data.items) {
          const itemsArray = Object.keys(data.items).map(key => ({
            id: key,
            ...data.items[key],
          }));
          setItems(itemsArray);
        }

        // Charger les infos du livreur et écouter sa position en temps réel
        if (data.shopperId) {
          const shopperRef = ref(database, `shoppers/${data.shopperId}`);
          onValue(shopperRef, (snap) => {
            if (snap.exists()) {
              const shopperData = { id: data.shopperId, ...snap.val() };
              setShopper(shopperData);
              // Mettre à jour la position si elle existe
              if (shopperData.location && shopperData.location.lat && shopperData.location.lng) {
                setShopperLocation(shopperData.location);
              } else {
                setShopperLocation(null);
              }
            } else {
              setShopper(null);
              setShopperLocation(null);
            }
          });
        } else {
          setShopper(null);
          setShopperLocation(null);
        }

        // Charger les infos du magasin
        if (data.storeId) {
          const storeRef = ref(database, `stores/${data.storeId}`);
          onValue(storeRef, (snap) => {
            if (snap.exists()) setStore({ id: data.storeId, ...snap.val() });
          });
        }
      } else {
        toast.error('Commande introuvable');
        navigate('/delivery');
      }
      setLoading(false);
    });

    return () => unsubscribeOrder();
  }, [id, isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId, navigate]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/delivery')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Livraison #{order.orderId ? order.orderId.slice(-6) : id.slice(-6)}
          </h1>
        </div>
        <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : infos client, adresse, articles */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center">
              <UserIcon className="h-5 w-5 mr-2 text-gray-500" />
              Informations client
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{order.userEmail || order.userId || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="font-medium">{order.userPhone || '-'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center">
              <MapPinIcon className="h-5 w-5 mr-2 text-gray-500" />
              Adresse de livraison
            </h2>
            {order.deliveryAddress ? (
              <div className="space-y-2">
                <p><span className="text-gray-500">Rue :</span> {order.deliveryAddress.street || '-'}</p>
                <p><span className="text-gray-500">Ville :</span> {order.deliveryAddress.city || '-'}</p>
                <p><span className="text-gray-500">Code postal :</span> {order.deliveryAddress.postalCode || '-'}</p>
                <p><span className="text-gray-500">Instructions :</span> {order.deliveryAddress.instructions || '-'}</p>
              </div>
            ) : (
              <p className="text-gray-500">Adresse non renseignée</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center">
              <ClipboardDocumentListIcon className="h-5 w-5 mr-2 text-gray-500" />
              Articles commandés
            </h2>
            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produit</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Qté</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Prix unit.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{item.name || `Produit ${item.productId}`}</td>
                        <td className="px-4 py-2 text-sm text-center">{item.quantity || 1}</td>
                        <td className="px-4 py-2 text-sm text-right">{item.price ? `${item.price} €` : '-'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">
                          {item.price && item.quantity ? `${(item.price * item.quantity).toFixed(2)} €` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="3" className="px-4 py-2 text-right font-medium">Total</td>
                      <td className="px-4 py-2 text-right font-bold">{order.total ? `${order.total} €` : '-'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Aucun article détaillé</p>
            )}
          </div>
        </div>

        {/* Colonne droite : Livreur, Carte, Magasin, Paiement */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center">
              <TruckIcon className="h-5 w-5 mr-2 text-gray-500" />
              Livreur
            </h2>
            {shopper ? (
              <div>
                <p className="font-medium">{shopper.displayName || shopper.userId}</p>
                <p className="text-sm text-gray-500">{shopper.phoneNumber}</p>
              </div>
            ) : (
              <p className="text-gray-500">{order.shopperId ? 'Livreur non trouvé' : 'Non assigné'}</p>
            )}
          </div>

          {/* Carte en temps réel */}
          {shopperLocation && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2 text-gray-500" />
                Position en temps réel du livreur
              </h2>
              <div style={{ height: '300px', width: '100%' }}>
                <MapContainer
                  center={[shopperLocation.lat, shopperLocation.lng]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[shopperLocation.lat, shopperLocation.lng]}>
                    <Popup>
                      {shopper?.displayName}<br />
                      Dernière position
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
              <p className="text-xs text-gray-400 mt-2">Mise à jour automatique (temps réel)</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center">
              <BuildingStorefrontIcon className="h-5 w-5 mr-2 text-gray-500" />
              Magasin
            </h2>
            {store ? (
              <div>
                <p className="font-medium">{store.name}</p>
                <p className="text-sm text-gray-500">{store.address}</p>
              </div>
            ) : (
              <p className="text-gray-500">Magasin non trouvé</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center">
              <CurrencyDollarIcon className="h-5 w-5 mr-2 text-gray-500" />
              Paiement
            </h2>
            <div className="space-y-2">
              <p><span className="text-gray-500">Méthode :</span> {order.paymentMethod || '-'}</p>
              <p><span className="text-gray-500">Statut :</span> 
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${order.paymentStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {order.paymentStatus === 'completed' ? 'Payé' : order.paymentStatus || 'En attente'}
                </span>
              </p>
              <p><span className="text-gray-500">Date de commande :</span> {formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetails;