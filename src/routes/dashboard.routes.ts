import { Router } from 'express';
import { DashboardService } from '../services/dashboard/dashboard.service';
import { SellerService } from '../services/seller/seller.service';
import { authMiddleware, adminMiddleware, sellerMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const dashboardService = new DashboardService();
const sellerService = new SellerService();

// Routes d'administration
// -----------------------

// Stats générales (pour admin)
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Générer un tableau de bord global pour les admins
    // En utilisant un ID spécial "admin" pour indiquer qu'il s'agit du tableau de bord admin
    const stats = await dashboardService.generateDashboard(
      'admin',
      'day',
      startDate && endDate ? new Date(startDate as string) : undefined
    );
    
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Aperçu des ventes (pour admin)
router.get('/sales', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { period } = req.query;
    
    // Utiliser une période spécifique en fonction du paramètre
    const stats = await dashboardService.generateDashboard(
      'admin',
      (period as 'day' | 'week' | 'month') || 'day'
    );
    
    // N'envoyer que la partie des métriques clés et ventes
    res.status(200).json({
      keyMetrics: stats.keyMetrics,
      datePeriod: stats.datePeriod
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données de vente' });
  }
});

// Activité client (pour admin)
router.get('/customer-activity', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { days } = req.query;
    
    // Calculer la date de début en fonction du nombre de jours demandés
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (parseInt(days as string) || 30));
    
    const dashboard = await dashboardService.generateDashboard('admin', 'day', startDate);
    
    res.status(200).json({
      recentActivity: dashboard.recentActivity,
      whatsappInsights: dashboard.whatsappInsights
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données d\'activité' });
  }
});

// Performance produit (pour admin)
router.get('/product-performance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { limit } = req.query;
    
    const dashboard = await dashboardService.generateDashboard('admin', 'month');
    
    // Limiter le nombre de produits retournés si nécessaire
    const limitNum = parseInt(limit as string) || 10;
    const inventory = {
      ...dashboard.inventory,
      topSellers: dashboard.inventory.topSellers.slice(0, limitNum)
    };
    
    res.status(200).json({
      inventory,
      forecast: dashboard.forecast
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des performances produit' });
  }
});

// Routes pour les vendeurs
// -----------------------

// Tableau de bord complet du vendeur
router.get('/seller', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { period } = req.query;
    
    // Générer le tableau de bord complet pour ce vendeur
    const dashboard = await dashboardService.generateDashboard(
      sellerId,
      (period as 'day' | 'week' | 'month') || 'day'
    );
    
    res.status(200).json(dashboard);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du tableau de bord' });
  }
});

// Statut de connexion WhatsApp du vendeur
router.get('/seller/whatsapp-status', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const seller = await sellerService.getSellerById(sellerId);
    
    if (!seller) {
      return res.status(404).json({ error: 'Vendeur non trouvé' });
    }
    
    res.status(200).json({
      isConnected: seller.isWhatsappConnected,
      whatsappNumber: seller.whatsappNumber
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du statut WhatsApp' });
  }
});

// Liste des vendeurs (pour admin)
router.get('/admin/sellers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page, limit, city, businessType, isConnected } = req.query;
    
    const result = await sellerService.getAllSellers({
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      filters: {
        city: city as string,
        businessType: businessType as string,
        isConnected: isConnected === 'true'
      }
    });
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des vendeurs' });
  }
});

// Détails d'un vendeur spécifique (pour admin)
router.get('/admin/sellers/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const sellerId = req.params.id;
    
    // Utiliser la méthode generateDashboard pour obtenir toutes les informations du vendeur
    const dashboard = await dashboardService.generateDashboard(sellerId, 'day');
    
    if (!dashboard.seller) {
      return res.status(404).json({ error: 'Vendeur non trouvé' });
    }
    
    res.status(200).json(dashboard);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des détails du vendeur' });
  }
});

// Marquer une notification comme lue
router.post('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const success = await dashboardService.markNotificationAsRead(notificationId);
    
    if (!success) {
      return res.status(400).json({ error: 'Impossible de marquer la notification comme lue' });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du traitement de la notification' });
  }
});

// Marquer une action comme complétée
router.post('/actions/:id/complete', authMiddleware, async (req, res) => {
  try {
    const actionId = req.params.id;
    const success = await dashboardService.markActionAsCompleted(actionId);
    
    if (!success) {
      return res.status(400).json({ error: 'Impossible de marquer l\'action comme complétée' });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du traitement de l\'action' });
  }
});

// Enregistrer les préférences du tableau de bord
router.post('/preferences', authMiddleware, async (req, res) => {
  try {
    const { favoriteMetrics, hiddenSections, defaultDateRange, notificationSettings } = req.body;
    const sellerId = req.user.id;
    
    const success = await dashboardService.saveDashboardPreferences(sellerId, {
      favoriteMetrics,
      hiddenSections,
      defaultDateRange,
      notificationSettings
    });
    
    if (!success) {
      return res.status(400).json({ error: 'Impossible de sauvegarder les préférences' });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des préférences' });
  }
});

export default router;