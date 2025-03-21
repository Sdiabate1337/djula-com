import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import useAuth from '@/src/hooks/useAuth';

// Type pour les clients
interface Customer {
  id: string;
  name: string;
  whatsappNumber: string;
  lastActivity: string;
  totalOrders: number;
  totalSpent: number;
  isActive: boolean;
}

export default function CustomersPage() {
  const { user, loading } = useAuth('SELLER');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCustomers, setTotalCustomers] = useState(0);

  // Chargement des clients
  useEffect(() => {
    if (user && !loading) {
      loadCustomers();
    }
  }, [user, loading, page, statusFilter]);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      
      // Simuler un appel API
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Simuler des données clients
      const mockCustomers: Customer[] = Array.from({ length: 20 }, (_, i) => ({
        id: `cust-${i + 1}`,
        name: `Client ${i + 1}`,
        whatsappNumber: `+225 0${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)} ${Math.floor(Math.random() * 100)} ${Math.floor(Math.random() * 100)} ${Math.floor(Math.random() * 100)}`,
        lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalOrders: Math.floor(Math.random() * 10),
        totalSpent: Math.floor(Math.random() * 100000) + 5000,
        isActive: Math.random() > 0.3
      }));
      
      // Filtrer en fonction du statut sélectionné
      let filteredCustomers = [...mockCustomers];
      if (statusFilter === 'active') {
        filteredCustomers = filteredCustomers.filter(customer => customer.isActive);
      } else if (statusFilter === 'inactive') {
        filteredCustomers = filteredCustomers.filter(customer => !customer.isActive);
      }
      
      // Filtrer en fonction de la recherche
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredCustomers = filteredCustomers.filter(
          customer => 
            customer.name.toLowerCase().includes(term) || 
            customer.whatsappNumber.includes(term)
        );
      }
      
      setCustomers(filteredCustomers.slice((page - 1) * 10, page * 10));
      setTotalCustomers(filteredCustomers.length);
      setTotalPages(Math.ceil(filteredCustomers.length / 10));
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Gestion de la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Retour à la première page
    loadCustomers();
  };

  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR').format(date);
  };

  // Fonction pour formater le montant
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <>
      <Head>
        <title>Clients | Djula Commerce</title>
      </Head>
      
      <DashboardLayout>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mes clients</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalCustomers} client{totalCustomers !== 1 ? 's' : ''} au total
            </p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => {/* Export de la liste des clients */}}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center"
            >
              <i className="fas fa-download mr-2"></i>
              Exporter
            </button>
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
                  placeholder="Rechercher un client..."
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
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                  setPage(1); // Retour à la première page
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Liste des clients */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : customers.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* En-têtes du tableau */}
            <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 py-3 px-4 text-sm font-medium text-gray-700">
              <div className="col-span-4">Client</div>
              <div className="col-span-2 text-center">Commandes</div>
              <div className="col-span-2 text-center">Dépenses totales</div>
              <div className="col-span-2 text-center">Statut</div>
              <div className="col-span-2 text-right">Dernière activité</div>
            </div>
            
            {/* Lignes du tableau */}
            {customers.map((customer) => (
              <div key={customer.id} className="grid grid-cols-12 border-b border-gray-100 py-4 px-4 items-center hover:bg-gray-50 transition">
                {/* Client */}
                <div className="col-span-4 flex items-center">
                  <div className="bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center text-gray-500">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-800">{customer.name}</h3>
                    <p className="text-sm text-gray-500">{customer.whatsappNumber}</p>
                  </div>
                </div>
                
                {/* Commandes */}
                <div className="col-span-2 text-center">
                  {customer.totalOrders}
                </div>
                
                {/* Dépenses totales */}
                <div className="col-span-2 text-center font-medium">
                  {formatCurrency(customer.totalSpent)}
                </div>
                
                {/* Statut */}
                <div className="col-span-2 text-center">
                  {customer.isActive ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
                      Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="h-2 w-2 rounded-full bg-gray-500 mr-1.5"></span>
                      Inactif
                    </span>
                  )}
                </div>
                
                {/* Dernière activité */}
                <div className="col-span-2 text-right text-sm text-gray-500">
                  {formatDate(customer.lastActivity)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <div className="text-gray-500 mb-4">
              <i className="fas fa-users text-5xl"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-1">Aucun client trouvé</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Aucun client ne correspond à votre recherche.' : 'Vous n\'avez pas encore de clients.'}
            </p>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <div className="flex space-x-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              >
                <i className="fas fa-chevron-left text-sm"></i>
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1 border rounded-md ${
                    pageNum === page 
                      ? 'bg-orange-500 text-white border-orange-500' 
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              >
                <i className="fas fa-chevron-right text-sm"></i>
              </button>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}