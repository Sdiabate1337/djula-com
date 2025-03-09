import { Router } from 'express';
import { OrderService } from '../services/order/order.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { OrderStatus } from '../types/ai.types';

const router = Router();
const orderService = new OrderService();

// Get orders for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await orderService.getOrdersByUserId(userId);
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

// Get specific order details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    const order = await orderService.getOrderById(orderId);
    
    // Check if order belongs to user or user is an admin
    if (order.customerId !== userId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
});

// Create new order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    const customerId = req.user.id;
    
    const sellerId = req.user.sellerId; // Assuming sellerId is available in req.user
    const order = await orderService.createOrder(customerId, {
      customerId,
      sellerId,
      items,
      shippingAddress,
      paymentMethod
    });
    
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la création de la commande' });
  }
});

// Cancel order
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    const order = await orderService.getOrderById(orderId);
    
    // Check if order belongs to user
    if (order.customerId !== userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    // Check if order can be canceled
    if (!['PENDING', 'PROCESSING'].includes(order.status)) {
      return res.status(400).json({ error: 'Cette commande ne peut plus être annulée' });
    }
    
    const canceledOrder = await orderService.updateOrderStatus(orderId, OrderStatus.CANCELLED);
    res.status(200).json(canceledOrder);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la commande' });
  }
});

export default router;