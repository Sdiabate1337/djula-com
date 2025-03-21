import { UserType } from '../types/user';

// Types pour notre mock
export interface MockSeller {
  id: string;
  fullName: string;
  brandName: string;
  whatsappNumber: string;
  city: string;
  businessType: string;
  isWhatsappConnected: boolean;
  profileImageUrl?: string;
  createdAt: string;
}

export interface MockAdmin {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

// Utilisateurs prédéfinis pour tester
const MOCK_SELLERS: MockSeller[] = [
  {
    id: 'seller-001',
    fullName: 'John Doe',
    brandName: 'JD Fashion',
    whatsappNumber: '+225071234567',
    city: 'Abidjan',
    businessType: 'FASHION',
    isWhatsappConnected: false,
    createdAt: new Date().toISOString()
  }
];

const MOCK_ADMINS: MockAdmin[] = [
  {
    id: 'admin-001',
    email: 'admin@djula.com',
    fullName: 'Admin Djula',
    role: 'ADMIN',
    createdAt: new Date().toISOString()
  }
];

// Fonction pour simuler un délai réseau
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Service d'authentification mock
export const mockAuth = {
  // Connexion vendeur
  async loginSeller(fullName: string, whatsappNumber: string): Promise<MockSeller> {
    await delay(800); // Simuler un délai d'API
    
    const seller = MOCK_SELLERS.find(s => 
      s.fullName.toLowerCase() === fullName.toLowerCase() && 
      s.whatsappNumber === whatsappNumber
    );
    
    if (!seller) {
      throw new Error('Nom ou numéro WhatsApp incorrect');
    }
    
    return seller;
  },
  
  // Inscription vendeur
  async registerSeller(data: Omit<MockSeller, 'id' | 'createdAt' | 'isWhatsappConnected'>): Promise<MockSeller> {
    await delay(1000);
    
    // Vérifier si le vendeur existe déjà
    const exists = MOCK_SELLERS.some(s => s.whatsappNumber === data.whatsappNumber);
    if (exists) {
      throw new Error('Ce numéro WhatsApp est déjà enregistré');
    }
    
    // Créer un nouveau vendeur
    const newSeller: MockSeller = {
      ...data,
      id: `seller-${Date.now().toString().slice(-6)}`,
      isWhatsappConnected: false,
      createdAt: new Date().toISOString()
    };
    
    // Ajouter à notre "base de données" locale
    MOCK_SELLERS.push(newSeller);
    
    return newSeller;
  },
  
  // Connexion admin
  async loginAdmin(email: string, password: string): Promise<MockAdmin> {
    await delay(800);
    
    // En mode dev on accepte admin@djula.com + n'importe quel mot de passe
    const admin = MOCK_ADMINS.find(a => a.email.toLowerCase() === email.toLowerCase());
    
    if (!admin || (email !== 'admin@djula.com' && password !== 'admin123')) {
      throw new Error('Email ou mot de passe incorrect');
    }
    
    return admin;
  },
  
  // Gestion QR Code WhatsApp
  async generateQRCode(sellerId: string): Promise<string> {
    await delay(1200);
    
    // Générer un QR code fictif (base64)
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIQAAACECAYAAABRRIOnAAAAAklEQVR4AewaftIAAAOSSURBVO3BQY4cSRIEQdNA/f/Lun30KQFJZM7MokYQ9mNm/mOMMQZjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhj3Dz8kMrvVLyh8qTiDZXfqXhD5SdjjDeMnlT5isodlROVOxV3VE5UvqJyp+InKicqX1F5o+JJZYwxxhtGdyp+Q+WOyhOVr6g8qThROan4JypPKn5D5U7FGGOMMd5QeaLyTuWOyhOVOypPVN6p+EmVE5UnFXcq7qicVDxRGWOMMd4w/rKKE5WTijdUTlROKv6SipOKMcYYY4zxA5U7FScqJyp3Kk5U7lScqNxROVG5o3Ki8i9TOVEZfzPGeMPoL1N5Q+UNlf+SihOVf5nKicpJxRhjjDHe+GEqv1NxUvE7KicVJxUnFScqJxVPVN5QOak4qThReaPiROVOxZ2KJxVPKsYYY4zxg4r/JZUnFScqJyonFXcqTlROVE5UTlROKk5U7lScVJyonFScVNypOKk4UXlSMcYYY/zgYRX/JJWvqLxTcaLyRsUbKicVJypPKk5UnlScVIwxxhjjDZUTlScqJyp3VE5UTlROVE5U7qjcUXlD5Y7KScUTlROVJxVPVO6o3Kn4SsUYY4zxhsodlScqJypPVE5UTlTeULmj8kTlROWJyhOVOypvqJyoXajcqThROVF5UjHGGGO8UfFE5UTljsqTipOKE5UnKicqJyp3KicqJypPKu5UnKicVJxUnKicVNypuKNyp+KOypOKMcYY4w2VOxUnKicqJyp3VE5U7qicqDxROVG5o/KViicVv6FyUnFS8UTln1QxxhhjvFFxp+JE5Y7KnYoTlScVJyonFScVT1ROVE5U7qg8UTlR+UsqTlTuqJyojL8ZY7xh9EOVJyp3Kp5UnKjcUXlS8UTlROVOxYnKHZU7KicqJyonKndUTlROVO6onKicqJyovFExxhhjvKHyO5UnKicqJypPKk5UTlTuqPyGypOKE5U7KndUTlROVE5U7qicqNypGGOMMcYPqfxOxYnKicqTipOKJypPKk5U3lC5U/GViicqd1ROKk5UTlROVE5U7lSMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4z/+B9XqRM88HH9MwAAAABJRU5ErkJggg==';
  },
  
  // Vérifier le statut WhatsApp
  async checkWhatsAppStatus(sellerId: string): Promise<boolean> {
    await delay(500);
    
    const seller = MOCK_SELLERS.find(s => s.id === sellerId);
    return seller?.isWhatsappConnected || false;
  },
  
  // Connecter WhatsApp
  async connectWhatsApp(sellerId: string): Promise<boolean> {
    await delay(1500);
    
    const sellerIndex = MOCK_SELLERS.findIndex(s => s.id === sellerId);
    if (sellerIndex >= 0) {
      MOCK_SELLERS[sellerIndex].isWhatsappConnected = true;
      return true;
    }
    
    return false;
  },
  
  // Déconnecter WhatsApp
  async disconnectWhatsApp(sellerId: string): Promise<boolean> {
    await delay(1000);
    
    const sellerIndex = MOCK_SELLERS.findIndex(s => s.id === sellerId);
    if (sellerIndex >= 0) {
      MOCK_SELLERS[sellerIndex].isWhatsappConnected = false;
      return true;
    }
    
    return false;
  }
};