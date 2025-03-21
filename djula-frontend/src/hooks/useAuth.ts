// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import authService from '@/src/services/authService';

export default function useAuth(requiredRole?: 'ADMIN' | 'SELLER') {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Vérifier l'authentification
    const checkAuth = async () => {
      const isAuthenticated = authService.isAuthenticated();
      
      if (!isAuthenticated) {
        // Rediriger vers la connexion si non authentifié
        router.push('/auth/login');
        return;
      }
      
      const userType = authService.getUserType();
      const userData = authService.getUserData();
      
      // Vérifier si le rôle est requis
      if (requiredRole && userType !== requiredRole) {
        // Rediriger vers le dashboard approprié
        router.push(userType === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
        return;
      }
      
      setUser(userData);
      setLoading(false);
    };
    
    checkAuth();
  }, [router, requiredRole]);
  
  return { user, loading };
}