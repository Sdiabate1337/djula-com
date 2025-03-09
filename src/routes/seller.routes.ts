import { Router } from 'express';
import { SellerService } from '../services/seller/seller.service';
import { OrderService } from '../services/order/order.service';
import { DashboardService } from '../services/dashboard/dashboard.service';
import { authMiddleware, sellerMiddleware } from '../middlewares/auth.middleware';
import { OrderStatus } from '../types/ai.types';

const router = Router();
const sellerService = new SellerService();
const orderService = new OrderService();
const dashboardService = new DashboardService();

// Get seller profile
router.get('/profile', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const profile = await sellerService.getSellerById(sellerId);
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du profil vendeur' });
  }
});

// Update seller profile
router.put('/profile', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { businessName, description, contactEmail, contactPhone, location, profileImage } = req.body;
    
    // Transformer les données au format attendu par updateSellerProfile
    const profileUpdates = {
      brandName: businessName,
      fullName: req.body.fullName,
      city: location,
      profileImageUrl: profileImage,
      // On peut ajouter ces champs à l'interface SellerProfile si nécessaire
      metadata: {
        description,
        contactEmail,
        contactPhone
      }
    };
    
    const updatedProfile = await sellerService.updateSellerProfile(sellerId, profileUpdates);
    res.status(200).json(updatedProfile);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la mise à jour du profil vendeur' });
  }
});

// Get seller dashboard
router.get('/dashboard', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { period = 'day' } = req.query;
    
    // Utilisation du DashboardService au lieu du SellerService
    const dashboard = await dashboardService.generateDashboard(
      sellerId,
      period as 'day' | 'week' | 'month'
    );
    
    res.status(200).json(dashboard);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du tableau de bord' });
  }
});

// Get seller orders
router.get('/orders', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, page, limit } = req.query;
    
    // Utilisation de OrderService qui expose une méthode getOrdersBySellerId
    const orders = await orderService.getOrdersBySellerId(sellerId, {
      status: status as OrderStatus,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    });
    
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

// Get specific order
router.get('/orders/:id', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const orderId = req.params.id;
    
    // Utiliser OrderService pour récupérer la commande
    const order = await orderService.getOrder(orderId);
    
    // Vérifier que la commande appartient bien à ce vendeur
    if (!order || order.sellerId !== sellerId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
});

// Update order status
router.put('/orders/:id/status', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const orderId = req.params.id;
    const { status } = req.body;
    
    // Vérifier que la commande appartient à ce vendeur
    const order = await orderService.getOrder(orderId);
    if (!order || order.sellerId !== sellerId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    // Utiliser OrderService pour mettre à jour le statut
    const updatedOrder = await orderService.updateOrderStatus(orderId, status);
    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la mise à jour du statut de commande' });
  }
});

// Get seller metrics
router.get('/metrics', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { period = 'day' } = req.query;
    
    // Utiliser le DashboardService pour récupérer seulement les métriques
    const dashboard = await dashboardService.generateDashboard(
      sellerId,
      period as 'day' | 'week' | 'month'
    );
    
    // Extraire seulement les métriques clés du tableau de bord
    const metrics = dashboard.keyMetrics || {
      sales: 0,
      orders: 0, 
      customers: 0,
      growth: 0
    };
    
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des métriques' });
  }
});

// Generate WhatsApp connection QR code
router.get('/connect/whatsapp', authMiddleware, sellerMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const qrCode = await sellerService.generateConnectionQR(sellerId);
    res.status(200).json({ qrCode });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la génération du QR code' });
  }
});

export default router;