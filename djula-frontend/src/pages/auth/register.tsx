import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import api from '@/src/services/api';
import authService from '@/src/services/authService';
  

enum BusinessType {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
  SERVICES = 'SERVICES',
  FOOD = 'FOOD',
  FASHION = 'FASHION',
  ELECTRONICS = 'ELECTRONICS',
  OTHER = 'OTHER'
}

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [city, setCity] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>(BusinessType.RETAIL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animate, setAnimate] = useState(false);
  const router = useRouter();

  // Animations au chargement de la page
  useEffect(() => {
    setAnimate(true);
  }, []);

  // Validation du numéro WhatsApp
  const validateWhatsAppNumber = (number: string) => {
    // Format: code pays + numéro (ex: +2250101234567)
    const regex = /^\+\d{1,3}\d{9,12}$/;
    return regex.test(number);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // À ajouter dans handleRegister
    if (!validateWhatsAppNumber(whatsappNumber)) {
      setError('Format de numéro WhatsApp invalide');
      setLoading(false);
      return;
    }

    try {
      authService.registerSeller({
        fullName,
        brandName,
        whatsappNumber,
        city,
        businessType: businessType.toLowerCase()
      });
      
      // Redirection vers le dashboard en cas de succès
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Erreur lors de l\'inscription:', err);
      setError(err.message || 'Une erreur s\'est produite lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  // Styles
  const orangeGradient = {
    background: 'linear-gradient(135deg, #FF8A2B, #FF6B00)'
  };

  const whatsappBgStyle = {
    background: 'linear-gradient(to right bottom, #075E54, #128C7E)'
  };

  return (
    <>
      <Head>
        <title>Inscription | Djula Commerce</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>
      <div className="flex min-h-screen relative bg-gray-50 overflow-hidden">
        {/* Formes flottantes d'arrière-plan */}
        <div className="absolute w-24 h-24 rounded-full bg-orange-500 opacity-10 -left-6 top-20 animate-pulse"></div>
        <div className="absolute w-32 h-32 rounded-full bg-teal-500 opacity-10 right-10 top-40 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute w-40 h-40 rounded-full bg-orange-400 opacity-10 left-1/4 bottom-10 animate-pulse" style={{animationDelay: '1.5s'}}></div>
        
        {/* Bannière latérale */}
        <div 
          className={`hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden transition-transform duration-700 ${animate ? 'translate-x-0' : '-translate-x-full'}`} 
          style={whatsappBgStyle}
        >
          <div className="relative z-10">
            <div className="flex items-center mb-6">
              <div className="h-12 w-12 rounded-lg mr-4" style={orangeGradient}>
                <div className="flex items-center justify-center h-full text-white">
                  <i className="fas fa-comments text-xl"></i>
                </div>
              </div>
              <h1 className="text-4xl font-bold text-white">Djula Commerce</h1>
            </div>
            
            <p className="text-white text-opacity-80 text-xl mb-12 max-w-md">
              Rejoignez la plateforme de commerce via WhatsApp leader en Afrique
            </p>
            
            <div className="space-y-6">
              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/10">
                <div className="flex items-center mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 mr-4">
                    <i className="fas fa-store text-white"></i>
                  </div>
                  <p className="text-white text-lg font-medium">Créez votre boutique en ligne</p>
                </div>
                <p className="text-white/80 pl-14">
                  Ajoutez vos produits et partagez-les facilement avec vos clients via WhatsApp.
                </p>
              </div>
              
              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/10">
                <div className="flex items-center mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 mr-4">
                    <i className="fas fa-chart-line text-white"></i>
                  </div>
                  <p className="text-white text-lg font-medium">Suivez vos performances</p>
                </div>
                <p className="text-white/80 pl-14">
                  Accédez à des statistiques détaillées sur vos ventes et vos clients.
                </p>
              </div>
            </div>
          </div>
          
          {/* Formes décoratives */}
          <div className="absolute -bottom-32 -left-40 w-80 h-80 rounded-full bg-teal-600 opacity-30"></div>
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-teal-600 opacity-20"></div>
          
          <div className="absolute bottom-10 right-10 text-white/70 text-sm">
            © 2025 Djula Commerce. Tous droits réservés.
          </div>
        </div>
        
        {/* Formulaire d'inscription */}
        <div className={`w-full lg:w-1/2 flex items-center justify-center px-6 py-8 transition-opacity duration-1000 ${animate ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="lg:hidden mb-8 flex flex-col items-center">
                <div className="h-16 w-16 rounded-2xl mb-4" style={orangeGradient}>
                  <div className="flex items-center justify-center h-full text-white">
                    <i className="fas fa-comments text-2xl"></i>
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-800">Djula Commerce</h1>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Créez votre compte vendeur</h2>
              <p className="text-gray-600 mt-2">Commencez à vendre via WhatsApp en quelques minutes</p>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-center animate-shake">
                <i className="fas fa-exclamation-circle mr-3 text-xl"></i>
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <div className="group relative transition-all duration-300 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:shadow-md rounded-xl">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500">
                    <i className="fas fa-user"></i>
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 group-focus-within:border-orange-500 focus:outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="brandName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de votre boutique <span className="text-red-500">*</span>
                </label>
                <div className="group relative transition-all duration-300 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:shadow-md rounded-xl">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500">
                    <i className="fas fa-store"></i>
                  </div>
                  <input
                    id="brandName"
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 group-focus-within:border-orange-500 focus:outline-none transition-all"
                    placeholder="Ma Boutique"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro WhatsApp <span className="text-red-500">*</span>
                </label>
                <div className="group relative transition-all duration-300 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:shadow-md rounded-xl">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500">
                    <i className="fab fa-whatsapp"></i>
                  </div>
                  <input
                    id="whatsappNumber"
                    type="tel"
                    required
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 group-focus-within:border-orange-500 focus:outline-none transition-all"
                    placeholder="+2250101234567"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Format: code pays + numéro (ex: +2250101234567)</p>
              </div>
              
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  Ville <span className="text-red-500">*</span>
                </label>
                <div className="group relative transition-all duration-300 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:shadow-md rounded-xl">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500">
                    <i className="fas fa-map-marker-alt"></i>
                  </div>
                  <input
                    id="city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 group-focus-within:border-orange-500 focus:outline-none transition-all"
                    placeholder="Abidjan"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="businessType" className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'activité
                </label>
                <div className="group relative transition-all duration-300 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:shadow-md rounded-xl">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500">
                    <i className="fas fa-briefcase"></i>
                  </div>
                  <select
                    id="businessType"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 group-focus-within:border-orange-500 focus:outline-none transition-all appearance-none"
                  >
                    <option value={BusinessType.RETAIL}>Commerce de détail</option>
                    <option value={BusinessType.WHOLESALE}>Commerce de gros</option>
                    <option value={BusinessType.SERVICES}>Services</option>
                    <option value={BusinessType.FOOD}>Restauration</option>
                    <option value={BusinessType.FASHION}>Mode et vêtements</option>
                    <option value={BusinessType.ELECTRONICS}>Électronique</option>
                    <option value={BusinessType.OTHER}>Autre</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <i className="fas fa-chevron-down"></i>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={orangeGradient}
                className={`w-full py-4 px-6 text-white font-medium rounded-xl shadow-lg transition transform hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 mt-6 flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Inscription en cours...
                  </div>
                ) : (
                  <>
                    <span>Créer mon compte</span>
                    <i className="fas fa-arrow-right ml-2"></i>
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Déjà inscrit? {' '}
                <a 
                  href="/auth/login" 
                  style={{color: '#FF8A2B'}}
                  className="font-medium hover:text-orange-700 hover:underline"
                >
                  Se connecter
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Styles additionnels pour les animations */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </>
  );
}