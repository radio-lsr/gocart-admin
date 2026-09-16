import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const RecentOrders = ({ orders = [] }) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      approved: 'Approuvée',
      completed: 'Terminée',
      delivered: 'Livrée',
      cancelled: 'Annulée',
      rejected: 'Rejetée',
    };
    return labels[status] || status;
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = parseISO(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    } catch {
      return dateString;
    }
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Commandes récentes</h2>
        <div className="text-center py-8 text-gray-500">
          Aucune commande récente
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Commandes récentes</h2>
      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {order.customerName || 'Client inconnu'}
                </p>
                <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <div className="mt-1 flex items-center text-sm text-gray-500">
                <span className="truncate">{order.orderNumber || `#${order.id.slice(-8)}`}</span>
                <span className="mx-2">•</span>
                <span>{order.total?.toFixed(2)} €</span>
                <span className="mx-2">•</span>
                <span>{formatRelativeTime(order.createdAt)}</span>
              </div>
            </div>
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ))}
      </div>
      <div className="mt-4 text-right">
        <button
          onClick={() => navigate('/orders')}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Voir toutes les commandes →
        </button>
      </div>
    </div>
  );
};

export default RecentOrders;