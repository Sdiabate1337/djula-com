import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import useAuth from '@/src/hooks/useAuth';
import { formatCurrency, formatDate } from '@/src/utils/formatters';

// Type pour les commandes
interface Order {
  id: string;
  customerName: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  paymentStatus: 'paid' | 'unpaid' | 'refunded';
  createdAt: string;
  items: number;
}

export default function OrdersPage() {
  const { user, loading } = useAuth('SELLER');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [totalOrders, setTotalOrders] = useState(0);

  // Chargement des commandes
  useEffect(() => {
    if (user && !loading) {
      loadOrders();
    }
  }, [user, loading, page, statusFilter]);

  // Fonction pour charger les commandes (simulée pour le développement)
  const loadOrders = async () => {
    setIsLoading(true);
    try {
      // Simuler un délai réseau
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Générer des commandes aléatoires pour le développement
      const statuses: Array<Order['status']> = ['pending', 'processing', 'completed', 'cancelled'];
      const paymentStatuses: Array<Order['paymentStatus']> = ['paid', 'unpaid', 'refunded'];
      
      const mockOrders = Array(15).fill(null).map((_, i) => ({
        id: `ORD-${Date.now().toString().slice(-6)}-${i}`,
        customerName: `Client ${i+1}`,
        amount: Math.floor(Math.random() * 50000) + 5000,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
        items: Math.floor(Math.random() * 5) + 1
      }));
      
      // Filtrer les commandes si nécessaire
      let filteredOrders = mockOrders;
      
      if (statusFilter !== 'all') {
        filteredOrders = mockOrders.filter(order => order.status === statusFilter);
      }
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredOrders = filteredOrders.filter(
          order => order.customerName.toLowerCase().includes(term) || order.id.toLowerCase().includes(term)
        );
      }
      
      setOrders(filteredOrders);
      setTotalOrders(filteredOrders.length);
      setTotalPages(Math.ceil(filteredOrders.length / 10));
      
    } catch (error) {
      console.error('Erreur lors du chargement des commandes', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Gestion de la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadOrders();
  };

  // Fonction pour afficher le statut avec badge coloré
  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <span className="h-2 w-2 rounded-full bg-yellow-400 mr-1.5"></span>
            En attente
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <span className="h-2 w-2 rounded-full bg-blue-500 mr-1.5"></span>
            En cours
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
            Complétée
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5"></span>
            Annulée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  // Fonction pour afficher le statut de paiement avec badge coloré
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Payée
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Non payée
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Remboursée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <Head>
        <title>Gestion des Commandes | Djula Commerce</title>
      </Head>
      
      <DashboardLayout>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Commandes</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalOrders} commande{totalOrders !== 1 ? 's' : ''} au total
            </p>
          </div>
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
                  placeholder="Rechercher une commande..."
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
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Tous</option>
                <option value="pending">En attente</option>
                <option value="processing">En cours</option>
                <option value="completed">Complétées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Liste des commandes */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : orders.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* En-têtes du tableau */}
            <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 py-3 px-4 text-sm font-medium text-gray-700">
              <div className="col-span-3">Numéro de commande</div>
              <div className="col-span-2">Client</div>
              <div className="col-span-2 text-center">Montant</div>
              <div className="col-span-2 text-center">Statut</div>
              <div className="col-span-2 text-center">Paiement</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            
            {/* Lignes du tableau */}
            {orders.map((order) => (
              <div key={order.id} className="grid grid-cols-12 border-b border-gray-100 py-4 px-4 items-center hover:bg-gray-50 transition">
                {/* Numéro de commande et date */}
                <div className="col-span-3">
                  <div className="font-medium text-gray-900">{order.id}</div>
                  <div className="text-sm text-gray-500">{formatDate(order.createdAt)}</div>
                </div>
                
                {/* Client */}
                <div className="col-span-2">
                  <div className="font-medium text-gray-900">{order.customerName}</div>
                  <div className="text-sm text-gray-500">{order.items} article{order.items > 1 ? 's' : ''}</div>
                </div>
                
                {/* Montant */}
                <div className="col-span-2 text-center font-medium text-gray-900">
                  {formatCurrency(order.amount)}
                </div>
                
                {/* Statut */}
                <div className="col-span-2 text-center">
                  {getOrderStatusBadge(order.status)}
                </div>
                
                {/* Statut de paiement */}
                <div className="col-span-2 text-center">
                  {getPaymentStatusBadge(order.paymentStatus)}
                </div>
                
                {/* Actions */}
                <div className="col-span-1 text-right">
                  <button 
                    onClick={() => alert(`Afficher les détails de la commande ${order.id}`)}
                    className="text-gray-600 hover:text-orange-500 transition"
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <div className="text-gray-500 mb-2">
              <i className="fas fa-clipboard-list text-4xl"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune commande trouvée</h3>
            <p className="text-gray-500">
              {statusFilter !== 'all' ? 'Aucune commande ne correspond aux filtres sélectionnés.' : 'Vous n\'avez pas encore reçu de commandes.'}
            </p>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage(Math.max(page - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md border border-gray-300 disabled:opacity-50"
              >
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 rounded-md ${
                    page === i + 1 
                      ? 'bg-orange-500 text-white font-medium' 
                      : 'border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              
              <button
                onClick={() => setPage(Math.min(page + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-md border border-gray-300 disabled:opacity-50"
              >
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}