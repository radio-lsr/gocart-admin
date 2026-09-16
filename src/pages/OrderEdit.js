import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, get, update } from 'firebase/database';
import toast from 'react-hot-toast';

const OrderEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState([]);
  const [formData, setFormData] = useState({
    status: '',
    paymentStatus: '',
    storeId: '',
    items: [],
  });

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const currentGroupId = user?.groupId;
  const currentStoreId = user?.storeId;

  // Charger les magasins accessibles
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const storesRef = ref(database, 'stores');
        const snapshot = await get(storesRef);
        if (snapshot.exists()) {
          let storesList = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            name: data.name,
            groupId: data.groupId,
          }));
          if (isSuperAdmin) {
            // tous
          } else if (isGroupAdmin && currentGroupId) {
            storesList = storesList.filter(store => store.groupId === currentGroupId);
          } else if (isStoreManager && currentStoreId) {
            storesList = storesList.filter(store => store.id === currentStoreId);
          } else {
            storesList = [];
          }
          setStores(storesList);
        } else {
          setStores([]);
        }
      } catch (error) {
        console.error('Erreur chargement magasins:', error);
      }
    };
    fetchStores();
  }, [isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId]);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const orderRef = ref(database, `orders/${id}`);
        const snapshot = await get(orderRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setOrder(data);

          // Extraire les articles (items est un tableau)
          let itemsList = [];
          const items = data.items || [];
          if (Array.isArray(items)) {
            itemsList = items.map(item => ({
              id: item.barcode || item.id || item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            }));
          } else {
            // fallback si objet
            itemsList = Object.values(items).map(item => ({
              id: item.barcode || item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            }));
          }

          setFormData({
            status: data.status || 'pending',
            paymentStatus: data.paymentStatus || 'pending',
            storeId: data.storeId || '',
            items: itemsList,
          });
        } else {
          toast.error('Commande introuvable');
          navigate('/orders');
        }
      } catch (error) {
        console.error(error);
        toast.error('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemQuantityChange = (itemId, newQuantity) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, quantity: parseInt(newQuantity) || 0 } : item
      )
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const orderRef = ref(database, `orders/${id}`);
      
      // Reconstruire le tableau items
      const updatedItems = formData.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        barcode: item.id, // ou garder l'id original
      }));

      const updateData = {
        status: formData.status,
        paymentStatus: formData.paymentStatus,
        items: updatedItems,
        total: calculateTotal(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid,
      };

      // Ajouter storeId si renseigné
      if (formData.storeId) {
        updateData.storeId = formData.storeId;
      }

      await update(orderRef, updateData);
      toast.success('Commande mise à jour');
      navigate(`/orders/${id}`);
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      toast.error('Erreur lors de la mise à jour : ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!order) return <div className="p-8 text-center">Commande non trouvée</div>;

  // Infos client (d'après la structure Firebase)
  const customerName = order.userName || order.customerName || 'Client inconnu';
  const customerEmail = order.userEmail || order.customerEmail || '-';
  const customerPhone = order.userPhone || order.customerPhone || '-';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Modifier la commande #{order.orderId || id.slice(-6)}</h1>
      
      {/* Informations client (lecture seule) */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">Client</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nom</label>
            <input type="text" value={customerName} disabled className="mt-1 block w-full border border-gray-300 rounded-md bg-gray-100 p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={customerEmail} disabled className="mt-1 block w-full border border-gray-300 rounded-md bg-gray-100 p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Téléphone</label>
            <input type="tel" value={customerPhone} disabled className="mt-1 block w-full border border-gray-300 rounded-md bg-gray-100 p-2" />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Statuts */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Statut commande</label>
            <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2">
              <option value="pending">En attente</option>
              <option value="approved">Approuvée</option>
              <option value="completed">Terminée</option>
              <option value="cancelled">Annulée</option>
              <option value="rejected">Rejetée</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Statut paiement</label>
            <select name="paymentStatus" value={formData.paymentStatus} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2">
              <option value="pending">En attente</option>
              <option value="paid">Payé</option>
              <option value="failed">Échoué</option>
            </select>
          </div>
        </div>

        {/* Magasin (modifiable) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Magasin</label>
          <select
            name="storeId"
            value={formData.storeId}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            disabled={stores.length === 0}
          >
            <option value="">Sélectionner un magasin</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
          {stores.length === 0 && (
            <p className="text-xs text-yellow-600 mt-1">Aucun magasin disponible selon vos droits</p>
          )}
        </div>

        {/* Articles commandés */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Articles commandés</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prix unitaire (€)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total (€)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {formData.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.price.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleItemQuantityChange(item.id, e.target.value)}
                        className="w-20 border border-gray-300 rounded-md p-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="3" className="px-4 py-2 text-right font-bold">Total commande :</td>
                  <td className="px-4 py-2 text-lg font-bold text-gray-900">{calculateTotal().toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">Modifiez les quantités pour ajuster le total. Le prix unitaire n'est pas modifiable.</p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={() => navigate(`/orders/${id}`)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrderEdit;