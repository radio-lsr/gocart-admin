import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  NoSymbolIcon,
  ArrowPathIcon,
  UserCircleIcon,
  IdentificationIcon,
  TruckIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

// Simulation d'envoi d'email (à remplacer par un vrai appel API)
const sendShopperStatusEmail = async (shopper, newStatus, reason = '') => {
  try {
    const response = await fetch('/api/send-shopper-status-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: shopper.email,
        displayName: shopper.displayName,
        status: newStatus,
        reason: reason,
      }),
    });
    if (!response.ok) throw new Error('Erreur envoi email');
    return true;
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return false;
  }
};

const Shoppers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shoppers, setShoppers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const currentGroupId = user?.groupId;
  const currentStoreId = user?.storeId;

  // Chargement des shoppers
  useEffect(() => {
    const shoppersRef = ref(database, 'shoppers');
    const unsubscribe = onValue(shoppersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const shoppersList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
          status: data[key].status || 'pending',
          isAvailable: data[key].isAvailable ?? false,
          documentsVerified: data[key].documentsVerified ?? false,
          displayName: data[key].displayName || '',
          email: data[key].email || '',
          phoneNumber: data[key].phoneNumber || '',
          role: data[key].role || '',
          createdAt: data[key].createdAt || null,
          idFrontUrl: data[key].idFrontUrl || '',
          idBackUrl: data[key].idBackUrl || '',
          driversLicenseUrl: data[key].driversLicenseUrl || '',
          vehicleInsuranceUrl: data[key].vehicleInsuranceUrl || '',
          profilePhotoUrl: data[key].profilePhotoUrl || '',
          address: data[key].address || '',
          dateOfBirth: data[key].dateOfBirth || '',
          gender: data[key].gender || '',
        }));
        setShoppers(shoppersList);
      } else {
        setShoppers([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const canManageShopper = (shopper) => {
    if (isSuperAdmin) return true;
    if (isGroupAdmin && currentGroupId) {
      return !shopper.groupId || shopper.groupId === currentGroupId;
    }
    if (isStoreManager && currentStoreId) {
      return !shopper.storeId || shopper.storeId === currentStoreId;
    }
    return false;
  };

  const handleApprove = async (shopperId) => {
    const shopper = shoppers.find((s) => s.id === shopperId);
    if (!shopper || !canManageShopper(shopper)) {
      toast.error('Vous n’avez pas les droits pour approuver ce livreur');
      return;
    }
    if (!window.confirm(`Approuver la candidature de ${shopper.displayName} ?`)) return;

    try {
      await update(ref(database, `shoppers/${shopperId}`), { status: 'approved' });
      toast.success('Candidature approuvée');
      const emailSent = await sendShopperStatusEmail(shopper, 'approved');
      if (!emailSent) toast.error('Livreur approuvé mais l’envoi d’email a échoué');
      else toast.success('Email de confirmation envoyé');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l’approbation');
    }
  };

  const handleReject = async (shopperId) => {
    const shopper = shoppers.find((s) => s.id === shopperId);
    if (!shopper || !canManageShopper(shopper)) {
      toast.error('Vous n’avez pas les droits pour rejeter ce livreur');
      return;
    }
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Veuillez indiquer un motif de rejet');
      return;
    }
    if (!window.confirm(`Rejeter la candidature de ${shopper.displayName} ?`)) return;

    try {
      await update(ref(database, `shoppers/${shopperId}`), { status: 'rejected' });
      toast.success('Candidature rejetée');
      const emailSent = await sendShopperStatusEmail(shopper, 'rejected', reason);
      if (!emailSent) toast.error('Livreur rejeté mais l’envoi d’email a échoué');
      else toast.success('Email de rejet envoyé');
      setShowRejectModal(null);
      setRejectReason('');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du rejet');
    }
  };

  const handleStatusChange = async (shopperId, newStatus) => {
    const shopper = shoppers.find((s) => s.id === shopperId);
    if (!shopper || !canManageShopper(shopper)) {
      toast.error('Vous n’avez pas les droits pour modifier ce livreur');
      return;
    }
    const actionLabels = {
      approved: 'approuver',
      rejected: 'rejeter',
      blocked: 'bloquer',
      pending: 'remettre en attente',
    };
    if (!window.confirm(`Voulez-vous ${actionLabels[newStatus] || 'changer le statut'} ce livreur ?`))
      return;

    await update(ref(database, `shoppers/${shopperId}`), { status: newStatus });
    toast.success(`Statut mis à jour : ${newStatus}`);
    if (newStatus === 'blocked') {
      await sendShopperStatusEmail(shopper, 'blocked', 'Votre compte a été bloqué.');
    } else if (newStatus === 'approved') {
      await sendShopperStatusEmail(shopper, 'approved');
    }
  };

  const handleDelete = (shopperId) => {
    const shopper = shoppers.find((s) => s.id === shopperId);
    if (!shopper || !canManageShopper(shopper)) {
      toast.error('Vous n’avez pas les droits pour supprimer ce livreur');
      return;
    }
    if (window.confirm('Supprimer définitivement ce livreur ?')) {
      remove(ref(database, `shoppers/${shopperId}`))
        .then(() => toast.success('Livreur supprimé'))
        .catch(() => toast.error('Erreur lors de la suppression'));
    }
  };

  const viewDocument = (url, label) => {
    if (!url) {
      toast.error(`Document ${label} non disponible`);
      return;
    }
    window.open(url, '_blank');
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      blocked: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      pending: 'En attente',
      approved: 'Approuvé',
      rejected: 'Rejeté',
      blocked: 'Bloqué',
    };
    return { color: badges[status] || 'bg-gray-100 text-gray-800', label: labels[status] || status };
  };

  const filteredShoppers = shoppers.filter((shopper) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (shopper.displayName && shopper.displayName.toLowerCase().includes(searchLower)) ||
      (shopper.email && shopper.email.toLowerCase().includes(searchLower)) ||
      (shopper.phoneNumber && shopper.phoneNumber.includes(searchTerm));
    const matchesStatus = statusFilter === 'all' || shopper.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredShoppers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredShoppers.length / itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestion des livreurs</h1>
      </div>

      {/* Barre de recherche et filtre */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-4 py-2"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvés</option>
          <option value="rejected">Rejetés</option>
          <option value="blocked">Bloqués</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.map((shopper) => {
                const { color, label } = getStatusBadge(shopper.status);
                const canManage = canManageShopper(shopper);
                const isPending = shopper.status === 'pending';
                const hasDocuments =
                  shopper.idFrontUrl ||
                  shopper.idBackUrl ||
                  shopper.driversLicenseUrl ||
                  shopper.vehicleInsuranceUrl ||
                  shopper.profilePhotoUrl;

                return (
                  <tr key={shopper.id}>
                    {/* Colonne Nom */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {shopper.profilePhotoUrl ? (
                          <img
                            src={shopper.profilePhotoUrl}
                            alt={shopper.displayName}
                            className="h-8 w-8 rounded-full object-cover mr-3"
                          />
                        ) : (
                          <UserCircleIcon className="h-8 w-8 text-gray-400 mr-3" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{shopper.displayName || '—'}</div>
                          <div className="text-xs text-gray-500">{shopper.phoneNumber || ''}</div>
                        </div>
                      </div>
                    </td>

                    {/* Colonne Contact */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{shopper.email}</div>
                      <div className="text-xs text-gray-500">{shopper.address?.substring(0, 30)}</div>
                    </td>

                    {/* Colonne Documents */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          {shopper.idFrontUrl && (
                            <button
                              onClick={() => viewDocument(shopper.idFrontUrl, 'recto CNI')}
                              className="text-blue-600 hover:text-blue-800"
                              title="Voir recto CNI"
                            >
                              <IdentificationIcon className="h-5 w-5" />
                            </button>
                          )}
                          {shopper.idBackUrl && (
                            <button
                              onClick={() => viewDocument(shopper.idBackUrl, 'verso CNI')}
                              className="text-blue-600 hover:text-blue-800"
                              title="Voir verso CNI"
                            >
                              <IdentificationIcon className="h-5 w-5" />
                            </button>
                          )}
                          {shopper.driversLicenseUrl && (
                            <button
                              onClick={() => viewDocument(shopper.driversLicenseUrl, 'permis')}
                              className="text-blue-600 hover:text-blue-800"
                              title="Permis de conduire"
                            >
                              <TruckIcon className="h-5 w-5" />
                            </button>
                          )}
                          {shopper.vehicleInsuranceUrl && (
                            <button
                              onClick={() => viewDocument(shopper.vehicleInsuranceUrl, 'assurance')}
                              className="text-blue-600 hover:text-blue-800"
                              title="Assurance véhicule"
                            >
                              <ShieldCheckIcon className="h-5 w-5" />
                            </button>
                          )}
                          {shopper.profilePhotoUrl && (
                            <button
                              onClick={() => viewDocument(shopper.profilePhotoUrl, 'photo')}
                              className="text-blue-600 hover:text-blue-800"
                              title="Photo de profil"
                            >
                              <UserCircleIcon className="h-5 w-5" />
                            </button>
                          )}
                          {!hasDocuments && <span className="text-gray-400 text-xs">Aucun document</span>}
                        </div>
                      ) : (
                        <div>
                          {shopper.documentsVerified ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-600" title="Vérifié" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-600" title="Non vérifié" />
                          )}
                        </div>
                      )}
                    </td>

                    {/* Colonne Statut */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${color}`}>
                        {label}
                      </span>
                    </td>

                    {/* Colonne Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprove(shopper.id)}
                                className="text-green-600 hover:text-green-900"
                                title="Approuver"
                              >
                                <CheckCircleIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => setShowRejectModal(shopper.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Rejeter"
                              >
                                <XCircleIcon className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          {shopper.status === 'approved' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(shopper.id, 'blocked')}
                                className="text-gray-600 hover:text-gray-900"
                                title="Bloquer"
                              >
                                <NoSymbolIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleStatusChange(shopper.id, 'pending')}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Remettre en attente"
                              >
                                <ArrowPathIcon className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          {shopper.status === 'blocked' && (
                            <button
                              onClick={() => handleStatusChange(shopper.id, 'approved')}
                              className="text-green-600 hover:text-green-900"
                              title="Débloquer"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                          )}
                          {shopper.status === 'rejected' && (
                            <button
                              onClick={() => handleStatusChange(shopper.id, 'pending')}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Remettre en attente"
                            >
                              <ArrowPathIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/shoppers/${shopper.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Modifier"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(shopper.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Supprimer"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    Aucun livreur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredShoppers.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="text-sm text-gray-700">
                Affichage de <span className="font-medium">{indexOfFirstItem + 1}</span> à{' '}
                <span className="font-medium">{Math.min(indexOfLastItem, filteredShoppers.length)}</span> sur{' '}
                <span className="font-medium">{filteredShoppers.length}</span> livreurs
              </div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
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
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
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

      {/* Modal de rejet */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Motif du rejet</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md p-2 mb-4"
              placeholder="Expliquez pourquoi la candidature est rejetée..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 border rounded-md"
              >
                Annuler
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shoppers;