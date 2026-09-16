import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database, auth } from '../firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, UserIcon, EnvelopeIcon, PhoneIcon, LockClosedIcon, BuildingStorefrontIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STORE_MANAGER: 'store_manager',
  CASHIER: 'caissier',
};

const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super administrateur',
  [ROLES.ADMIN]: 'Administrateur groupe',
  [ROLES.STORE_MANAGER]: 'Gérant',
  [ROLES.CASHIER]: 'Caissier',
};

const UserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    phone: '',
    role: ROLES.ADMIN,
    storeId: '',
    groupId: '',
    marketName: '',
    status: 'pending',
  });

  const [stores, setStores] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id);
  const [errors, setErrors] = useState({});
  const [showAdminPasswordPrompt, setShowAdminPasswordPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;
  const isGroupAdmin = currentUser?.role === ROLES.ADMIN;
  const isStoreManager = currentUser?.role === ROLES.STORE_MANAGER;
  const currentGroupId = currentUser?.groupId;
  const currentStoreId = currentUser?.storeId;

  const getAvailableRoles = () => {
    if (isSuperAdmin) return [ROLES.ADMIN, ROLES.STORE_MANAGER];
    if (isGroupAdmin) return [ROLES.STORE_MANAGER, ROLES.CASHIER];
    if (isStoreManager) return [ROLES.CASHIER];
    return [];
  };

  // 🔄 Réinitialisation du formulaire en mode création
  useEffect(() => {
    if (!id) {
      setFormData({
        email: '',
        password: '',
        username: '',
        phone: '',
        role: ROLES.ADMIN,
        storeId: '',
        groupId: '',
        marketName: '',
        status: 'pending',
      });
      setErrors({});
      setAdminPassword('');
      setShowAdminPasswordPrompt(false);
    }
  }, [id]);

  // Charger magasins et groupes
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const groupsRef = ref(database, 'groups');

    const unsubStores = onValue(storesRef, (snap) => {
      const data = snap.val();
      if (data) setStores(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      else setStores([]);
    });
    const unsubGroups = onValue(groupsRef, (snap) => {
      const data = snap.val();
      if (data) setGroups(Object.keys(data).map(k => ({ id: k, name: data[k].name })));
      else setGroups([]);
    });

    return () => {
      unsubStores();
      unsubGroups();
    };
  }, []);

  // Charger les données en mode édition
  useEffect(() => {
    if (!id) return;
    setFetchLoading(true);
    const userRef = ref(database, `users/${id}`);
    const unsub = onValue(userRef, (snap) => {
      const data = snap.val();
      if (data) {
        setFormData({
          email: data.email || '',
          username: data.username || '',
          phone: data.phone || '',
          role: data.role || ROLES.ADMIN,
          storeId: data.storeId || '',
          groupId: data.groupId || '',
          marketName: data.marketName || '',
          status: data.status || 'pending',
          password: '',
        });
      } else {
        toast.error('Utilisateur introuvable');
        navigate('/users');
      }
      setFetchLoading(false);
    });
    return () => unsub();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!id && !formData.email) newErrors.email = 'Email requis';
    else if (!id && !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email invalide';
    if (!id && !formData.password) newErrors.password = 'Mot de passe requis';
    else if (!id && formData.password.length < 6) newErrors.password = '6 caractères minimum';
    if (!formData.username) newErrors.username = 'Nom d\'utilisateur requis';
    if (formData.role !== ROLES.SUPER_ADMIN && formData.role !== ROLES.ADMIN && !formData.storeId) {
      newErrors.storeId = 'Magasin requis pour ce rôle';
    }
    if (isSuperAdmin && formData.role === ROLES.ADMIN && !formData.groupId && !id) {
      newErrors.groupId = 'Groupe requis pour le rôle Administrateur groupe';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!id) {
      setShowAdminPasswordPrompt(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    setLoading(true);
    try {
      if (id) {
        const updateData = {
          username: formData.username,
          phone: formData.phone || null,
          role: formData.role,
          storeId: formData.role !== ROLES.SUPER_ADMIN && formData.role !== ROLES.ADMIN ? formData.storeId : null,
          groupId: formData.role === ROLES.ADMIN ? formData.groupId : null,
          marketName: stores.find(s => s.id === formData.storeId)?.name || null,
          status: formData.status,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.uid,
        };
        await update(ref(database, `users/${id}`), updateData);
        toast.success('Utilisateur modifié');
        navigate('/users');
      } else {
        const adminEmail = auth.currentUser?.email;
        if (!adminEmail) throw new Error('Admin non connecté');

        const userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const uid = userCred.user.uid;

        const newUser = {
          email: formData.email,
          username: formData.username,
          phone: formData.phone || null,
          role: formData.role,
          storeId: (formData.role !== ROLES.SUPER_ADMIN && formData.role !== ROLES.ADMIN) ? formData.storeId : null,
          groupId: formData.role === ROLES.ADMIN ? formData.groupId : null,
          marketName: stores.find(s => s.id === formData.storeId)?.name || null,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: currentUser?.uid,
        };
        await set(ref(database, `users/${uid}`), newUser);

        await signOut(auth);
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        setAdminPassword('');

        toast.success('Utilisateur créé');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Cet email est déjà utilisé');
      } else {
        toast.error('Erreur lors de l’enregistrement');
      }
    } finally {
      setLoading(false);
      setShowAdminPasswordPrompt(false);
    }
  };

  const filteredStores = () => {
    if (isStoreManager) return stores.filter(s => s.id === currentStoreId);
    if (isGroupAdmin && currentGroupId) return stores.filter(s => s.groupId === currentGroupId);
    return stores;
  };

  const availableGroups = groups;

  if (fetchLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/users')} className="mr-4 p-2 rounded-full hover:bg-gray-100"><ArrowLeftIcon className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">{id ? 'Modifier un utilisateur' : 'Ajouter un utilisateur'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium">Email *</label>
          <div className="relative">
            <EnvelopeIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!!id}
              autoComplete="off"
              className={`w-full pl-10 pr-3 py-2 border rounded-md ${id ? 'bg-gray-100' : 'bg-white'} ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {!id && (
          <div>
            <label className="block text-sm font-medium">Mot de passe *</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                className={`w-full pl-10 pr-3 py-2 border rounded-md ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
        )}

        {/* Nom d'utilisateur */}
        <div>
          <label className="block text-sm font-medium">Nom d'utilisateur *</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={`w-full pl-10 pr-3 py-2 border rounded-md ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>
          {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
        </div>

        {/* Téléphone */}
        <div>
          <label className="block text-sm font-medium">Téléphone</label>
          <div className="relative">
            <PhoneIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>

        {/* Rôle */}
        <div>
          <label className="block text-sm font-medium">Rôle *</label>
          <div className="relative">
            <ShieldCheckIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <select name="role" value={formData.role} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md">
              {getAvailableRoles().map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </div>
        </div>

        {/* Groupe (super_admin et rôle ADMIN) */}
        {isSuperAdmin && formData.role === ROLES.ADMIN && (
          <div>
            <label className="block text-sm font-medium">Groupe *</label>
            <select name="groupId" value={formData.groupId} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md ${errors.groupId ? 'border-red-500' : 'border-gray-300'}`}>
              <option value="">Sélectionner un groupe</option>
              {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {errors.groupId && <p className="text-red-500 text-xs mt-1">{errors.groupId}</p>}
          </div>
        )}

        {/* Magasin (pour store_manager et caissier) */}
        {formData.role !== ROLES.SUPER_ADMIN && formData.role !== ROLES.ADMIN && (
          <div>
            <label className="block text-sm font-medium">Magasin *</label>
            <div className="relative">
              <BuildingStorefrontIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <select name="storeId" value={formData.storeId} onChange={handleChange} className={`w-full pl-10 pr-3 py-2 border rounded-md ${errors.storeId ? 'border-red-500' : 'border-gray-300'}`}>
                <option value="">Sélectionner un magasin</option>
                {filteredStores().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {errors.storeId && <p className="text-red-500 text-xs mt-1">{errors.storeId}</p>}
          </div>
        )}

        {/* Statut (modification) */}
        {id && (
          <div>
            <label className="block text-sm font-medium">Statut</label>
            <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="pending">En attente</option>
              <option value="approved">Approuvé</option>
              <option value="rejected">Rejeté</option>
            </select>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={() => navigate('/users')} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Enregistrement...' : (id ? 'Mettre à jour' : 'Créer')}
          </button>
        </div>
      </form>

      {/* Modal pour mot de passe admin */}
      {showAdminPasswordPrompt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmation requise</h3>
            <p className="text-sm text-gray-600 mb-4">
              Pour créer un utilisateur, veuillez saisir votre mot de passe administrateur.
            </p>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md mb-4"
              placeholder="Mot de passe"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAdminPasswordPrompt(false);
                  setAdminPassword('');
                }}
                className="px-4 py-2 border rounded-md text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={performSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserForm;