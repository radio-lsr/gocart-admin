import React from 'react';
import { useNavigate } from 'react-router-dom';

const TopProducts = ({ products = [] }) => {
  const navigate = useNavigate();

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Produits populaires</h2>
        <div className="text-center py-8 text-gray-500">
          Aucune donnée de vente
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Produits les plus vendus</h2>
      <div className="space-y-4">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="flex items-center space-x-4 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
            onClick={() => navigate(`/products/${product.id}`)}
          >
            <div className="flex-shrink-0 w-8 text-center font-medium text-gray-400">
              #{index + 1}
            </div>
            <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center">
              {product.image ? (
                <img src={product.image} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="text-xl">🛒</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
              <p className="text-sm text-gray-500 truncate">{product.category || 'Général'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{product.sales || 0} ventes</p>
              <p className="text-sm text-gray-500">
                {((product.sales || 0) * (product.price || 0)).toFixed(2)} €
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-right">
        <button
          onClick={() => navigate('/products')}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Voir tous les produits →
        </button>
      </div>
    </div>
  );
};

export default TopProducts;