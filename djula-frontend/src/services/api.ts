import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { mockAuth } from './mockAuth';

// Détectez automatiquement l'environnement
const getApiUrl = () => {
  // Vérifier si on est dans un environnement navigateur
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  
  // Dans un environnement Codespaces
  const origin = window.location.origin;
  
  if (origin.includes('.app.github.dev')) {
    // Utiliser directement le format codespace complet en remplaçant le port
    // L'URL frontend: https://upgraded-waffle-rqrx6q9949q3qpj-3000.app.github.dev
    // L'URL backend: https://upgraded-waffle-rqrx6q9949q3qpj-3001.app.github.dev
    return origin.replace('-3000', '-3001') + '/api';
  }
  
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

const API_URL = getApiUrl();
const isDev = process.env.NODE_ENV === 'development';
console.log(`🔌 API connectée sur: ${API_URL} (${isDev ? 'développement' : 'production'})`);

// Instance Axios
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 secondes
});

// Intercepteur de requêtes - ajout du token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur de réponses - gestion des erreurs et rafraîchissement du token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    
    // Si erreur 401 (non autorisé) et pas déjà essayé, on tente de rafraîchir le token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('Refresh token non disponible');
        }
        
        // Appel pour un nouveau token
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { 
          refreshToken 
        });
        
        // Stockage des nouveaux tokens
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        
        // Réessayer la requête originale
        api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Échec du rafraîchissement - déconnexion
        console.error('Échec du rafraîchissement du token:', refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('seller');
        localStorage.removeItem('admin');
        
        // Redirection vers la page de connexion
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }
    
    // Format d'erreur standardisé
    const errorMessage = (error.response?.data as { message?: string })?.message || 
      error.message || 
      'Une erreur s\'est produite';
    
    return Promise.reject({ 
      ...error, 
      userMessage: errorMessage 
    });
  }
);

// Extension de l'API pour inclure les méthodes mock en développement
export const authAPI = {
  // Connexion vendeur
  async loginSeller(fullName: string, whatsappNumber: string) {
    if (isDev) {
      try {
        const seller = await mockAuth.loginSeller(fullName, whatsappNumber);
        return { data: seller };
      } catch (error) {
        if (error instanceof Error) {
          if (error instanceof Error) {
            throw { response: { data: { message: error.message } } };
          } else {
            throw { response: { data: { message: 'An unknown error occurred' } } };
          }
        } else {
          throw { response: { data: { message: 'An unknown error occurred' } } };
        }
      }
    }
    return api.post('/seller/login', { fullName, whatsappNumber });
  },
  
  // Inscription vendeur
  async registerSeller(data: any) {
    if (isDev) {
      try {
        const seller = await mockAuth.registerSeller(data);
        return { data: seller };
      } catch (error) {
        throw { response: { data: { message: error.message } } };
      }
    }
    return api.post('/sellers/register', data);
  },
  
  // Connexion admin
  async loginAdmin(email: string, password: string) {
    if (isDev) {
      try {
        const admin = await mockAuth.loginAdmin(email, password);
        return { data: admin };
      } catch (error) {
        throw { response: { data: { message: error.message } } };
      }
    }
    return api.post('/admin/login', { email, password });
  },
  
  // Génération QR Code
  async generateQRCode(sellerId: string) {
    if (isDev) {
      try {
        const qrCodeImage = await mockAuth.generateQRCode(sellerId);
        return { data: { qrCodeImage } };
      } catch (error) {
        throw { response: { data: { message: error.message } } };
      }
    }
    return api.post(`/sellers/${sellerId}/generate-qr`);
  },
  
  // Vérifier le statut WhatsApp
  async checkWhatsAppStatus(sellerId: string) {
    if (isDev) {
      try {
        const isConnected = await mockAuth.checkWhatsAppStatus(sellerId);
        return { data: { isWhatsappConnected: isConnected } };
      } catch (error) {
        throw { response: { data: { message: error.message } } };
      }
    }
    return api.get(`/seller/${sellerId}`);
  },
  
  // Déconnecter WhatsApp
  async disconnectWhatsApp(sellerId: string) {
    if (isDev) {
      try {
        await mockAuth.disconnectWhatsApp(sellerId);
        return { data: { success: true } };
      } catch (error) {
        throw { response: { data: { message: error.message } } };
      }
    }
    return api.post(`/sellers/${sellerId}/disconnect-whatsapp`);
  }
};

// Cette fonction appelle le proxy API de Next.js
export const callApi = async (endpoint: string, options: RequestInit = {}) => {
  try {
    // Utiliser notre proxy interne au lieu d'appeler directement le backend
    const response = await fetch(`/api/proxy/${endpoint}`, options);
    
    if (!response.ok) {
      let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Impossible de parser le JSON, on garde le message d'erreur par défaut
      }
      

    }
    
    // Vérifier si la réponse est du JSON avant de la parser
    const contentType = response.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
      return response.json();
    } else {
      // Pour les autres types de contenu (images, etc.)
      return response;
    }
  } catch (error) {
    console.error('Erreur API:', error);
    
    // En développement, fournir des données simulées pour certaines routes critiques
    if (process.env.NODE_ENV === 'development' && endpoint.includes('whatsapp/generate-qr')) {
      console.warn('⚠️ Utilisation de données simulées suite à une erreur');
      return {
        qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=fallback-${Date.now()}`,
        message: 'QR code généré en mode secours'
      };
    }
    
    throw error;
  }
};

export default callApi;