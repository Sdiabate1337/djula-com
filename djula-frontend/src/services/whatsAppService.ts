// src/services/whatsAppService.ts
import callApi from './api';  // Assurez-vous d'importer correctement callApi
import { authAPI } from './api'; // Import pour les mocks

const isDev = process.env.NODE_ENV === 'development';

const whatsAppService = {
  /**
   * Génère un QR code pour la connexion WhatsApp
   */
  async generateQRCode(sellerId: string) {
    try {
      // En développement, utiliser les mocks pour éviter les erreurs backend
      if (isDev) {
        return await authAPI.generateQRCode(sellerId).then(res => res.data);
      }
      
      // En production, appeler le vrai backend via notre proxy
      return await callApi(`sellers/${sellerId}/whatsapp/generate-qr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la génération du QR code:', error);
      
      // En développement, retourner un QR code de démonstration si tout échoue
      if (isDev) {
        console.warn('⚠️ Utilisation d\'un QR code de démonstration');
        return {
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=whatsapp://djula/demo/${sellerId}/${Date.now()}`,
          expiresAt: new Date(Date.now() + 120000) // 2 minutes
        };
      }
      
      throw error;
    }
  },

  /**
   * Vérifie le statut de connexion WhatsApp
   */
  async checkWhatsAppStatus(sellerId: string) {
    try {
      // En développement, utiliser les mocks
      if (isDev) {
        return await authAPI.checkWhatsAppStatus(sellerId).then(res => res.data);
      }
      
      return await callApi(`sellers/${sellerId}/whatsapp/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la vérification du statut WhatsApp:', error);
      
      // En développement, simuler une réponse
      if (isDev) {
        return { isWhatsappConnected: Math.random() > 0.5 };
      }
      
      throw error;
    }
  },

  /**
   * Déconnecte le compte WhatsApp
   */
  async disconnectWhatsApp(sellerId: string) {
    try {
      // En développement, utiliser les mocks
      if (isDev) {
        return await authAPI.disconnectWhatsApp(sellerId).then(res => res.data);
      }
      
      return await callApi(`sellers/${sellerId}/whatsapp/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion WhatsApp:', error);
      throw error;
    }
  },

  /**
   * Envoie un message WhatsApp à un client
   */
  async sendMessage(sellerId: string, customerPhone: string, message: string) {
    try {
      return await callApi(`api/sellers/${sellerId}/whatsapp/send-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customerPhone, message })
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      throw error;
    }
  },
  
  /**
   * Récupère l'historique des conversations
   */
  async getConversations(sellerId: string, page = 1, limit = 20) {
    try {
      return await callApi(`api/sellers/${sellerId}/whatsapp/conversations?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des conversations:', error);
      throw error;
    }
  }
};

export default whatsAppService;