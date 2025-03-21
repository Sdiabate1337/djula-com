import React, { useState, useEffect } from 'react';
import authService from '../services/authService';

// Générateurs de données aléatoires
const generateRandomSeller = () => {
  // Prénoms ivoiriens
  const firstNames = ['Aminata', 'Kouamé', 'Adjoua', 'Adou', 'Aya', 'Konan', 'Koffi', 'Akissi', 'Awa', 'Fanta'];
  // Noms de famille ivoiriens
  const lastNames = ['Koné', 'Touré', 'Diallo', 'Kouassi', 'Ouattara', 'Coulibaly', 'Traoré', 'Bamba', 'Konaté'];
  // Villes ivoiriennes
  const cities = ['Abidjan', 'Bouaké', 'Yamoussoukro', 'Daloa', 'Korhogo', 'San-Pédro', 'Man', 'Divo', 'Gagnoa'];
  // Types d'activités
  const businessTypes = ['fashion', 'jewelry', 'cosmetics', 'food', 'electronics', 'crafts', 'art'];
  
  // Génération de données aléatoires
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const fullName = `${firstName} ${lastName}`;
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  const whatsappNumber = `+225${randomDigits.substring(0, 8)}`;
  const city = cities[Math.floor(Math.random() * cities.length)];
  const businessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  const brandName = `${firstName} ${businessType.charAt(0).toUpperCase() + businessType.slice(1)}`;
  
  return {
    fullName,
    brandName,
    whatsappNumber,
    city,
    businessType
  };
};

export default function AuthTest() {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Initialisation avec null pour éviter l'hydratation incohérente
  interface SellerData {
    fullName: string;
    brandName: string;
    whatsappNumber: string;
    city: string;
    businessType: string;
  }
  
  const [registerData, setRegisterData] = useState<SellerData | null>(null);
  
  // Générer les données aléatoires uniquement côté client après montage du composant
  useEffect(() => {
    setRegisterData(generateRandomSeller());
  }, []);
  
  // Mettre à jour l'état d'authentification au chargement
  useEffect(() => {
    // Au chargement, utiliser les données en cache pour un affichage rapide
    setUserData(authService.getUserData());
    
    // Puis rafraîchir les données depuis le backend
    const updateUserData = async () => {
      const freshData = await authService.refreshUserData();
      if (freshData) {
        setUserData(freshData);
      }
    };
    
    if (authService.isAuthenticated()) {
      updateUserData();
    }
  }, []);

  // Test d'inscription avec données dynamiques
  const testRegister = async () => {
    // Générer de nouvelles données à chaque inscription
    const newSellerData = generateRandomSeller();
    setRegisterData(newSellerData);
    
    setStatus(`Tentative d'inscription pour ${newSellerData.fullName}...`);
    setError('');
    
    try {
      const response = await authService.registerSeller(newSellerData);
      
      setStatus(`✅ Inscription réussie pour ${newSellerData.fullName}!`);
      setIsAuthenticated(authService.isAuthenticated());
      setUserData(authService.getUserData());
      console.log('Réponse complète:', response);
    } catch (err: any) {
      setError(`❌ Erreur: ${err.response?.data?.error || err.message}`);
    }
  };
  
  // Test de connexion
  const testLogin = async () => {
    setStatus('Tentative de connexion...');
    setError('');
    
    try {
      const response = await authService.loginSeller({
        fullName: "Vendeur Test",
        whatsappNumber: "+2250712345678"
      });
      
      setStatus('✅ Connexion réussie!');
      setIsAuthenticated(authService.isAuthenticated());
      setUserData(authService.getUserData());
      console.log('Réponse complète:', response);
    } catch (err: any) {
      setError(`❌ Erreur: ${err.response?.data?.error || err.message}`);
    }
  };
  
  // Test de déconnexion
  const testLogout = async () => {
    await authService.logout();
    setStatus('Déconnecté');
    setIsAuthenticated(false);
    setUserData(null);
  };
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test d'authentification Djula</h1>
      
      <div className="mb-8 p-4 bg-gray-100 rounded">
        <h2 className="text-lg font-semibold">État actuel</h2>
        <p>Authentifié: <span className={isAuthenticated ? "text-green-600 font-bold" : "text-red-600"}>{isAuthenticated ? "OUI" : "NON"}</span></p>
        {userData && (
          <div className="mt-2">
            <p className="font-semibold">Données utilisateur:</p>
            <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-auto mt-2">{JSON.stringify(userData, null, 2)}</pre>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button 
          onClick={testRegister}
          className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          1. Tester Inscription Vendeur
        </button>
        
        <button 
          onClick={testLogin}
          className="p-3 bg-green-600 text-white rounded hover:bg-green-700"
        >
          2. Tester Connexion Vendeur
        </button>
        
        <button 
          onClick={testLogout}
          className="p-3 bg-red-600 text-white rounded hover:bg-red-700"
        >
          3. Tester Déconnexion
        </button>
      </div>
      
      {status && <p className="my-2 p-3 bg-blue-100 text-blue-800 rounded">{status}</p>}
      {error && <p className="my-2 p-3 bg-red-100 text-red-800 rounded">{error}</p>}
      
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-semibold">Étapes de test recommandées:</h3>
        <ol className="list-decimal list-inside mt-2">
          <li>Cliquer sur "Tester Inscription Vendeur" (pour créer un compte)</li>
          <li>Vérifier les données dans "État actuel"</li>
          <li>Cliquer sur "Tester Déconnexion"</li>
          <li>Cliquer sur "Tester Connexion Vendeur" (pour utiliser le compte)</li>
          <li>Vérifier que les données sont cohérentes</li>
        </ol>
      </div>
      
      {/* Ajouter un affichage des dernières données d'inscription */}
      {registerData && (
        <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
          <h3 className="font-semibold">Dernières données d'inscription générées:</h3>
          <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-auto mt-2">
            {JSON.stringify(registerData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}