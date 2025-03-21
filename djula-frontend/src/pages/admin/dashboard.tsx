// src/pages/admin/dashboard.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import authService from '@/src/services/authService';

export default function AdminDashboard() {
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Vérifier si l'utilisateur est un admin
    const checkAuth = () => {
      const userType = authService.getUserType();
      const userData = authService.getUserData();
      
      if (!authService.isAuthenticated() || userType !== 'ADMIN') {
        router.push('/auth/login');
        return;
      }
      
      setAdminData(userData);
      setLoading(false);
    };
    
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard | Djula Commerce</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-800">Admin Dashboard</h1>
              <button 
                onClick={() => authService.logout()}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Bienvenue, {adminData?.fullName || 'Admin'}</h2>
            <p>Cette page est en cours de développement. L'interface d'administration sera bientôt disponible.</p>
          </div>
        </main>
      </div>
    </>
  );
}