import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue, update } from 'firebase/database'; // ✅ v9
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Charger les détails de la commande (SDK v9)
  useEffect(() => {
    const orderRef = ref(database, `orders/${id}`); // ✅ v9

    const unsubscribe = onValue(
      orderRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setOrder({ id, ...data });
        } else {
          toast.error('Commande introuvable');
          navigate('/orders');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Erreur Firebase:', error);
        toast.error('Impossible de charger la commande');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, navigate]);

  // Fonctions utilitaires
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

  const calculateSubtotal = (cart) => {
    if (!cart) return 0;
    try {
      const items = Array.isArray(cart) ? cart : Object.values(cart);
      return items.reduce((total, item) => total + (item.quantity || 0) * (item.price || 0), 0);
    } catch {
      return 0;
    }
  };

  // Mettre à jour le statut (SDK v9)
  const handleUpdateStatus = async (newStatus) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir passer cette commande en "${getStatusLabel(newStatus)}" ?`)) {
      return;
    }

    setUpdating(true);
    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid,
        updatedByName: user?.name || user?.email,
        statusUpdatedAt: new Date().toISOString(),
      };

      if (newStatus === 'approved' || newStatus === 'completed') {
        updateData.approvedAt = new Date().toISOString();
        updateData.approvedBy = user?.uid;
        updateData.approvedByName = user?.name || user?.email;
      }

      if (newStatus === 'cancelled' || newStatus === 'rejected') {
        updateData.cancelledAt = new Date().toISOString();
        updateData.cancelledBy = user?.uid;
        updateData.cancelledByName = user?.name || user?.email;
      }

      const orderRef = ref(database, `orders/${id}`); // ✅ v9
      await update(orderRef, updateData);             // ✅ v9
      toast.success(`Statut mis à jour : ${getStatusLabel(newStatus)}`);
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Commande {order.orderNumber || `CMD-${order.id.slice(-6).toUpperCase()}`}
          </h1>
          <p className="text-gray-600 mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <div className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {getStatusLabel(order.status)}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne de gauche (2/3) : Articles et détails client */}
        <div className="lg:col-span-2 space-y-6">
          {/* Articles */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Articles ({calculateTotalItems(order.cart)})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {order.cart && calculateTotalItems(order.cart) > 0 ? (
                (Array.isArray(order.cart) ? order.cart : Object.values(order.cart)).map((item, index) => (
                  <div key={index} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.text || item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.price?.toFixed(2)} € x {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {((item.quantity || 0) * (item.price || 0)).toFixed(2)} €
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-gray-500">
                  Aucun article dans cette commande.
                </div>
              )}
              <div className="px-6 py-4 bg-gray-50 flex justify-between">
                <span className="text-sm font-medium text-gray-900">Total</span>
                <span className="text-base font-bold text-blue-600">{order.total?.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Informations client */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Client</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center text-sm">
                <UserIcon className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-gray-900">{order.userName || 'Client non renseigné'}</span>
              </div>
              {order.userEmail && (
                <div className="flex items-center text-sm">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <a href={`mailto:${order.userEmail}`} className="text-blue-600 hover:underline">
                    {order.userEmail}
                  </a>
                </div>
              )}
              {order.userPhone && (
                <div className="flex items-center text-sm">
                  <PhoneIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <a href={`tel:${order.userPhone}`} className="text-gray-900">
                    {order.userPhone}
                  </a>
                </div>
              )}
              {order.deliveryAddress && (
                <div className="flex items-start text-sm">
                  <span className="h-5 w-5 text-gray-400 mr-3">📍</span>
                  <span className="text-gray-900">{order.deliveryAddress}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne de droite (1/3) : Paiement, actions, historique */}
        <div className="space-y-6">
          {/* Paiement */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Paiement</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Méthode</span>
                <span className="text-sm font-medium text-gray-900">
                  {order.paymentMethod || 'Non spécifiée'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Statut</span>
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    order.paymentStatus === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {order.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                </span>
              </div>
              {order.paidAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payé le</span>
                  <span className="text-sm text-gray-900">{formatDate(order.paidAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions sur le statut */}
          {['pending', 'approved', 'completed'].includes(order.status) && (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                {order.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateStatus('approved')}
                    disabled={updating}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {updating ? 'Mise à jour...' : 'Approuver la commande'}
                  </button>
                )}
                {order.status === 'approved' && (
                  <button
                    onClick={() => handleUpdateStatus('completed')}
                    disabled={updating}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {updating ? 'Mise à jour...' : 'Marquer comme terminée'}
                  </button>
                )}
                {order.status !== 'cancelled' && order.status !== 'rejected' && (
                  <button
                    onClick={() => handleUpdateStatus('cancelled')}
                    disabled={updating}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {updating ? 'Mise à jour...' : 'Annuler la commande'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Historique des modifications */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Historique</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-start text-sm">
                <ClockIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-gray-900">Créée le {formatDate(order.createdAt)}</p>
                </div>
              </div>
              {order.updatedAt && order.updatedBy && (
                <div className="flex items-start text-sm">
                  <PencilIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-gray-900">Modifiée par {order.updatedBy}</p>
                    <p className="text-gray-500 text-xs">{formatDate(order.updatedAt)}</p>
                  </div>
                </div>
              )}
              {order.approvedAt && order.approvedBy && (
                <div className="flex items-start text-sm">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-gray-900">Approuvée par {order.approvedBy}</p>
                    <p className="text-gray-500 text-xs">{formatDate(order.approvedAt)}</p>
                  </div>
                </div>
              )}
              {order.rejectedAt && order.rejectedBy && (
                <div className="flex items-start text-sm">
                  <XCircleIcon className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-gray-900">Annulée par {order.rejectedBy}</p>
                    <p className="text-gray-500 text-xs">{formatDate(order.rejectedAt)}</p>
                    <p className="text-gray-500 text-xs">{order.rejectionReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;