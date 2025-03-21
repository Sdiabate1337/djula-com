import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import productService, { Product } from '@/src/services/productService';
import useAuth from '@/src/hooks/useAuth';

export default function ProductsPage() {
  const { user, loading } = useAuth('SELLER');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'soldout'>('all');
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Format des montants en FCFA
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Chargement initial des produits
  useEffect(() => {
    if (user && !loading) {
      loadProducts();
    }
  }, [user, loading, page, statusFilter]);

  // Chargement des produits avec filtres
  const loadProducts = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const filters: Record<string, string> = {};
      
      if (searchTerm) {
        filters.search = searchTerm;
      }
      
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      
      const response = await productService.getProducts(user.id, page, 10, filters);
      
      if (response && Array.isArray(response.products)) {
        setProducts(response.products);
        setTotalPages(response.totalPages || 1);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Gestion de la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  // Suppression d'un produit
  const confirmDelete = async () => {
    if (!deleteProductId) return;
    
    try {
      await productService.deleteProduct(deleteProductId);
      setProducts(products.filter(p => p.id !== deleteProductId));
      setShowDeleteModal(false);
      setDeleteProductId(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  return (
    <>
      <Head>
        <title>Gestion des produits | Djula Commerce</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>
      
      <DashboardLayout>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Mes produits</h1>
          
          <Link href="/dashboard/products/add" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition duration-150 ease-in-out flex items-center">
            <i className="fas fa-plus mr-2"></i>
            Ajouter un produit
          </Link>
        </div>
        
        {/* Filtres et recherche */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Barre de recherche */}
            <form onSubmit={handleSearch} className="flex flex-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <i className="fas fa-search text-gray-400"></i>
                </div>
              </div>
              <button 
                type="submit" 
                className="ml-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
              >
                Rechercher
              </button>
            </form>
            
            {/* Filtres par statut */}
            <div className="flex items-center">
              <label className="text-sm text-gray-600 mr-2">Statut:</label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="draft">Brouillons</option>
                <option value="soldout">Épuisés</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Liste des produits */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : products.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* En-têtes du tableau */}
            <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 py-3 px-4 text-sm font-medium text-gray-700">
              <div className="col-span-4">Produit</div>
              <div className="col-span-2 text-center">Prix</div>
              <div className="col-span-2 text-center">Statut</div>
              <div className="col-span-2 text-center">Stock</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            
            {/* Lignes du tableau */}
            {products.map((product) => (
              <div key={product.id} className="grid grid-cols-12 border-b border-gray-100 py-4 px-4 items-center hover:bg-gray-50 transition">
                {/* Produit avec image */}
                <div className="col-span-4 flex items-center">
                  <div className="h-14 w-14 bg-gray-100 rounded-lg overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.name} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        <i className="fas fa-image"></i>
                      </div>
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-800">{product.name}</h3>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{product.description}</p>
                  </div>
                </div>
                
                {/* Prix */}
                <div className="col-span-2 text-center">
                  <div className="font-medium text-gray-900">{formatCurrency(product.price)}</div>
                  {product.discountPrice && (
                    <div className="text-sm line-through text-gray-500">{formatCurrency(product.discountPrice)}</div>
                  )}
                </div>
                
                {/* Statut */}
                <div className="col-span-2 text-center">
                  {product.status === 'active' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
                      Actif
                    </span>
                  )}
                  {product.status === 'draft' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <span className="h-2 w-2 rounded-full bg-yellow-500 mr-1.5"></span>
                      Brouillon
                    </span>
                  )}
                  {product.status === 'soldout' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5"></span>
                      Épuisé
                    </span>
                  )}
                </div>
                
                {/* Stock */}
                <div className="col-span-2 text-center">
                  <span className={`font-medium ${product.quantity > 0 ? 'text-gray-700' : 'text-red-600'}`}>
                    {product.quantity}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="col-span-2 text-right space-x-2">
                  <Link 
                    href={`/dashboard/products/edit/${product.id}`}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition"
                  >
                    <i className="fas fa-edit text-gray-500"></i>
                  </Link>
                  
                  <button
                    onClick={() => {
                      setDeleteProductId(product.id);
                      setShowDeleteModal(true);
                    }}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 hover:border-red-200 transition"
                  >
                    <i className="fas fa-trash-alt text-red-500"></i>
                  </button>
                </div>
              </div>
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50 sm:px-6">
                <div className="flex-1 flex justify-between items-center">
                  <button
                    onClick={() => setPage(Math.max(page - 1, 1))}
                    disabled={page === 1}
                    className={`px-3 py-1 border border-gray-300 text-sm rounded-md bg-white hover:bg-gray-50 ${page === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-gray-700">
                    Page <span className="font-medium">{page}</span> sur <span className="font-medium">{totalPages}</span>
                  </span>
                  <button
                    onClick={() => setPage(Math.min(page + 1, totalPages))}
                    disabled={page === totalPages}
                    className={`px-3 py-1 border border-gray-300 text-sm rounded-md bg-white hover:bg-gray-50 ${page === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-500 mb-4">
              <i className="fas fa-box-open text-2xl"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-800">Aucun produit trouvé</h3>
            <p className="text-gray-600 mt-2">Vous n'avez pas encore ajouté de produits ou aucun produit ne correspond à vos critères.</p>
            <Link 
              href="/dashboard/products/add"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <i className="fas fa-plus mr-2"></i>
              Ajouter un produit
            </Link>
          </div>
        )}
        
        {/* Modal de confirmation de suppression */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmer la suppression</h3>
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir supprimer ce produit? Cette action est irréversible.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}