import express from 'express';
import dotenv from 'dotenv';
import { WhatsAppService } from './services/whatsapp/whatsapp.service';
import * as whatsappRoutes from './routes/whatsapp.routes';
import * as authRoutes from './routes/auth.routes';
import * as productRoutes from './routes/product.routes';
import * as orderRoutes from './routes/order.routes';
import * as paymentRoutes from './routes/payment.routes';
import * as customerRoutes from './routes/customer.routes';
import * as dashboardRoutes from './routes/dashboard.routes';
import * as sellerRoutes from './routes/seller.routes';

// Configuration des variables d'environnement
dotenv.config();

// Initialisation du service WhatsApp
const whatsappService = new WhatsAppService();

// Création de l'application Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use('/api/webhook/whatsapp', whatsappRoutes.default(whatsappService));
app.use('/api/auth', authRoutes.default);
app.use('/api/products', productRoutes.default);
app.use('/api/orders', orderRoutes.default);
app.use('/api/payments', paymentRoutes.default);
app.use('/api/customers', customerRoutes.default);
app.use('/api/dashboard', dashboardRoutes.default);
app.use('/api/sellers', sellerRoutes.default);

// Route simple pour vérifier que le serveur est en ligne
app.get('/', (req, res) => {
  res.send('Djula Commerce API est opérationnelle');
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

export default app;