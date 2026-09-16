import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue, set } from 'firebase/database';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    taxRate: 16,
    defaultDeliveryFee: 2.50,
    minOrderAmount: 5.00,
    currency: 'EUR',
  });

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    const settingsRef = ref(database, 'settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettings(prev => ({
          ...prev,
          ...data,
        }));
      }
      setLoading(false);
    }, (error) => {
      console.error('Erreur chargement paramètres:', error);
      toast.error('Impossible de charger les paramètres');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Seul un super administrateur peut modifier les paramètres');
      return;
    }
    setSaving(true);
    try {
      const settingsRef = ref(database, 'settings');
      await set(settingsRef, {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid,
        updatedByName: user?.name || user?.email,
      });
      toast.success('Paramètres sauvegardés');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres système</h1>
        <p className="text-gray-600 mt-1">Configurez les paramètres globaux de l'application</p>
      </div>

      {!isSuperAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            ⚠️ Vous êtes en mode lecture seule. Seul un super administrateur peut modifier les paramètres.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <div>
          <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-1">
            Taux de TVA (%)
          </label>
          <div className="flex items-center">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              id="taxRate"
              name="taxRate"
              value={settings.taxRate}
              onChange={handleChange}
              disabled={!isSuperAdmin}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
            <span className="ml-2 text-gray-500">%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Ce taux sera utilisé pour le calcul de la TVA sur les produits taxables.
          </p>
        </div>

        <div>
          <label htmlFor="defaultDeliveryFee" className="block text-sm font-medium text-gray-700 mb-1">
            Frais de livraison par défaut (€)
          </label>
          <div className="flex items-center">
            <input
              type="number"
              step="0.01"
              min="0"
              id="defaultDeliveryFee"
              name="defaultDeliveryFee"
              value={settings.defaultDeliveryFee}
              onChange={handleChange}
              disabled={!isSuperAdmin}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
            <span className="ml-2 text-gray-500">€</span>
          </div>
        </div>

        <div>
          <label htmlFor="minOrderAmount" className="block text-sm font-medium text-gray-700 mb-1">
            Montant minimum de commande (€)
          </label>
          <div className="flex items-center">
            <input
              type="number"
              step="0.01"
              min="0"
              id="minOrderAmount"
              name="minOrderAmount"
              value={settings.minOrderAmount}
              onChange={handleChange}
              disabled={!isSuperAdmin}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
            <span className="ml-2 text-gray-500">€</span>
          </div>
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
            Devise
          </label>
          <select
            id="currency"
            name="currency"
            value={settings.currency}
            onChange={handleSelectChange}
            disabled={!isSuperAdmin}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CDF">CDF (FC)</option>
          </select>
        </div>

        {isSuperAdmin && (
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        )}
      </form>

      <div className="mt-8 text-sm text-gray-500 bg-white p-4 rounded-lg shadow-sm">
        <p>Dernière mise à jour : {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('fr-FR') : 'Jamais'}</p>
        {settings.updatedByName && <p>Par : {settings.updatedByName}</p>}
      </div>
    </div>
  );
};

export default Settings;