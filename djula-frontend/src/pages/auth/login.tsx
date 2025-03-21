import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import authService, { LoginSellerData, LoginAdminData } from '@/src/services/authService';

// Enum pour différencier les types d'utilisateurs
enum UserType {
  SELLER = 'SELLER',
  ADMIN = 'ADMIN'
}

export default function Login() {
  // État pour le formulaire
  const [userType, setUserType] = useState<UserType>(UserType.SELLER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animate, setAnimate] = useState(false);
  const router = useRouter();

  // Animation au chargement
  useEffect(() => {
    setAnimate(true);
  }, []);

  // Styles
  const orangeGradient = {
    background: 'linear-gradient(135deg, #FF8A2B, #FF6B00)'
  };

  const whatsappBgStyle = {
    background: 'linear-gradient(to right bottom, #075E54, #128C7E)'
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (userType === UserType.ADMIN) {
        const data: LoginAdminData = { email, password };
        await authService.loginAdmin(data);
        router.push('/admin/dashboard');
      } else {
        const data: LoginSellerData = { fullName, whatsappNumber };
        await authService.loginSeller(data);
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      setError(error.userMessage || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Connexion | Djula Commerce</title>
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
              Plateforme de commerce pour l'Afrique via WhatsApp
            </p>
            
            {/* Illustration WhatsApp Commerce */}
            <div className="relative h-60 mb-12">
              <div className="absolute bg-white/20 backdrop-blur-lg rounded-2xl p-5 shadow-xl w-72 transform -rotate-2 left-4 top-4 border border-white/30">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <i className="fas fa-shopping-bag text-white"></i>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-bold text-white">WhatsApp Store</h3>
                    <p className="text-xs text-white/70">En ligne</p>
                  </div>
                </div>
                <div className="mt-4 bg-white/10 p-3 rounded-lg text-white text-sm">
                  <p>👋 Bienvenue! Comment puis-je vous aider aujourd'hui?</p>
                </div>
                <div className="mt-2 bg-white/10 p-3 rounded-lg text-white text-sm">
                  <p>Découvrez nos nouveaux produits! Tapez "catalogue" pour voir.</p>
                </div>
                <div className="mt-6 flex">
                  <div className="bg-white/10 px-3 py-1 rounded-full text-xs text-white mr-2">Catalogue</div>
                  <div className="bg-white/10 px-3 py-1 rounded-full text-xs text-white mr-2">Commander</div>
                  <div className="bg-white/10 px-3 py-1 rounded-full text-xs text-white">Aide</div>
                </div>
              </div>
            </div>

            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/10 transform transition-all hover:scale-105 hover:shadow-lg">
              <div className="flex items-center mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 mr-4">
                  <i className="fas fa-star text-white"></i>
                </div>
                <p className="text-white text-lg font-medium">Vendez directement via WhatsApp</p>
              </div>
              <p className="text-white/80 pl-14">
                Connectez votre numéro WhatsApp et commencez à vendre maintenant.
                Gérez vos commandes, suivez vos ventes et développez votre business.
              </p>
            </div>
          </div>
          
          {/* Formes décoratives */}
          <div className="absolute -bottom-32 -left-40 w-80 h-80 rounded-full bg-teal-600 opacity-30"></div>
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-teal-600 opacity-20"></div>
          
          <div className="absolute bottom-10 right-10 text-white/70 text-sm">
            © 2025 Djula Commerce. Tous droits réservés.
          </div>
        </div>
        
        {/* Formulaire de connexion */}
        <div className={`w-full lg:w-1/2 flex items-center justify-center px-6 py-12 transition-opacity duration-1000 ${animate ? 'opacity-100' : 'opacity-0'}`}>
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
              <h2 className="text-2xl font-bold text-gray-800">Bienvenue!</h2>
              <p className="text-gray-600 mt-2">Connectez-vous pour accéder à votre espace</p>
            </div>

            {/* Sélecteur de type d'utilisateur */}
            <div className="bg-gray-100 p-1 rounded-lg flex mb-8">
              <button
                className={`flex-1 py-2 px-4 rounded-md text-center transition ${userType === UserType.SELLER ? 'bg-white shadow' : 'text-gray-600'}`}
                onClick={() => setUserType(UserType.SELLER)}
              >
                Vendeur
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-md text-center transition ${userType === UserType.ADMIN ? 'bg-white shadow' : 'text-gray-600'}`}
                onClick={() => setUserType(UserType.ADMIN)}
              >
                Administrateur
              </button>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-center animate-shake">
                <i className="fas fa-exclamation-circle mr-3 text-xl"></i>
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-6">
              {userType === UserType.ADMIN ? (
                <>
                  {/* Formulaire Admin */}
                  <div className="group relative transition-all duration-300 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:shadow-md rounded-xl">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500">
                      <i className="fas fa-envelope"></i>
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 group-focus-within:border-orange-500 focus:outline-none transition-all"
                      placeholder="Email administrateur"
                    />
                  </div>
                  
                  <div className="group relative transition-all duration-300 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:shadow-md rounded-xl">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500">
                      <i className="fas fa-lock"></i>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 rounded-xl border border-gray-300 group-focus-within:border-orange-500 focus:outline-none transition-all"
                      placeholder="Mot de passe"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Formulaire Vendeur */}
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
                      placeholder="Nom complet"
                    />
                  </div>
                  
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
                      placeholder="Numéro WhatsApp"
                    />
                  </div>
                </>
              )}
              
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input type="checkbox" className="rounded text-orange-500 focus:ring-orange-500" />
                  <span className="ml-2 text-sm text-gray-600">Se souvenir de moi</span>
                </label>
                <a 
                  href="#" 
                  style={{color: '#FF8A2B'}}
                  className="text-sm hover:text-orange-700 hover:underline transition-colors"
                >
                  Mot de passe oublié?
                </a>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                style={orangeGradient}
                className={`w-full py-4 px-6 text-white font-medium rounded-xl shadow-lg transition transform hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connexion en cours...
                  </div>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <i className="fas fa-arrow-right ml-2"></i>
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Nouveau sur Djula? {' '}
                <a 
                  href="/auth/register" 
                  style={{color: '#FF8A2B'}}
                  className="font-medium hover:text-orange-700 hover:underline"
                >
                  Créer un compte
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
        
        /* Ajout d'une transition sur les champs pour l'effet d'élévation au focus */
        input {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        input:focus {
          transform: translateY(-1px);
        }
      `}</style>
    </>
  );
}