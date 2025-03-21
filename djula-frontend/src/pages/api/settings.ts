import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import fs from 'fs';
import path from 'path';

// Type étendu pour inclure l'ID utilisateur
interface UserWithId {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// Variables pour l'API
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3001';

// Helper pour les appels API
async function fetchFromBackend(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
}

// Fonction pour charger/sauvegarder les paramètres localement (solution temporaire)
const SETTINGS_DIR = path.join(process.cwd(), 'tmp');
const getSettingsPath = (userId: string) => path.join(SETTINGS_DIR, `settings-${userId}.json`);

// Paramètres par défaut
const defaultSettings = {
  general: {
    currency: 'XOF',
    language: 'fr',
    timezone: 'Africa/Abidjan',
    showOutOfStock: true,
    autoApproveReviews: false,
    defaultSortOrder: 'newest'
  },
  notifications: {
    newOrder: true,
    lowStock: true,
    customerMessages: true,
    productReviews: true,
    dailySummary: false,
    weeklySummary: true,
    marketingUpdates: true
  },
  advanced: {
    enableAPIAccess: false,
    apiKey: '',
    maintenanceMode: false,
    debugMode: false
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Créer le dossier temporaire s'il n'existe pas
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }

  // Vérifier l'authentification
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const user = session.user as UserWithId;
  // Vérifier que l'ID utilisateur existe
  if (!user.id) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const userId = user.id;

  // GET - Récupérer les paramètres
  if (req.method === 'GET') {
    try {
      const settingsPath = getSettingsPath(userId);
      
      // Si le fichier existe, lire les paramètres
      if (fs.existsSync(settingsPath)) {
        const fileContent = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(fileContent);
        return res.status(200).json(settings);
      }
      
      // Sinon retourner les paramètres par défaut
      return res.status(200).json(defaultSettings);
    } catch (error) {
      console.error('Erreur lors de la récupération des paramètres:', error);
      return res.status(200).json(defaultSettings);
    }
  }

  // PUT - Mettre à jour les paramètres
  if (req.method === 'PUT') {
    try {
      const { general, notifications, advanced } = req.body;
      
      // Validation simple
      if (!general || !notifications || !advanced) {
        return res.status(400).json({ error: 'Données incomplètes' });
      }

      // Générer une clé API si elle est activée mais vide
      if (advanced.enableAPIAccess && !advanced.apiKey) {
        advanced.apiKey = `djula_${Math.random().toString(36).substring(2, 15)}`;
      }

      // Sauvegarder les paramètres dans un fichier
      const settings = { general, notifications, advanced };
      fs.writeFileSync(getSettingsPath(userId), JSON.stringify(settings, null, 2));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // Méthode non supportée
  return res.status(405).json({ error: 'Méthode non autorisée' });
}