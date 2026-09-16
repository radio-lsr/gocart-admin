// src/pages/GroupsManager.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue, set, update, remove, get } from 'firebase/database';
import toast from 'react-hot-toast';
import {
  BuildingStorefrontIcon,
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const GroupsManager = () => {
  const { user: currentUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    status: 'active',
  });
  const [submitting, setSubmitting] = useState(false);

  // Vérifier que l'utilisateur est super-admin
  useEffect(() => {
    if (currentUser?.role !== 'super_admin') {
      toast.error('Accès non autorisé');
    }
  }, [currentUser]);

  // Charger les groupes, magasins et utilisateurs
  useEffect(() => {
    const groupsRef = ref(database, 'groups');
    const storesRef = ref(database, 'stores');
    const usersRef = ref(database, 'users');

    const unsubscribeGroups = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const groupsList = Object.entries(data).map(([id, group]) => ({
          id,
          ...group,
        }));
        setGroups(groupsList);
      } else {
        setGroups([]);
      }
    });

    const unsubscribeStores = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesList = Object.entries(data).map(([id, store]) => ({
          id,
          ...store,
        }));
        setStores(storesList);
      } else {
        setStores([]);
      }
    });

    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const usersList = Object.entries(data).map(([id, user]) => ({
          id,
          ...user,
        }));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeStores();
      unsubscribeUsers();
    };
  }, []);

  // Générer un groupId à partir du nom
  const generateGroupId = (groupName) => {
    // Extraire les initiales (mots séparés par espaces, tirets, underscores)
    const words = groupName.split(/[\s\-_]+/);
    let prefix = words.map(w => w.charAt(0).toUpperCase()).join('');
    // Limiter à 4 caractères
    prefix = prefix.slice(0, 4);
    // Générer un nombre hexadécimal aléatoire sur 4 chiffres
    const hex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return `${prefix}_${hex}`;
  };

  // Vérifier si un groupId existe déjà
  const checkGroupIdExists = async (groupId) => {
    const groupRef = ref(database, `groups/${groupId}`);
    const snapshot = await get(groupRef);
    return snapshot.exists();
  };

  // Compter les magasins et utilisateurs d'un groupe
  const getGroupStats = (groupId) => {
    const storeCount = stores.filter(store => store.groupId === groupId).length;
    const userCount = users.filter(user => user.groupId === groupId).length;
    return { storeCount, userCount };
  };

  // Ouvrir modal pour ajouter
  const handleAdd = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: '',
      status: 'active',
    });
    setModalOpen(true);
  };

  // Ouvrir modal pour modifier
  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name || '',
      address: group.address || '',
      phone: group.phone || '',
      email: group.email || '',
      status: group.status || 'active',
    });
    setModalOpen(true);
  };

  // Sauvegarder (ajout ou modification)
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Le nom du groupe est requis');
      return;
    }

    setSubmitting(true);
    try {
      if (editingGroup) {
        // Modification : conserver l'ID existant
        const groupRef = ref(database, `groups/${editingGroup.id}`);
        await update(groupRef, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Groupe modifié avec succès');
      } else {
        // Ajout : générer un groupId unique
        let basePrefix = '';
        const words = formData.name.split(/[\s\-_]+/);
        basePrefix = words.map(w => w.charAt(0).toUpperCase()).join('').slice(0, 4);
        
        let finalId = generateGroupId(formData.name);
        let attempts = 0;
        while (await checkGroupIdExists(finalId) && attempts < 5) {
          // En cas de collision, regénérer la partie hexadécimale
          const hex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
          finalId = `${basePrefix}_${hex}`;
          attempts++;
        }
        
        const groupRef = ref(database, `groups/${finalId}`);
        await set(groupRef, {
          ...formData,
          groupId: finalId, // stocker l'ID dans les données pour référence
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success(`Groupe ajouté avec l'identifiant : ${finalId}`);
      }
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  // Supprimer un groupe (avec vérification des dépendances)
  const handleDelete = async (groupId, groupName) => {
    const { storeCount, userCount } = getGroupStats(groupId);
    let confirmMessage = `Supprimer le groupe "${groupName}" ?`;
    if (storeCount > 0 || userCount > 0) {
      confirmMessage += `\n\n⚠️ Attention : ce groupe contient ${storeCount} magasin(s) et ${userCount} utilisateur(s). Toutes ces données seront également supprimées.`;
    }
    if (!window.confirm(confirmMessage)) return;

    setSubmitting(true);
    try {
      // 1. Récupérer les magasins du groupe
      const storesToDelete = stores.filter(store => store.groupId === groupId);
      // 2. Récupérer les utilisateurs du groupe
      const usersToDelete = users.filter(user => user.groupId === groupId);

      // 3. Supprimer les magasins (et leurs dépendances ? à adapter)
      for (const store of storesToDelete) {
        await remove(ref(database, `stores/${store.id}`));
      }

      // 4. Supprimer les utilisateurs
      for (const user of usersToDelete) {
        await remove(ref(database, `users/${user.id}`));
      }

      // 5. Supprimer le groupe
      await remove(ref(database, `groups/${groupId}`));
      toast.success('Groupe et ses dépendances supprimés');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setSubmitting(false);
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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groupes de supermarchés</h1>
          <p className="text-gray-600 mt-1">
            Gérez les groupes (chaîne de magasins) et leurs filiales
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nouveau groupe
        </button>
      </div>

      {/* Liste des groupes */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {groups.length === 0 ? (
          <div className="p-12 text-center">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun groupe</h3>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer un groupe de supermarchés.
            </p>
            <div className="mt-6">
              <button
                onClick={handleAdd}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Nouveau groupe
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Groupe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statistiques
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groups.map((group) => {
                  const { storeCount, userCount } = getGroupStats(group.id);
                  return (
                    <tr key={group.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{group.name}</div>
                        <div className="text-xs text-gray-400 font-mono">ID: {group.id}</div>
                        <div className="text-sm text-gray-500">{group.address}</div>
                      </td>
                      <td className="px-6 py-4">
                        {group.phone && <div className="text-sm text-gray-600">{group.phone}</div>}
                        {group.email && <div className="text-sm text-gray-500">{group.email}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <BuildingStorefrontIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {storeCount} magasin{storeCount > 1 ? 's' : ''}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <UserGroupIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {userCount} utilisateur{userCount > 1 ? 's' : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            group.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {group.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(group)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="Modifier"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(group.id, group.name)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal d'ajout / modification */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingGroup ? 'Modifier le groupe' : 'Ajouter un groupe'}
                  </h3>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom du groupe *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Ex: U KIN MARCHE"
                    />
                    {!editingGroup && (
                      <p className="mt-1 text-xs text-gray-500">
                        L'identifiant du groupe sera généré automatiquement (ex: UKM_A3F2)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Adresse</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Adresse principale"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="+243 XXX XXX XXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="contact@groupe.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsManager;