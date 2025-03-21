import { useState, useEffect } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import dashboardService from '@/src/services/dashboardService'; 
import SalesChart from '@/src/components/dashboard/SalesChart';
import RecentOrders from '@/src/components/dashboard/RecentOrders';
import useAuth from '@/src/hooks/useAuth';

export default function Dashboard() {
  const { user, loading } = useAuth('SELLER');
  interface Stats {
    totalCustomers: number;
    activeCustomers: number;
    totalMessages: number;
    averageResponseTime: number;
    totalSales: number;
    pendingOrders: number;
  }

  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  useEffect(() => {
    // Charger les données une fois l'utilisateur authentifié
    if (user && !loading) {
      const fetchData = async () => {
        try {
          const data = await dashboardService.getSellerStats(user.id);
          setStats(data);
          
          // Vérifier la connexion WhatsApp
          const whatsappStatus = await dashboardService.getWhatsAppStatus(user.id);
          setWhatsappConnected(whatsappStatus);
        } catch (error) {
          console.error('Erreur lors du chargement des statistiques:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchData();
    }
  }, [user, loading]);

  // Format des montants en FCFA
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Style pour le dégradé orange
  const orangeGradient = {
    background: 'linear-gradient(135deg, #FF8A2B, #FF6B00)'
  };

  return (
    <>
      <Head>
        <title>Tableau de bord | Djula Commerce</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>
      
      <DashboardLayout>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Alerte WhatsApp */}
            {!whatsappConnected && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center">
                <div className="flex-shrink-0 bg-orange-100 p-2 rounded-lg">
                  <i className="fab fa-whatsapp text-xl text-orange-500"></i>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-sm font-medium text-orange-800">WhatsApp non connecté</h3>
                  <p className="text-sm text-orange-700 mt-1">Connectez votre WhatsApp pour commencer à vendre</p>
                </div>
                <a 
                  href="/dashboard/whatsapp" 
                  className="ml-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition duration-150 ease-in-out"
                >
                  Connecter
                </a>
              </div>
            )}

            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Clients totaux</p>
                    <p className="text-2xl font-semibold text-gray-800 mt-1">{stats?.totalCustomers || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={orangeGradient}>
                    <i className="fas fa-users text-white"></i>
                  </div>
                </div>
                <p className="text-xs text-green-600 flex items-center mt-4">
                  <i className="fas fa-arrow-up mr-1"></i> +5% par rapport au mois dernier
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Clients actifs</p>
                    <p className="text-2xl font-semibold text-gray-800 mt-1">{stats?.activeCustomers}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500">
                    <i className="fas fa-user-check text-white"></i>
                  </div>
                </div>
                <p className="text-xs text-gray-500 flex items-center mt-4">
                  <span>{stats ? Math.round((stats.activeCustomers / stats.totalCustomers) * 100) || 0 : 0}% de taux d'activité</span>
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Messages échangés</p>
                    <p className="text-2xl font-semibold text-gray-800 mt-1">{stats?.totalMessages}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500">
                    <i className="fas fa-comment-dots text-white"></i>
                  </div>
                </div>
                <p className="text-xs text-gray-500 flex items-center mt-4">
                  Temps de réponse moyen: {stats?.averageResponseTime} min
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ventes totales</p>
                    <p className="text-2xl font-semibold text-gray-800 mt-1">{formatCurrency(stats?.totalSales || 0)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500">
                    <i className="fas fa-money-bill-wave text-white"></i>
                  </div>
                </div>
                <p className="text-xs text-gray-500 flex items-center mt-4">
                  {stats?.pendingOrders} commandes en attente
                </p>
              </div>
            </div>
            
            {/* Graphiques et analyses avancées */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
                {user && <SalesChart sellerId={user.id} />}
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Commandes récentes</h3>
                {user && <RecentOrders sellerId={user.id} limit={3} />}
              </div>
            </div>
            
            {/* Conseils et ressources */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Optimisez vos ventes</h3>
                  <p className="mb-4">Découvrez comment augmenter votre visibilité et vos conversions.</p>
                  <button className="px-4 py-2 bg-white text-orange-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition">
                    Voir les astuces
                  </button>
                </div>
                <div className="hidden md:block">
                  <i className="fas fa-lightbulb text-5xl text-yellow-300"></i>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}