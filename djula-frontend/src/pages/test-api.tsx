// pages/test-api.tsx
import { useState, useEffect } from 'react';
import authService from '@/src/services/authService';
import whatsAppService from '@/src/services/whatsAppService';
import dashboardService from '@/src/services/dashboardService';

export default function TestApi() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fonction pour ajouter un résultat au tableau
  const addResult = (name: string, success: boolean, data?: any, error?: any) => {
    setResults(prev => [...prev, {
      name,
      success,
      data: data ? JSON.stringify(data, null, 2) : undefined,
      error: error ? error.message || JSON.stringify(error) : undefined,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  // Fonction de test pour l'authentification
  const testAuth = async () => {
    try {
      setLoading(true);
      addResult('Début des tests', true);

      // Test login vendeur (utiliser des identifiants valides)
      try {
        const loginData = await authService.loginSeller({
          fullName: 'John Doe',
          whatsappNumber: '+225071234567'
        });
        addResult('Login Vendeur', true, loginData);
      } catch (error) {
        addResult('Login Vendeur', false, undefined, error);
      }

      // Vérifier si l'utilisateur est authentifié
      const isAuth = authService.isAuthenticated();
      addResult('Vérification Auth', isAuth);

      // Récupérer les données utilisateur
      const userData = authService.getUserData();
      addResult('Données Utilisateur', !!userData, userData);
    } catch (error) {
      addResult('Erreur Globale', false, undefined, error);
    } finally {
      setLoading(false);
    }
  };

  // Test des fonctionnalités spécifiques
  const testFeatures = async () => {
    try {
      setLoading(true);
      const userData = authService.getUserData();

      if (!userData || !userData.id) {
        addResult('Test Fonctionnalités', false, undefined, 'Utilisateur non authentifié');
        return;
      }

      // Test QR Code WhatsApp
      try {
        const qrData = await whatsAppService.generateQRCode(userData.id);
        addResult('Génération QR Code', true, qrData);
      } catch (error) {
        addResult('Génération QR Code', false, undefined, error);
      }

      // Test Statistiques Dashboard
      try {
        const stats = await dashboardService.getSellerStats(userData.id);
        addResult('Statistiques Dashboard', true, stats);
      } catch (error) {
        addResult('Statistiques Dashboard', false, undefined, error);
      }
    } catch (error) {
      addResult('Erreur Tests Fonctionnalités', false, undefined, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Test de l'intégration API</h1>
      
      <div className="flex space-x-4 mb-8">
        <button 
          onClick={testAuth}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          Tester Authentification
        </button>
        
        <button 
          onClick={testFeatures}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
        >
          Tester Fonctionnalités
        </button>

        <button 
          onClick={() => authService.logout()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg"
        >
          Déconnexion
        </button>
      </div>

      {loading && (
        <div className="mb-4 text-amber-600">
          Tests en cours...
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Test</th>
              <th className="p-2 text-left">Statut</th>
              <th className="p-2 text-left">Heure</th>
              <th className="p-2 text-left">Détails</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index} className="border-t">
                <td className="p-2">{result.name}</td>
                <td className="p-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {result.success ? 'Succès' : 'Échec'}
                  </span>
                </td>
                <td className="p-2 text-sm text-gray-600">{result.timestamp}</td>
                <td className="p-2">
                  {result.data && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600">Données</summary>
                      <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto max-h-40">{result.data}</pre>
                    </details>
                  )}
                  {result.error && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-red-600">Erreur</summary>
                      <pre className="mt-2 bg-red-50 p-2 rounded overflow-auto max-h-40">{result.error}</pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  Aucun test exécuté
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}