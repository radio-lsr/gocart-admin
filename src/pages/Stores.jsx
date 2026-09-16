import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue, remove } from 'firebase/database';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BuildingStorefrontIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const Stores = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [groups, setGroups] = useState({});
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const currentGroupId = user?.groupId;
  const currentStoreId = user?.storeId;

  // Charger les groupes (pour super_admin)
  useEffect(() => {
    if (isSuperAdmin) {
      const groupsRef = ref(database, 'groups');
      const unsubscribe = onValue(groupsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) setGroups(data);
      });
      return () => unsubscribe();
    }
  }, [isSuperAdmin]);

  // Charger les magasins avec filtrage hiérarchique
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      let storesList = [];
      if (data) {
        storesList = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));
      }

      let filtered = storesList;
      if (isSuperAdmin) {
        // tous
      } else if (isGroupAdmin && currentGroupId) {
        filtered = storesList.filter(store => store.groupId === currentGroupId);
      } else if (isStoreManager && currentStoreId) {
        filtered = storesList.filter(store => store.id === currentStoreId);
      } else {
        filtered = [];
      }

      setStores(filtered);
      setFilteredStores(filtered);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId]);

  // Recherche
  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = stores.filter(store =>
        store.name?.toLowerCase().includes(term) ||
        store.address?.toLowerCase().includes(term) ||
        store.phone?.includes(term)
      );
      setFilteredStores(filtered);
    } else {
      setFilteredStores(stores);
    }
    setCurrentPage(1);
  }, [searchTerm, stores]);

  const handleDelete = (storeId, storeName) => {
    if (window.confirm(`Supprimer le magasin "${storeName}" ?`)) {
      remove(ref(database, `stores/${storeId}`))
        .then(() => toast.success('Magasin supprimé'))
        .catch(err => toast.error('Erreur lors de la suppression'));
    }
  };

  const canEdit = (store) => {
    if (isSuperAdmin) return true;
    if (isGroupAdmin && store.groupId === currentGroupId) return true;
    if (isStoreManager && store.id === currentStoreId) return true;
    return false;
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredStores.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredStores.length / itemsPerPage);

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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des magasins</h1>
          <p className="text-gray-600 mt-1">
            {isSuperAdmin && 'Liste de tous les magasins'}
            {isGroupAdmin && `Magasins de votre groupe`}
            {isStoreManager && `Votre magasin`}
          </p>
        </div>
        {(isSuperAdmin || isGroupAdmin) && (
          <button
            onClick={() => navigate('/stores/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Nouveau magasin
          </button>
        )}
      </div>

      {/* Filtre recherche */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="relative max-w-lg">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, adresse, téléphone..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Magasin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                {isSuperAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Groupe</th>}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frais liv.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.map(store => (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center">
                        <BuildingStorefrontIcon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{store.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{store.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{store.phone}</td>
                  {isSuperAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {groups[store.groupId]?.name || store.groupId || '-'}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{store.deliveryFee} €</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${store.isOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {store.isOpen ? 'Ouvert' : 'Fermé'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {canEdit(store) && (
                      <>
                        <button onClick={() => navigate(`/stores/${store.id}`)} className="text-blue-600 hover:text-blue-900 mr-3">
                          <PencilIcon className="h-5 w-5 inline" />
                        </button>
                        <button onClick={() => handleDelete(store.id, store.name)} className="text-red-600 hover:text-red-900">
                          <TrashIcon className="h-5 w-5 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredStores.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                    Aucun magasin trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredStores.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">
                Affichage de <span className="font-medium">{indexOfFirstItem + 1}</span> à{' '}
                <span className="font-medium">{Math.min(indexOfLastItem, filteredStores.length)}</span> sur{' '}
                <span className="font-medium">{filteredStores.length}</span> magasins
              </p>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      currentPage === i + 1
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stores;