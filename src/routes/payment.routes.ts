import { Router } from 'express';
import { PaymentService } from '../services/payment/payment.service';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const paymentService = new PaymentService();

// Get available payment methods
router.get('/methods', async (req, res) => {
  try {
    // Pour une requête non authentifiée, nous utilisons getPaymentMethods()
    // qui renvoie les méthodes par défaut
    const paymentMethods = await paymentService.getPaymentMethods();
    res.status(200).json(paymentMethods);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des méthodes de paiement' });
  }
});

// Get available payment methods for authenticated user
router.get('/my-methods', authMiddleware, async (req, res) => {
  try {
    // Pour une requête authentifiée, nous utilisons getAvailablePaymentMethods()
    // qui peut personnaliser les méthodes selon le client
    const customerId = req.user.id;
    const paymentMethods = await paymentService.getAvailablePaymentMethods(customerId);
    res.status(200).json(paymentMethods);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des méthodes de paiement' });
  }
});

// Initialize payment
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const { orderId, paymentMethodId } = req.body;
    const customerId = req.user.id;
    
    const paymentInfo = await paymentService.initializePayment({
      orderId,
      customerId,
      paymentMethodId
    });
    
    res.status(200).json(paymentInfo);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de l\'initialisation du paiement' });
  }
});

// Verify mobile money payment
router.post('/verify-mobile', authMiddleware, async (req, res) => {
  try {
    const { transactionId, phoneNumber } = req.body;
    const customerId = req.user.id;
    
    const result = await paymentService.verifyMobilePayment(transactionId, phoneNumber, customerId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: 'Échec de la vérification du paiement' });
  }
});

// Verify any payment type
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { orderId, reference } = req.body;
    
    const result = await paymentService.verifyPayment(orderId, { reference });
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: 'Échec de la vérification du paiement' });
  }
});

// Webhook for payment providers callbacks
router.post('/webhook/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    const data = req.body;
    
    await paymentService.handlePaymentWebhook(provider, data);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Payment webhook error:', error);
    // Toujours renvoyer 200 aux webhooks pour éviter les relances
    res.status(200).send('Error processed');
  }
});

export default router;