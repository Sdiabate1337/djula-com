import callApi from './api';

const dashboardService = {
  /**
   * Récupère les statistiques du vendeur
   */
  async getSellerStats(sellerId: string) {
    try {
      return await callApi(`api/dashboard/sellers/${sellerId}/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        totalCustomers: 0,
        activeCustomers: 0,
        totalMessages: 0,
        averageResponseTime: 0,
        totalSales: 0,
        pendingOrders: 0
      };
    }
  },

  /**
   * Récupère les commandes récentes
   */
  async getRecentOrders(sellerId: string, limit = 3) {
    try {
      return await callApi(`api/dashboard/sellers/${sellerId}/orders/recent?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes récentes:', error);
      return [];
    }
  },

  /**
   * Récupère les données pour le graphique de ventes
   */
  async getSalesChartData(sellerId: string, period = '7d') {
    try {
      return await callApi(`api/dashboard/sellers/${sellerId}/sales/chart?period=${period}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des données du graphique:', error);
      return [];
    }
  },

  /**
   * Vérifie l'état de connexion WhatsApp
   */
  async getWhatsAppStatus(sellerId: string) {
    try {
      const response = await callApi(`api/dashboard/sellers/${sellerId}/whatsapp/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.connected || false;
    } catch (error) {
      console.error('Erreur lors de la vérification du statut WhatsApp:', error);
      return false;
    }
  }
};

export default dashboardService;