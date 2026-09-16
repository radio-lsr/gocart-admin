import React from 'react';
import { 
  ShoppingBagIcon, 
  CurrencyDollarIcon, 
  UserGroupIcon, 
  TruckIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

const StatsCards = ({ stats }) => {
  const cards = [
    {
      title: 'Commandes totales',
      value: stats.totalOrders.toLocaleString(),
      icon: ShoppingBagIcon,
      change: stats.orderGrowth,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Revenu total',
      value: `€${stats.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`,
      icon: CurrencyDollarIcon,
      change: stats.revenueGrowth,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Utilisateurs',
      value: stats.totalUsers.toLocaleString(),
      icon: UserGroupIcon,
      change: stats.userGrowth,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Livraisons actives',
      value: stats.activeDeliveries,
      icon: TruckIcon,
      change: stats.deliveryGrowth,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.bgColor} rounded-xl shadow-sm p-6`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
              <div className="flex items-center mt-2">
                {card.change >= 0 ? (
                  <ArrowUpIcon className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <ArrowDownIcon className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm font-medium ${card.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(card.change)}%
                </span>
                <span className="text-sm text-gray-500 ml-1">vs période précédente</span>
              </div>
            </div>
            <div className={`${card.color} p-3 rounded-lg`}>
              <card.icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;