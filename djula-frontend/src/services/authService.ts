/**
 * Service d'authentification pour Djula utilisant un proxy API interne
 */

const IS_DEV = process.env.NODE_ENV === 'development';

export interface RegisterSellerData {
  fullName: string;
  brandName: string;
  whatsappNumber: string;
  city: string;
  businessType: string;
}

export interface LoginSellerData {
  fullName: string;
  whatsappNumber: string;
}

export interface LoginAdminData {
  email: string;
  password: string;
}

// Modifier la fonction callApi pour gérer les erreurs réseau et ajouter un mode dev
async function callApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const url = `${API_URL}/${endpoint}`;
  
  try {
    // En mode développement, si l'API n'est pas accessible, utiliser des données fictives
    if (IS_DEV) {
      // Simuler une petite latence
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Si c'est une tentative de login
      if (endpoint === 'auth/login' && options.method === 'POST') {
        const body = JSON.parse((options.body as string) || '{}');
        
        // Simuler un login réussi avec des données factices
        if (body.email && body.password) {
          console.log('⚠️ Mode développement: simulation de login pour', body.email);
          return {
            user: {
              id: '81642b44-5703-485b-97dc-30527a51fdde',
              email: body.email,
              fullName: 'Utilisateur Test',
              role: 'SELLER',
              createdAt: new Date().toISOString(),
              whatsappNumber: '+225 07 123 45 67',
              shopName: 'Boutique Test'
            },
            token: 'fake_dev_token_' + Math.random().toString(36).substring(2)
          };
        }
      }
      
      // Autres points d'API que vous pourriez simuler...
    }

    // Faire l'appel API réel
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Essayer de lire le JSON, mais avoir un fallback si ce n'est pas du JSON
      const errorData = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    // Si nous sommes en développement et qu'il y a une erreur réseau (serveur non disponible)
    if (IS_DEV && error instanceof Error && (error.message.includes('fetch failed') || error.message.includes('Erreur réseau'))) {
      console.warn('⚠️ Mode développement: erreur réseau, utilisation de données fictives');
      
      // Simuler des réponses en fonction des endpoints
      if (endpoint === 'auth/me') {
        return {
          id: '81642b44-5703-485b-97dc-30527a51fdde',
          email: 'dev@example.com',
          fullName: 'Utilisateur Dev',
          role: 'SELLER',
          createdAt: new Date().toISOString(),
          whatsappNumber: '+225 07 123 45 67',
          shopName: 'Boutique Dev'
        };
      }
      
      // Autres endpoints à simuler si nécessaire
      
      // Par défaut, retourner un objet vide pour éviter les erreurs
      return {};
    }
    
    // En production ou pour d'autres types d'erreurs, relancer l'erreur
    throw error;
  }
}

const authService = {
  /**
   * Inscription vendeur via proxy API
   */
  async registerSeller(data: RegisterSellerData) {
    try {
      console.log('Tentative d\'inscription vendeur:', data);
      
      const responseData = await callApi('api/auth/seller/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      console.log('Réponse inscription:', responseData);
      
      // Ne pas sauvegarder les données d'authentification après l'inscription
      // this.saveAuthData(responseData, 'SELLER'); <-- Supprimer ou commenter cette ligne
      
      // Redirection explicite vers la page de connexion
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      
      return responseData;
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      throw error;
    }
  },
  
  /**
   * Connexion vendeur via proxy API
   */
  async loginSeller(data: LoginSellerData) {
    try {
      const responseData = await callApi('api/auth/seller/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      this.saveAuthData(responseData, 'SELLER');
      return responseData;
    } catch (error: any) {
      console.error('Erreur connexion vendeur:', error);
      throw error;
    }
  },
  
  /**
   * Connexion administrateur via proxy API
   */
  async loginAdmin(data: LoginAdminData) {
    try {
      const responseData = await callApi('api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      this.saveAuthData(responseData, 'ADMIN');
      return responseData;
    } catch (error: any) {
      console.error('Erreur connexion admin:', error);
      throw error;
    }
  },
  
  /**
   * Sauvegarde des données d'authentification
   */
  saveAuthData(data: any, userType: 'ADMIN' | 'SELLER') {
    if (data?.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken || '');
      localStorage.setItem('userType', userType);
      
      if (userType === 'SELLER') {
        localStorage.setItem('seller', JSON.stringify(data.seller || data.user || data));
      } else {
        localStorage.setItem('admin', JSON.stringify(data.admin || data.user || data));
      }
    }
  },
  
  /**
   * Déconnexion et nettoyage des données via proxy API
   */
  async logout() {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Utiliser le proxy API pour la déconnexion
        await callApi('api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(err => console.warn('Erreur déconnexion API:', err));
      }
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    } finally {
      this.clearAuthData();
      
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  },
  
  /**
   * Nettoyage des données d'authentification
   */
  clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userType');
    localStorage.removeItem('seller');
    localStorage.removeItem('admin');
  },
  
  /**
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('token');
  },
  
  /**
   * Récupère le type d'utilisateur
   */
  getUserType(): 'ADMIN' | 'SELLER' | null {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem('userType') as 'ADMIN' | 'SELLER') || null;
  },
  
  /**
   * Récupère les données utilisateur stockées localement
   */
  getUserData() {
    if (typeof window === 'undefined') return null;
    const userType = this.getUserType();
    if (userType === 'ADMIN') {
      const admin = localStorage.getItem('admin');
      return admin ? JSON.parse(admin) : null;
    } else if (userType === 'SELLER') {
      const seller = localStorage.getItem('seller');
      return seller ? JSON.parse(seller) : null;
    }
    return null;
  },
  
  /**
   * Récupère les données utilisateur à jour depuis le backend via proxy API
   */
  async refreshUserData() {
    if (!this.isAuthenticated()) return null;
    
    const userType = this.getUserType();
    try {
      if (userType === 'SELLER') {
        const userData = this.getUserData();
        if (!userData?.id) return null;
        
        // Utiliser le proxy API pour récupérer les données du vendeur
        const responseData = await callApi(`api/sellers/${userData.id}/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).catch(() => null);
        
        if (responseData) {
          localStorage.setItem('seller', JSON.stringify(responseData));
          return responseData;
        }
        
        return this.getUserData();
      } 
      else if (userType === 'ADMIN') {
        const userData = this.getUserData();
        if (!userData?.id) return null;
        
        // Utiliser le proxy API pour récupérer les données de l'admin
        const responseData = await callApi(`api/admins/${userData.id}/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).catch(() => null);
        
        if (responseData) {
          localStorage.setItem('admin', JSON.stringify(responseData));
          return responseData;
        }
        
        return this.getUserData();
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données utilisateur:', error);
      return this.getUserData();
    }
    
    return null;
  },
  
  /**
   * Vérifie si le token est expiré
   */
  isTokenExpired(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiration = payload.exp * 1000; // Convertir en millisecondes
      return Date.now() > expiration;
    } catch (e) {
      console.error('Erreur lors de la vérification du token:', e);
      return true;
    }
  },
  
  /**
   * Rafraîchit le token si nécessaire via proxy API
   */
  async refreshTokenIfNeeded() {
    if (!this.isAuthenticated() || !this.isTokenExpired()) return;
    
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      this.logout();
      return;
    }
    
    try {
      // Utiliser le proxy API pour rafraîchir le token
      const responseData = await callApi('api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });
      
      localStorage.setItem('token', responseData.token);
      localStorage.setItem('refreshToken', responseData.refreshToken || '');
    } catch (error) {
      console.error('Échec du rafraîchissement du token:', error);
      this.logout();
    }
  }
};

export default authService;