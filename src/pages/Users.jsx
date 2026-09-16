import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserPlusIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingStorefrontIcon,
  CalendarIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STORE_MANAGER: 'store_manager',
  CASHIER: 'caissier',
};

const MANAGED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER, ROLES.CASHIER];

const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super administrateur',
  [ROLES.ADMIN]: 'Administrateur groupe',
  [ROLES.STORE_MANAGER]: 'Gérant',
  [ROLES.CASHIER]: 'Caissier',
};

const ROLE_COLORS = {
  [ROLES.SUPER_ADMIN]: 'bg-red-100 text-red-800',
  [ROLES.ADMIN]: 'bg-purple-100 text-purple-800',
  [ROLES.STORE_MANAGER]: 'bg-blue-100 text-blue-800',
  [ROLES.CASHIER]: 'bg-green-100 text-green-800',
};

const Users = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState({});
  const [groups, setGroups] = useState({});
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    superAdmins: 0,
    admins: 0,
    storeManagers: 0,
    cashiers: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });

  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;
  const isGroupAdmin = currentUser?.role === ROLES.ADMIN;
  const isStoreManager = currentUser?.role === ROLES.STORE_MANAGER;
  const currentGroupId = currentUser?.groupId;
  const currentStoreId = currentUser?.storeId;

  // Charger utilisateurs, magasins et groupes
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const storesRef = ref(database, 'stores');
    const groupsRef = ref(database, 'groups');

    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      let allUsers = [];
      if (data) {
        allUsers = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .filter((u) => MANAGED_ROLES.includes(u.role))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      setUsers(allUsers);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Impossible de charger les utilisateurs');
      setLoading(false);
    });

    const unsubscribeStores = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setStores(data);
    });

    const unsubscribeGroups = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGroups(data);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeStores();
      unsubscribeGroups();
    };
  }, []);

  // Filtrer selon la hiérarchie
  useEffect(() => {
    let filtered = [...users];

    if (isSuperAdmin) {
      // rien
    } else if (isGroupAdmin && currentGroupId) {
      const storeIdsInGroup = Object.keys(stores).filter(sid => stores[sid]?.groupId === currentGroupId);
      filtered = filtered.filter(u => {
        if (u.id === currentUser.uid) return true;
        if (u.role === ROLES.STORE_MANAGER || u.role === ROLES.CASHIER) {
          return storeIdsInGroup.includes(u.storeId);
        }
        return false;
      });
    } else if (isStoreManager && currentStoreId) {
      filtered = filtered.filter(u => u.role === ROLES.CASHIER && u.storeId === currentStoreId);
    } else {
      filtered = [];
    }

    // Recherche textuelle
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        (u.username?.toLowerCase().includes(term)) ||
        (u.email?.toLowerCase().includes(term)) ||
        (u.phone?.includes(term)) ||
        (u.marketName?.toLowerCase().includes(term))
      );
    }

    // Filtre rôle (pour super_admin et admin groupe)
    if (roleFilter !== 'all' && (isSuperAdmin || isGroupAdmin)) {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Filtre statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => u.status === statusFilter);
    }

    setFilteredUsers(filtered);
    calculateStats(filtered);
    setCurrentPage(1);
  }, [users, searchTerm, roleFilter, statusFilter, isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId, stores, currentUser]);

  const calculateStats = (userList) => {
    setStats({
      total: userList.length,
      superAdmins: userList.filter(u => u.role === ROLES.SUPER_ADMIN).length,
      admins: userList.filter(u => u.role === ROLES.ADMIN).length,
      storeManagers: userList.filter(u => u.role === ROLES.STORE_MANAGER).length,
      cashiers: userList.filter(u => u.role === ROLES.CASHIER).length,
      approved: userList.filter(u => u.status === 'approved').length,
      pending: userList.filter(u => u.status === 'pending').length,
      rejected: userList.filter(u => u.status === 'rejected').length,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getStatusLabel = (status) => ({
    pending: 'En attente',
    approved: 'Approuvé',
    rejected: 'Rejeté',
  }[status] || status);

  const getStatusColor = (status) => ({
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }[status] || 'bg-gray-100 text-gray-800');

  const canManageUser = (targetUser) => {
    if (isSuperAdmin) return true;
    if (isGroupAdmin) {
      if (targetUser.role === ROLES.ADMIN || targetUser.role === ROLES.SUPER_ADMIN) return false;
      const storeIdsInGroup = Object.keys(stores).filter(sid => stores[sid]?.groupId === currentGroupId);
      return storeIdsInGroup.includes(targetUser.storeId);
    }
    if (isStoreManager) {
      return targetUser.role === ROLES.CASHIER && targetUser.storeId === currentStoreId;
    }
    return false;
  };

  const handleApprove = async (userId, userRole, userName) => {
    if (!window.confirm(`Approuver ${ROLE_LABELS[userRole] || 'cet utilisateur'} ?`)) return;
    try {
      await update(ref(database, `users/${userId}`), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser?.uid,
        approvedByName: currentUser?.name || currentUser?.email,
      });
      toast.success('Utilisateur approuvé');
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleReject = async (userId, userRole) => {
    if (!window.confirm(`Rejeter ${ROLE_LABELS[userRole] || 'cet utilisateur'} ?`)) return;
    try {
      await update(ref(database, `users/${userId}`), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: currentUser?.uid,
        rejectedByName: currentUser?.name || currentUser?.email,
      });
      toast.success('Utilisateur rejeté');
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleResetStatus = async (userId, userRole) => {
    if (!window.confirm(`Réinitialiser le statut de ${ROLE_LABELS[userRole] || 'cet utilisateur'} ?`)) return;
    try {
      await update(ref(database, `users/${userId}`), {
        status: 'pending',
        approvedAt: null,
        approvedBy: null,
        approvedByName: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectedByName: null,
      });
      toast.success('Statut réinitialisé');
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleDelete = async (userId, userRole, userName) => {
    if (!window.confirm(`Supprimer définitivement "${userName || 'cet utilisateur'}" ?`)) return;
    try {
      await remove(ref(database, `users/${userId}`));
      toast.success('Utilisateur supprimé');
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-gray-600 mt-1">
            {isSuperAdmin && 'Gérez tous les comptes (super‑admins, admins de groupe, gérants, caissiers)'}
            {isGroupAdmin && 'Gérez les gérants et caissiers de votre groupe'}
            {isStoreManager && 'Gérez les caissiers de votre magasin'}
          </p>
        </div>
        <button
          onClick={() => navigate('/users/new')}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <UserPlusIcon className="h-5 w-5 mr-2" />
          {isSuperAdmin ? 'Ajouter un utilisateur' : isGroupAdmin ? 'Ajouter un gérant / caissier' : 'Ajouter un caissier'}
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold">{stats.total}</p></div>
        {isSuperAdmin && <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">Super‑admins</p><p className="text-2xl font-bold text-red-600">{stats.superAdmins}</p></div>}
        {isSuperAdmin && <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">Admins groupe</p><p className="text-2xl font-bold text-purple-600">{stats.admins}</p></div>}
        {(isSuperAdmin || isGroupAdmin) && <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">Gérants</p><p className="text-2xl font-bold text-blue-600">{stats.storeManagers}</p></div>}
        <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">Caissiers</p><p className="text-2xl font-bold text-green-600">{stats.cashiers}</p></div>
        <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">Approuvés</p><p className="text-2xl font-bold text-green-600">{stats.approved}</p></div>
        <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">En attente</p><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></div>
        <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-600">Rejetés</p><p className="text-2xl font-bold text-red-600">{stats.rejected}</p></div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-3 py-2 border rounded-md" />
          </div>
          {(isSuperAdmin || isGroupAdmin) && (
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border rounded-md px-3 py-2">
              <option value="all">Tous les rôles</option>
              {isSuperAdmin && <option value={ROLES.SUPER_ADMIN}>Super‑admins</option>}
              {isSuperAdmin && <option value={ROLES.ADMIN}>Admins groupe</option>}
              <option value={ROLES.STORE_MANAGER}>Gérants</option>
              <option value={ROLES.CASHIER}>Caissiers</option>
            </select>
          )}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-md px-3 py-2">
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="approved">Approuvés</option>
            <option value="rejected">Rejetés</option>
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magasin</th>
              {isSuperAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Groupe</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inscription</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold">{u.username?.charAt(0).toUpperCase() || 'U'}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{u.username || 'Nom non renseigné'}</div>
                      <div className="text-sm text-gray-500 flex items-center"><EnvelopeIcon className="h-4 w-4 mr-1" />{u.email || '-'}</div>
                      {u.phone && <div className="text-sm text-gray-500 flex items-center"><PhoneIcon className="h-4 w-4 mr-1" />{u.phone}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <BuildingStorefrontIcon className="h-4 w-4 mr-2 text-gray-400" />
                    {u.marketName || u.storeName || 'Non spécifié'}
                  </div>
                </td>
                {isSuperAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {groups[u.groupId]?.name || u.groupId || '-'}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(u.status)}`}>
                    {getStatusLabel(u.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {canManageUser(u) && (
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => navigate(`/users/${u.id}`)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Modifier"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      {u.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(u.id, u.role, u.username)} className="text-green-600 hover:text-green-900" title="Approuver">
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleReject(u.id, u.role)} className="text-red-600 hover:text-red-900" title="Rejeter">
                            <XCircleIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {(u.status === 'approved' || u.status === 'rejected') && (
                        <>
                          <button onClick={() => handleResetStatus(u.id, u.role)} className="text-yellow-600 hover:text-yellow-900" title="Réinitialiser">
                            <ArrowPathIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDelete(u.id, u.role, u.username)} className="text-gray-600 hover:text-gray-900" title="Supprimer">
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {currentItems.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center text-gray-500">Aucun utilisateur trouvé</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <div className="flex justify-between items-center bg-white px-4 py-3 rounded shadow">
          <div className="text-sm text-gray-700">Page {currentPage} / {totalPages}</div>
          <div className="flex space-x-2">
            <button onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage===1} className="px-3 py-1 border rounded disabled:opacity-50">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(p+1, totalPages))} disabled={currentPage===totalPages} className="px-3 py-1 border rounded disabled:opacity-50">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;