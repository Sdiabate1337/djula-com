import { Router } from 'express';
import { SellerService } from '../services/seller/seller.service';
import { AdminService, AdminCreationData } from '../services/admin/admin.service';
import { authMiddleware, adminMiddleware, superAdminMiddleware } from '../middlewares/auth.middleware';
import * as jwt from 'jsonwebtoken';

const router = Router();
const sellerService = new SellerService();
const adminService = new AdminService();

// 1. Connexion pour vendeurs (par WhatsApp)
router.post('/seller/login', async (req, res) => {
  try {
    const { whatsappNumber, fullName } = req.body;
    
    if (!whatsappNumber || !fullName) {
      return res.status(400).json({ error: 'Numéro WhatsApp et nom complet requis' });
    }
    
    const seller = await sellerService.loginSeller({
      whatsappNumber,
      fullName
    });
    
    // Générer un JWT pour le vendeur
    const token = jwt.sign(
      { 
        id: seller.id, 
        role: seller.role,
        whatsappNumber: seller.whatsappNumber
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );
    
    res.status(200).json({
      user: seller,
      token
    });
  } catch (error) {
    res.status(401).json({ error: 'Échec de l\'authentification. Vérifiez votre nom et numéro WhatsApp.' });
  }
});

// 2. Connexion pour administrateurs (par email/mot de passe)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    
    const admin = await adminService.loginAdmin(email, password);
    
    // Générer un JWT pour l'admin
    const token = jwt.sign(
      { 
        id: admin.id, 
        role: admin.role,
        email: admin.email
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '8h' }
    );
    
    res.status(200).json({
      user: admin,
      token
    });
  } catch (error) {
    res.status(401).json({ error: 'Échec de l\'authentification. Vérifiez votre email et mot de passe.' });
  }
});

// 3. Inscription vendeur
router.post('/seller/register', async (req, res) => {
  try {
    const {
      fullName,
      brandName,
      whatsappNumber,
      city,
      businessType
    } = req.body;
    
    if (!fullName || !whatsappNumber || !businessType) {
      return res.status(400).json({ error: 'Informations incomplètes' });
    }
    
    const seller = await sellerService.registerSeller({
      fullName,
      brandName,
      whatsappNumber,
      city,
      businessType
    });
    
    // Générer un JWT
    const token = jwt.sign(
      { 
        id: seller.id, 
        role: seller.role,
        whatsappNumber: seller.whatsappNumber
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      seller,
      token
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Échec de l\'inscription' });
  }
});

// 4. Création d'un administrateur par un super-admin
router.post('/admin/create', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;
    
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Informations incomplètes' });
    }
    
    const admin = await adminService.createAdmin({
      email,
      password,
      fullName,
      role: role || 'ADMIN'
    });
    
    res.status(201).json({
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role
    });
  } catch (error) {
    res.status(400).json({ error: 'Échec de la création de l\'administrateur' });
  }
});

// 5. Générer QR code pour connexion WhatsApp
router.get('/seller/whatsapp-qr', authMiddleware, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est bien un vendeur
    if (req.user.role !== 'SELLER') {
      return res.status(403).json({ error: 'Seuls les vendeurs peuvent générer des codes QR WhatsApp' });
    }
    
    const qrCode = await sellerService.generateConnectionQR(req.user.id);
    res.status(200).json({ qrCode });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la génération du code QR' });
  }
});

// 6. Déconnexion (côté client - suppression du token JWT)
router.post('/logout', authMiddleware, (req, res) => {
  // JWT n'a pas besoin d'être invalidé côté serveur
  // Le client supprime simplement le token stocké
  res.status(200).json({ message: 'Déconnexion réussie' });
});

export default router;