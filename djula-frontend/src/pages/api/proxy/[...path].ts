import type { NextApiRequest, NextApiResponse } from 'next';

// Détecte automatiquement l'URL du backend sans le /api final
const getBackendUrl = () => {
  // En production ou sur un serveur de staging
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, ''); // Enlever /api à la fin
  }
  
  // Dans un environnement Codespaces
  if (process.env.CODESPACE_NAME) {
    const frontendPort = '3000';
    const backendPort = '3001';
    return `https://${process.env.CODESPACE_NAME}-${backendPort}.app.github.dev`;
  }
  
  // Développement local par défaut
  return 'http://localhost:3001';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Récupérer le chemin de l'API à partir des paramètres de route
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path;
    
    // Construire l'URL complète avec un seul /api
    const backendUrl = getBackendUrl();
    const url = `${backendUrl}/api/${apiPath}`;
    
    console.log(`🔄 Proxy API: ${req.method} ${apiPath} → ${url}`);
    
    // En mode développement, simuler une réponse pour certains endpoints spécifiques
    // Cela permet de continuer le développement même si le backend n'est pas disponible
    if (process.env.NODE_ENV === 'development' && apiPath && apiPath.includes('whatsapp/')) {
      console.log(`⚠️ Mode développement: simulation de réponse pour ${apiPath}`);
      
      if (apiPath.includes('generate-qr')) {
        return res.status(200).json({
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=whatsapp://demo/${Date.now()}`,
          expiresAt: new Date(Date.now() + 120000) // 2 minutes
        });
      }
      
      if (apiPath.includes('status')) {
        return res.status(200).json({
          isWhatsappConnected: Math.random() > 0.7, // 30% de chance d'être connecté
          phoneNumber: "+22501234567",
          lastConnectionDate: new Date().toISOString()
        });
      }
      
      if (apiPath.includes('disconnect')) {
        return res.status(200).json({
          message: 'WhatsApp déconnecté avec succès',
          isWhatsappConnected: false
        });
      }
    }
    
    // Préparer les options pour la requête au backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Transférer les en-têtes d'autorisation si présents
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization as string;
    }
    
    // Créer les options de la requête
    const options: RequestInit = {
      method: req.method,
      headers,
      // Ne pas ajouter de corps pour les méthodes GET ou HEAD
      ...(req.method !== 'GET' && req.method !== 'HEAD' && req.body ? { 
        body: JSON.stringify(req.body) 
      } : {})
    };
    
    try {
      // Faire la requête au backend avec un timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondes de timeout
      
      const response = await fetch(url, { 
        ...options, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      // Déterminer le type de contenu de la réponse
      const contentType = response.headers.get('Content-Type');
      
      // Pour les réponses JSON
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        return res.status(response.status).json(data);
      }
      
      // Pour les images ou autres contenus binaires
      if (contentType?.includes('image/') || contentType?.includes('application/octet-stream')) {
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        return res.status(response.status).send(Buffer.from(buffer));
      }
      
      // Pour le texte simple
      const text = await response.text();
      res.setHeader('Content-Type', contentType || 'text/plain');
      return res.status(response.status).send(text);
    } catch (fetchError) {
      if (fetchError instanceof Error) {
        console.error(`❌ Erreur de connexion au backend: ${fetchError.message}`);
      } else {
        console.error('❌ Erreur de connexion au backend:', fetchError);
      }
      
      // En développement, simuler des données pour continuer à travailler
      if (process.env.NODE_ENV === 'development') {
        if (apiPath && apiPath.includes('dashboard')) {
          return res.status(200).json({
            totalSales: Math.floor(Math.random() * 100000),
            totalOrders: Math.floor(Math.random() * 500),
            totalCustomers: Math.floor(Math.random() * 300),
            message: "Données simulées en mode développement"
          });
        }
        
        // Réponse générique pour d'autres routes
        return res.status(200).json({
          success: true,
          message: "Données simulées en mode développement",
          data: { timestamp: new Date().toISOString() }
        });
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Erreur proxy API:', error);
    return res.status(500).json({ 
      error: 'Erreur de connexion au serveur backend', 
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Augmenter la limite pour permettre l'upload d'images
    },
  },
};