import { Router } from 'express';
import { CustomerService } from '../services/customer/customer.service';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const customerService = new CustomerService();

// 1. Récupérer le profil client (ESSENTIEL)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const profile = await customerService.findCustomer({ id: customerId });
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

// 2. Mettre à jour le profil client (ESSENTIEL)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { whatsappName, metadata } = req.body;
    
    const updatedProfile = await customerService.updateCustomer(customerId, {
      whatsappName,
      metadata: {
        ...metadata,
        lastUpdate: new Date()
      }
    });
    
    res.status(200).json(updatedProfile);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

// 3. Récupérer les préférences (ESSENTIEL pour la personnalisation)
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const preferences = await customerService.getCustomerPreferences(customerId);
    res.status(200).json(preferences);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des préférences' });
  }
});

// 4. Mettre à jour les préférences (ESSENTIEL pour la personnalisation)
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const preferences = req.body;
    
    const updatedCustomer = await customerService.updateCustomerPreferences(customerId, preferences);
    
    res.status(200).json(updatedCustomer.preferences);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la mise à jour des préférences' });
  }
});

// 5. Créer un ticket de support (ESSENTIEL pour le service client)
router.post('/support', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { issue, priority } = req.body;
    
    const ticket = await customerService.createSupportTicket({
      customerId,
      issue,
      priority
    });
    
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la création du ticket de support' });
  }
});

// 6. Lier un compte WhatsApp (IMPORTANT pour l'intégration WhatsApp)
router.post('/link-whatsapp', async (req, res) => {
  try {
    const { phoneNumber, whatsappId, whatsappName } = req.body;
    
    const customer = await customerService.createOrUpdateCustomer({
      phoneNumber,
      whatsappId, 
      whatsappName
    });
    
    res.status(200).json({
      success: true,
      customer: {
        id: customer.id,
        whatsappName: customer.whatsappName,
        phoneNumber: customer.phoneNumber
      }
    });
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la liaison avec WhatsApp' });
  }
});

// ====== HISTORIQUE DES COMMANDES ======

// Récupérer l'historique des commandes
router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { page = '1', limit = '10', status } = req.query;
    
    // Cette méthode devrait être implémentée dans votre OrderService
    // On peut l'appeler depuis le CustomerService via une composition de services
    const orders = await customerService.getCustomerOrders(customerId, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as string
    });
    
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

// Récupérer les détails d'une commande spécifique
router.get('/orders/:orderId', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const orderId = req.params.orderId;
    
    const order = await customerService.getCustomerOrderDetails(customerId, orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des détails de la commande' });
  }
});

// ====== GESTION DES ADRESSES ======

// Récupérer toutes les adresses du client
router.get('/addresses', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const addresses = await customerService.getCustomerAddresses(customerId);
    
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des adresses' });
  }
});

// Ajouter une nouvelle adresse
router.post('/addresses', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const addressData = req.body;
    
    const newAddress = await customerService.addCustomerAddress(customerId, addressData);
    
    res.status(201).json(newAddress);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de l\'ajout de l\'adresse' });
  }
});

// Mettre à jour une adresse existante
router.put('/addresses/:addressId', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const addressId = req.params.addressId;
    const updates = req.body;
    
    const updatedAddress = await customerService.updateCustomerAddress(
      customerId, 
      addressId, 
      updates
    );
    
    if (!updatedAddress) {
      return res.status(404).json({ error: 'Adresse non trouvée' });
    }
    
    res.status(200).json(updatedAddress);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la mise à jour de l\'adresse' });
  }
});

// Supprimer une adresse
router.delete('/addresses/:addressId', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const addressId = req.params.addressId;
    
    const success = await customerService.deleteCustomerAddress(customerId, addressId);
    
    if (!success) {
      return res.status(404).json({ error: 'Adresse non trouvée' });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'adresse' });
  }
});

// Définir une adresse comme adresse par défaut
router.put('/addresses/:addressId/default', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const addressId = req.params.addressId;
    
    const updatedAddresses = await customerService.setDefaultAddress(customerId, addressId);
    
    res.status(200).json(updatedAddresses);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la définition de l\'adresse par défaut' });
  }
});

// ====== LISTE DE FAVORIS ======

// Récupérer la liste des produits favoris
router.get('/wishlist', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const wishlist = await customerService.getCustomerWishlist(customerId);
    
    res.status(200).json(wishlist);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des favoris' });
  }
});

// Ajouter un produit aux favoris
router.post('/wishlist', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'ID du produit requis' });
    }
    
    const updatedWishlist = await customerService.addToWishlist(customerId, productId);
    
    res.status(200).json(updatedWishlist);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de l\'ajout du produit aux favoris' });
  }
});

// Supprimer un produit des favoris
router.delete('/wishlist/:productId', authMiddleware, async (req, res) => {
  try {
    const customerId = req.user.id;
    const productId = req.params.productId;
    
    const updatedWishlist = await customerService.removeFromWishlist(customerId, productId);
    
    res.status(200).json(updatedWishlist);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression du produit des favoris' });
  }
});

export default router;