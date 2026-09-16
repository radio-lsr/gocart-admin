import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, push, update, get } from 'firebase/database';
import toast from 'react-hot-toast';

const StoreForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    groupId: '',
    coordinates: { lat: '', lng: '' },
    deliveryFee: '',
    minOrderAmount: '',
    estimatedDeliveryTime: '',
    image: '',
    categories: [],
    isOpen: true,
    rating: 0,
    reviewCount: 0,
  });

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const currentGroupId = user?.groupId;

  // Charger les groupes pour super_admin
  useEffect(() => {
    if (isSuperAdmin) {
      const groupsRef = ref(database, 'groups');
      get(groupsRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          const groupsList = Object.entries(data).map(([id, group]) => ({
            id,
            name: group.name,
          }));
          setGroups(groupsList);
        }
      }).catch(console.error);
    }
  }, [isSuperAdmin]);

  // Charger les données du magasin en édition
  useEffect(() => {
    if (id) {
      const storeRef = ref(database, `stores/${id}`);
      get(storeRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          setFormData({
            name: data.name || '',
            address: data.address || '',
            phone: data.phone || '',
            groupId: data.groupId || (isGroupAdmin ? currentGroupId : ''),
            coordinates: data.coordinates || { lat: '', lng: '' },
            deliveryFee: data.deliveryFee || '',
            minOrderAmount: data.minOrderAmount || '',
            estimatedDeliveryTime: data.estimatedDeliveryTime || '',
            image: data.image || '',
            categories: data.categories || [],
            isOpen: data.isOpen !== undefined ? data.isOpen : true,
            rating: data.rating || 0,
            reviewCount: data.reviewCount || 0,
          });
        } else {
          toast.error('Magasin introuvable');
          navigate('/stores');
        }
      }).catch(console.error);
    } else if (isGroupAdmin && currentGroupId) {
      setFormData(prev => ({ ...prev, groupId: currentGroupId }));
    }
  }, [id, navigate, isGroupAdmin, currentGroupId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleCategoriesChange = (e) => {
    const categories = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, categories }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.name) {
        toast.error('Le nom du magasin est requis');
        setLoading(false);
        return;
      }
      if (!formData.groupId && isSuperAdmin) {
        toast.error('Veuillez sélectionner un groupe');
        setLoading(false);
        return;
      }
      if (!isSuperAdmin && !formData.groupId) {
        toast.error('Erreur : groupe non défini');
        setLoading(false);
        return;
      }

      const storeData = {
        ...formData,
        deliveryFee: parseFloat(formData.deliveryFee) || 0,
        minOrderAmount: parseFloat(formData.minOrderAmount) || 0,
        rating: parseFloat(formData.rating) || 0,
        reviewCount: parseInt(formData.reviewCount) || 0,
        updatedAt: new Date().toISOString(),
      };
      if (!id) storeData.createdAt = new Date().toISOString();

      if (id) {
        await update(ref(database, `stores/${id}`), storeData);
        toast.success('Magasin modifié');
      } else {
        await push(ref(database, 'stores'), storeData);
        toast.success('Magasin créé');
      }
      navigate('/stores');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'store_manager') {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800">Accès limité</h2>
          <p className="text-yellow-700 mt-2">
            Vous n'avez pas les droits pour ajouter ou modifier un magasin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{id ? 'Modifier le magasin' : 'Nouveau magasin'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Nom */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Nom du magasin *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>

        {/* Adresse */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Adresse *</label>
          <input type="text" name="address" value={formData.address} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>

        {/* Téléphone */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Téléphone</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>

        {/* Groupe (super_admin) */}
        {isSuperAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Groupe *</label>
            <select name="groupId" value={formData.groupId} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
              <option value="">Sélectionner un groupe</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Groupe (admin de groupe) */}
        {isGroupAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Groupe</label>
            <input type="text" value={groups.find(g => g.id === formData.groupId)?.name || formData.groupId} disabled className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" />
            <input type="hidden" name="groupId" value={formData.groupId} />
          </div>
        )}

        {/* Coordonnées */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Latitude</label>
            <input type="number" step="any" name="coordinates.lat" value={formData.coordinates.lat} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Longitude</label>
            <input type="number" step="any" name="coordinates.lng" value={formData.coordinates.lng} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
        </div>

        {/* Frais et minimum */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Frais de livraison (€)</label>
            <input type="number" step="0.01" name="deliveryFee" value={formData.deliveryFee} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Montant minimum (€)</label>
            <input type="number" step="0.01" name="minOrderAmount" value={formData.minOrderAmount} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
        </div>

        {/* Temps estimé */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Temps de livraison estimé</label>
          <input type="text" name="estimatedDeliveryTime" value={formData.estimatedDeliveryTime} onChange={handleChange} placeholder="ex: 15-25 min" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>

        {/* Image URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Image (URL)</label>
          <input type="url" name="image" value={formData.image} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>

        {/* Catégories */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Catégories (séparées par des virgules)</label>
          <input type="text" value={formData.categories.join(', ')} onChange={handleCategoriesChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>

        {/* Ouvert/fermé */}
        <div className="flex items-center">
          <input type="checkbox" name="isOpen" checked={formData.isOpen} onChange={handleChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
          <label className="ml-2 block text-sm text-gray-900">Magasin ouvert</label>
        </div>

        {/* Boutons */}
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => navigate('/stores')} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Enregistrement...' : (id ? 'Mettre à jour' : 'Créer')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoreForm;