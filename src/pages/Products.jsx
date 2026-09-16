import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [importData, setImportData] = useState([]);
  const [categories, setCategories] = useState(['Tous']);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0
  });
  const [stores, setStores] = useState([]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isGroupAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const currentGroupId = user?.groupId;
  const currentStoreId = user?.storeId;

  // Charger les magasins
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let storesList = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name,
          groupId: data[key].groupId,
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
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId]);

  // Charger les produits
  useEffect(() => {
    const productsRef = ref(database, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let productsList = Object.keys(data).map(barcode => ({
          barcode,
          ...data[barcode]
        }));
        if (isSuperAdmin) {
          // tous
        } else if (isGroupAdmin && currentGroupId) {
          const accessibleStoreIds = stores.map(s => s.id);
          productsList = productsList.filter(p => accessibleStoreIds.includes(p.storeId));
        } else if (isStoreManager && currentStoreId) {
          productsList = productsList.filter(p => p.storeId === currentStoreId);
        } else {
          productsList = [];
        }
        setProducts(productsList);
        setFilteredProducts(productsList);
        const uniqueCategories = ['Tous', ...new Set(productsList.map(p => p.category || 'Général'))];
        setCategories(uniqueCategories);
        const totalValue = productsList.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);
        const lowStock = productsList.filter(p => (p.stock || 0) <= (p.minStock || 5)).length;
        const outOfStock = productsList.filter(p => (p.stock || 0) === 0).length;
        setStats({
          totalProducts: productsList.length,
          totalValue,
          lowStock,
          outOfStock
        });
      } else {
        setProducts([]);
        setFilteredProducts([]);
        setCategories(['Tous']);
        setStats({
          totalProducts: 0,
          totalValue: 0,
          lowStock: 0,
          outOfStock: 0
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('❌ Erreur Firebase:', error);
      toast.error('Erreur de connexion à Firebase');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isGroupAdmin, isStoreManager, currentGroupId, currentStoreId, stores]);

  // Filtrer les produits
  useEffect(() => {
    let filtered = [...products];
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory !== 'Tous') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, products]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const canManageProduct = (product) => {
    if (isSuperAdmin) return true;
    if (isGroupAdmin) {
      const store = stores.find(s => s.id === product.storeId);
      return store && store.groupId === currentGroupId;
    }
    if (isStoreManager) {
      return product.storeId === currentStoreId;
    }
    return false;
  };

  const handleAddProduct = async (productData) => {
    try {
      const productRef = ref(database, `products/${productData.barcode}`);
      await set(productRef, {
        ...productData,
        price: parseFloat(productData.price) || 0,
        stock: parseInt(productData.stock) || 0,
        minStock: parseInt(productData.minStock) || 5,
        isActive: true,
        taxRate: productData.taxRate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid,
        storeId: productData.storeId,
      });
      toast.success('Produit ajouté avec succès !');
      setShowAddModal(false);
    } catch (error) {
      console.error('Erreur ajout produit:', error);
      toast.error('Erreur lors de l\'ajout du produit');
    }
  };

  const handleUpdateProduct = async (barcode, updates) => {
    try {
      const productRef = ref(database, `products/${barcode}`);
      await update(productRef, {
        ...updates,
        price: updates.price !== undefined ? parseFloat(updates.price) : undefined,
        stock: updates.stock !== undefined ? parseInt(updates.stock) : undefined,
        taxRate: updates.taxRate !== undefined ? updates.taxRate : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid
      });
      toast.success('Produit mis à jour avec succès !');
      setShowEditModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Erreur mise à jour produit:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteProduct = async (barcode, productName) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${productName}" ?`)) {
      try {
        const productRef = ref(database, `products/${barcode}`);
        await remove(productRef);
        toast.success('Produit supprimé avec succès !');
      } catch (error) {
        console.error('Erreur suppression produit:', error);
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleDuplicateProduct = async (product) => {
    const newBarcode = `${product.barcode}-copy-${Date.now()}`;
    try {
      const productRef = ref(database, `products/${newBarcode}`);
      await set(productRef, {
        ...product,
        barcode: newBarcode,
        name: `${product.name} (copie)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid
      });
      toast.success('Produit dupliqué avec succès !');
    } catch (error) {
      console.error('Erreur duplication produit:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let importedProducts = [];
      if (fileExtension === 'csv') importedProducts = await processCSV(file);
      else if (fileExtension === 'json') importedProducts = await processJSON(file);
      else if (['xlsx', 'xls'].includes(fileExtension)) importedProducts = await processExcel(file);
      else { toast.error('Format non supporté'); return; }
      const accessibleStoreIds = stores.map(s => s.id);
      const validImported = importedProducts.filter(p => accessibleStoreIds.includes(p.storeId));
      if (validImported.length !== importedProducts.length) toast.warning(`${importedProducts.length - validImported.length} produits ignorés (magasin non autorisé)`);
      setImportData(validImported);
      setShowImportModal(true);
    } catch (error) {
      console.error('Erreur import:', error);
      toast.error('Erreur lors de l\'import');
    } finally { setLoading(false); }
  };

  const processCSV = (file) => new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const products = results.data.filter(row => row.barcode && row.name).map(row => ({
          barcode: row.barcode.toString().trim(),
          name: row.name.trim(),
          description: row.description?.trim() || '',
          price: parseFloat(row.price) || 0,
          category: row.category?.trim() || 'Général',
          stock: parseInt(row.stock) || 0,
          minStock: parseInt(row.minStock) || 5,
          storeId: row.storeId?.trim() || '',
          taxRate: row.taxRate ? parseInt(row.taxRate) : (row.hasVat === 'true' || row.hasVat === '1' ? 16 : 0),
          isActive: true
        }));
        resolve(products);
      },
      error: reject
    });
  });

  const processJSON = async (file) => {
    const text = await file.text();
    const jsonData = JSON.parse(text);
    const productsArray = Array.isArray(jsonData) ? jsonData : Object.values(jsonData);
    return productsArray.filter(p => p.barcode && p.name).map(p => ({
      barcode: p.barcode.toString().trim(),
      name: p.name.trim(),
      description: p.description?.trim() || '',
      price: parseFloat(p.price) || 0,
      category: p.category?.trim() || 'Général',
      stock: parseInt(p.stock) || 0,
      minStock: parseInt(p.minStock) || 5,
      storeId: p.storeId?.trim() || '',
      taxRate: p.taxRate ? parseInt(p.taxRate) : (p.hasVat ? 16 : 0),
      isActive: true
    }));
  };

  const processExcel = async (file) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData.filter(row => row.barcode && row.name).map(row => ({
      barcode: row.barcode.toString().trim(),
      name: row.name.trim(),
      description: row.description?.trim() || '',
      price: parseFloat(row.price) || 0,
      category: row.category?.trim() || 'Général',
      stock: parseInt(row.stock) || 0,
      minStock: parseInt(row.minStock) || 5,
      storeId: row.storeId?.trim() || '',
      taxRate: row.taxRate ? parseInt(row.taxRate) : (row.hasVat ? 16 : 0),
      isActive: true
    }));
  };

  const confirmImport = async () => {
    setLoading(true);
    try {
      for (const product of importData) {
        await set(ref(database, `products/${product.barcode}`), {
          ...product,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user?.uid,
        });
      }
      toast.success(`${importData.length} produits importés`);
      setShowImportModal(false);
      setImportData([]);
    } catch (error) {
      toast.error('Erreur lors de l\'import');
    } finally { setLoading(false); }
  };

  const exportProducts = () => {
    const exportData = filteredProducts.map(p => ({
      Barcode: p.barcode,
      Nom: p.name,
      Description: p.description,
      'Prix HT (€)': p.price,
      'Taux TVA (%)': p.taxRate,
      'Prix TTC (€)': (p.price * (1 + p.taxRate/100)).toFixed(2),
      Catégorie: p.category,
      Stock: p.stock,
      'Stock Minimum': p.minStock,
      'ID Magasin': p.storeId,
      'Nom Magasin': stores.find(s => s.id === p.storeId)?.name || '',
      'Date Création': p.createdAt,
      'Dernière Modification': p.updatedAt
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produits');
    XLSX.writeFile(wb, `produits_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export réussi !');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des produits</h1>
          <p className="text-gray-600 mt-1">Gérez votre inventaire en temps réel</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => document.getElementById('fileInput').click()} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <ArrowUpTrayIcon className="h-5 w-5 mr-2 text-gray-500" /> Importer
          </button>
          <input id="fileInput" type="file" accept=".csv,.json,.xlsx,.xls" onChange={handleFileImport} className="hidden" />
          <button onClick={exportProducts} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <DocumentDuplicateIcon className="h-5 w-5 mr-2 text-gray-500" /> Exporter
          </button>
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            <PlusIcon className="h-5 w-5 mr-2" /> Nouveau produit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6"><p className="text-sm font-medium text-gray-600">Total produits</p><p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p></div>
        <div className="bg-white rounded-lg shadow-sm p-6"><p className="text-sm font-medium text-gray-600">Valeur du stock (HT)</p><p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p></div>
        <div className="bg-white rounded-lg shadow-sm p-6"><p className="text-sm font-medium text-gray-600">Stock faible</p><p className="text-2xl font-bold text-orange-600 mt-2">{stats.lowStock}</p></div>
        <div className="bg-white rounded-lg shadow-sm p-6"><p className="text-sm font-medium text-gray-600">Rupture de stock</p><p className="text-2xl font-bold text-red-600 mt-2">{stats.outOfStock}</p></div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-lg relative">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher..." className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center"><FunnelIcon className="h-5 w-5 text-gray-400 mr-2" /><select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="border rounded-md px-3 py-2">{categories.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code-barres</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magasin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix HT (€)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TVA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière modif.</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.map((product) => (
                <tr key={product.barcode} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{product.barcode}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center">{product.image ? <img className="h-10 w-10 rounded-lg object-cover" src={product.image} alt="" /> : <span className="text-xl">🛒</span>}</div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        {product.description && <div className="text-sm text-gray-500 truncate max-w-xs">{product.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">{product.category || 'Général'}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stores.find(s => s.id === product.storeId)?.name || 'Non assigné'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.price?.toFixed(2)} €
                    {product.taxRate === 16 && <span className="text-xs text-gray-500 ml-1">(TTC: {(product.price * 1.16).toFixed(2)} €)</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${product.stock === 0 ? 'text-red-600' : product.stock <= (product.minStock || 5) ? 'text-orange-600' : 'text-gray-900'}`}>{product.stock || 0}</span>
                      <span className="ml-1 text-xs text-gray-500">/ {product.minStock || 5}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.taxRate === 16 ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">TVA 16%</span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Exonéré</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.isActive ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Actif</span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Inactif</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('fr-FR') : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {canManageProduct(product) && (
                      <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => { setEditingProduct(product); setShowEditModal(true); }} className="text-blue-600 hover:text-blue-900" title="Modifier"><PencilIcon className="h-5 w-5" /></button>
                        <button onClick={() => handleDuplicateProduct(product)} className="text-gray-600 hover:text-gray-900" title="Dupliquer"><DocumentDuplicateIcon className="h-5 w-5" /></button>
                        <button onClick={() => handleDeleteProduct(product.barcode, product.name)} className="text-red-600 hover:text-red-900" title="Supprimer"><TrashIcon className="h-5 w-5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-gray-500">Aucun produit trouvé</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredProducts.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredProducts.length)} sur {filteredProducts.length} produits</p>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage===1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"><ChevronLeftIcon className="h-5 w-5" /></button>
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i+1} onClick={() => setCurrentPage(i+1)} className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === i+1 ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>{i+1}</button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))} disabled={currentPage===totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"><ChevronRightIcon className="h-5 w-5" /></button>
              </nav>
            </div>
          </div>
        )}
      </div>

      {showAddModal && <ProductFormModal title="Ajouter un produit" onClose={() => setShowAddModal(false)} onSubmit={handleAddProduct} stores={stores} userRole={user?.role} currentStoreId={currentStoreId} />}
      {showEditModal && editingProduct && <ProductFormModal title="Modifier le produit" product={editingProduct} onClose={() => { setShowEditModal(false); setEditingProduct(null); }} onSubmit={(data) => handleUpdateProduct(editingProduct.barcode, data)} stores={stores} userRole={user?.role} currentStoreId={currentStoreId} />}
      {showImportModal && <ImportModal data={importData} onClose={() => { setShowImportModal(false); setImportData([]); }} onConfirm={confirmImport} loading={loading} />}
    </div>
  );
};

const ProductFormModal = ({ title, product, onClose, onSubmit, stores, userRole, currentStoreId }) => {
  const [formData, setFormData] = useState({
    barcode: product?.barcode || '',
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    category: product?.category || 'Général',
    stock: product?.stock || '',
    minStock: product?.minStock || '5',
    isActive: product?.isActive !== undefined ? product.isActive : true,
    storeId: product?.storeId || (stores.length > 0 ? stores[0].id : ''),
    taxRate: product?.taxRate !== undefined ? product.taxRate : 16,
  });

  useEffect(() => {
    if (userRole === 'store_manager' && currentStoreId) setFormData(prev => ({ ...prev, storeId: currentStoreId }));
    else if (stores.length > 0 && !formData.storeId) setFormData(prev => ({ ...prev, storeId: stores[0].id }));
  }, [stores, userRole, currentStoreId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.barcode || !formData.name || !formData.price || !formData.storeId) {
      toast.error('Veuillez remplir tous les champs obligatoires (dont le magasin)');
      return;
    }
    onSubmit(formData);
  };

  const isStoreManager = userRole === 'store_manager';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700">Code-barres *</label><input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full px-3 py-2 border rounded-md" required disabled={!!product} /></div>
          <div><label className="block text-sm font-medium text-gray-700">Nom *</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-md" required /></div>
          <div><label className="block text-sm font-medium text-gray-700">Description</label><textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-md" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700">Prix HT (€) *</label><input type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-3 py-2 border rounded-md" required /></div>
            <div><label className="block text-sm font-medium text-gray-700">Catégorie</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 border rounded-md"><option>Général</option><option>Produits frais</option><option>Boulangerie</option><option>Boissons</option><option>Épicerie</option><option>Bio</option><option>Hygiène</option><option>Maison</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700">Stock initial</label><input type="number" min="0" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full px-3 py-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700">Stock minimum</label><input type="number" min="0" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} className="w-full px-3 py-2 border rounded-md" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700">Magasin *</label><select value={formData.storeId} onChange={e => setFormData({...formData, storeId: e.target.value})} className="w-full px-3 py-2 border rounded-md" required disabled={isStoreManager}><option value="">Sélectionnez un magasin</option>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select>{isStoreManager && <p className="text-xs text-gray-500 mt-1">Magasin attribué automatiquement.</p>}</div>
          <div className="flex items-center"><input type="checkbox" id="taxable" checked={formData.taxRate === 16} onChange={e => setFormData({...formData, taxRate: e.target.checked ? 16 : 0})} className="h-4 w-4 text-blue-600 rounded" /><label htmlFor="taxable" className="ml-2 block text-sm text-gray-900">Produit soumis à la TVA (16%)</label></div>
          <div className="flex items-center"><input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="h-4 w-4 text-blue-600 rounded" /><label className="ml-2 block text-sm text-gray-900">Produit actif</label></div>
          <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 bg-white hover:bg-gray-50">Annuler</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{product ? 'Mettre à jour' : 'Ajouter'}</button></div>
        </form>
      </div>
    </div>
  );
};

const ImportModal = ({ data, onClose, onConfirm, loading }) => {
  const [duplicateAction, setDuplicateAction] = useState('skip');
  const [validData, setValidData] = useState([]);
  const [invalidData, setInvalidData] = useState([]);

  useEffect(() => {
    const valid = [], invalid = [];
    data.forEach((item, index) => {
      if (item.barcode && item.name && item.price >= 0 && item.storeId) valid.push({ ...item, index });
      else invalid.push({ ...item, index });
    });
    setValidData(valid);
    setInvalidData(invalid);
  }, [data]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold text-gray-900">Importation de produits</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button></div>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4"><p className="text-blue-800"><span className="font-bold">{validData.length}</span> produits valides à importer{invalidData.length > 0 && <span className="ml-2">• <span className="font-bold text-orange-600">{invalidData.length}</span> produits ignorés</span>}</p></div>
          <div className="border border-gray-200 rounded-lg p-4"><label className="block text-sm font-medium text-gray-700 mb-2">Gestion des doublons</label><div className="space-y-2"><label className="flex items-center"><input type="radio" value="skip" checked={duplicateAction === 'skip'} onChange={e => setDuplicateAction(e.target.value)} className="h-4 w-4 text-blue-600" /><span className="ml-2 text-sm text-gray-700">Ignorer</span></label><label className="flex items-center"><input type="radio" value="overwrite" checked={duplicateAction === 'overwrite'} onChange={e => setDuplicateAction(e.target.value)} className="h-4 w-4 text-blue-600" /><span className="ml-2 text-sm text-gray-700">Remplacer</span></label></div></div>
          {validData.length > 0 && <div><h4 className="text-sm font-medium text-gray-700 mb-2">Aperçu</h4><div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-100"><tr><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code-barres</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prix HT (€)</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">TVA</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{validData.slice(0,5).map((item,idx)=><tr key={idx}><td className="px-3 py-2 text-xs font-mono">{item.barcode}</td><td className="px-3 py-2 text-xs">{item.name}</td><td className="px-3 py-2 text-xs">{item.price} €</td><td className="px-3 py-2 text-xs">{item.taxRate===16?'16%':'Exonéré'}</td></tr>)}{validData.length>5 && <tr><td colSpan="4" className="px-3 py-2 text-xs text-gray-500 text-center">... et {validData.length-5} autres</td></tr>}</tbody></table></div></div>}
          <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 bg-white hover:bg-gray-50" disabled={loading}>Annuler</button><button type="button" onClick={onConfirm} disabled={validData.length===0||loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">{loading ? 'Importation...' : `Importer ${validData.length} produits`}</button></div>
        </div>
      </div>
    </div>
  );
};

export default Products;