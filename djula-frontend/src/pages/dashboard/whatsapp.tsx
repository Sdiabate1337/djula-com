import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import api from '@/src/services/api';
import whatsAppService from '@/src/services/whatsAppService';

export default function WhatsappConnection() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrCodeImage, setQRCodeImage] = useState('');
  const [connected, setConnected] = useState(false);
  const [sellerData, setSellerData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Récupérer les informations du vendeur
    const seller = localStorage.getItem('seller');
    if (seller) {
      const parsedData = JSON.parse(seller);
      setSellerData(parsedData);
      setConnected(parsedData.isWhatsappConnected || false);
    }
    setIsLoading(false);
  }, []);

  const generateQRCode = async () => {
    if (!sellerData || !sellerData.id) {
      setError('Information vendeur non disponible. Veuillez vous reconnecter.');
      return;
    }
    
    try {
      setIsGeneratingQR(true);
      setError('');
      
      const data = await whatsAppService.generateQRCode(sellerData.id);
      
      if (data && data.qrCodeImage) {
        setQRCodeImage(data.qrCodeImage);
        
        // Vérifier périodiquement si le QR code a été scanné
        const checkInterval = setInterval(async () => {
          try {
            const checkData = await whatsAppService.checkWhatsAppStatus(sellerData.id);
            
            if (checkData && checkData.isWhatsappConnected) {
              clearInterval(checkInterval);
              setConnected(true);
              
              // Mettre à jour les données du vendeur dans le localStorage
              const updatedSellerData = { ...sellerData, isWhatsappConnected: true };
              localStorage.setItem('seller', JSON.stringify(updatedSellerData));
            }
          } catch (error) {
            console.error('Erreur lors de la vérification du statut:', error);
          }
        }, 5000);
        
        // Arrêter la vérification après 2 minutes (120000 ms) si le QR n'est pas scanné
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!connected) {
            setQRCodeImage('');
            setError('Le QR code a expiré. Veuillez en générer un nouveau.');
          }
        }, 120000);
      } else {
        setError('Erreur lors de la génération du QR code.');
      }
    } catch (error: any) {
      setError(error.userMessage || 'Erreur lors de la génération du QR code');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!sellerData || !sellerData.id) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Appel à l'API pour déconnecter WhatsApp
      await api.post(`/sellers/${sellerData.id}/disconnect-whatsapp`);
      
      // Mettre à jour l'état local et le localStorage
      setConnected(false);
      const updatedSellerData = { ...sellerData, isWhatsappConnected: false };
      localStorage.setItem('seller', JSON.stringify(updatedSellerData));
      setSellerData(updatedSellerData);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erreur lors de la déconnexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Connexion WhatsApp | Djula Commerce</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>
      
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <i className="fab fa-whatsapp text-green-600 mr-3 text-2xl"></i>
                Connexion WhatsApp
              </h2>
              <p className="text-gray-600 mt-1">Connectez votre compte WhatsApp pour communiquer avec vos clients</p>
            </div>
            
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
              </div>
            ) : connected ? (
              <div className="p-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                    <i className="fas fa-check text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800">WhatsApp connecté</h3>
                  <p className="text-gray-600 mt-2 max-w-md mx-auto">
                    Votre compte WhatsApp est connecté avec succès. Vous pouvez maintenant recevoir des commandes et discuter avec vos clients.
                  </p>
                  
                  <div className="mt-8 bg-gray-50 p-5 rounded-lg max-w-sm mx-auto">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Numéro WhatsApp connecté</h4>
                    <div className="flex items-center justify-center">
                      <i className="fab fa-whatsapp text-green-500 text-xl mr-2"></i>
                      <span className="text-lg font-semibold text-gray-800">
                        {sellerData?.whatsappNumber || 'Numéro non disponible'}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={disconnectWhatsApp}
                    className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition duration-150 ease-in-out"
                  >
                    Déconnecter WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-600 mb-4">
                    <i className="fab fa-whatsapp text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800">WhatsApp non connecté</h3>
                  <p className="text-gray-600 mt-2 max-w-md mx-auto">
                    Connectez votre WhatsApp pour recevoir les commandes et communiquer directement avec vos clients depuis votre numéro habituel.
                  </p>
                  
                  {error && (
                    <div className="mt-4 bg-red-50 text-red-700 p-3 rounded-lg max-w-sm mx-auto">
                      <p className="flex items-center">
                        <i className="fas fa-exclamation-circle mr-2"></i>
                        {error}
                      </p>
                    </div>
                  )}
                  
                  {qrCodeImage ? (
                    <div className="mt-6">
                      <div className="bg-white p-4 rounded-xl shadow-md inline-block">
                        <img 
                          src={qrCodeImage} 
                          alt="QR Code WhatsApp" 
                          className="w-64 h-64 object-cover"
                        />
                      </div>
                      
                      <div className="mt-4 max-w-md mx-auto bg-green-50 p-4 rounded-lg text-green-800 text-sm">
                        <h4 className="font-medium mb-2 flex items-center">
                          <i className="fas fa-info-circle mr-2"></i>
                          Comment connecter WhatsApp
                        </h4>
                        <ol className="list-decimal text-left pl-5 space-y-2">
                          <li>Ouvrez WhatsApp sur votre téléphone</li>
                          <li>Allez dans Paramètres &gt; Appareils liés</li>
                          <li>Tapez sur "Lier un appareil"</li>
                          <li>Scannez le QR code ci-dessus</li>
                        </ol>
                        <p className="mt-2 text-xs text-green-700">
                          Le QR code expirera dans 2 minutes. Si vous ne parvenez pas à le scanner, générez-en un nouveau.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={generateQRCode}
                      disabled={isGeneratingQR}
                      className={`mt-6 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg shadow-sm transition duration-150 ease-in-out flex items-center justify-center mx-auto ${
                        isGeneratingQR ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      {isGeneratingQR ? (
                        <>
                          <div className="animate-spin h-5 w-5 mr-3 border-2 border-white border-t-transparent rounded-full"></div>
                          Génération en cours...
                        </>
                      ) : (
                        <>
                          <i className="fab fa-whatsapp mr-2"></i>
                          Générer un QR code
                        </>
                      )}
                    </button>
                  )}
                  
                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Pourquoi connecter WhatsApp?</h4>
                    <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-green-600 mb-2">
                          <i className="fas fa-comments text-lg"></i>
                        </div>
                        <p className="text-gray-700">Recevez les commandes directement dans votre WhatsApp</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-green-600 mb-2">
                          <i className="fas fa-bell text-lg"></i>
                        </div>
                        <p className="text-gray-700">Notifications instantanées pour chaque nouvelle commande</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-green-600 mb-2">
                          <i className="fas fa-user-friends text-lg"></i>
                        </div>
                        <p className="text-gray-700">Communiquez facilement avec vos clients</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}