import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  useEffect(() => {
    setCurrentPath(router.pathname);
    
    // Récupérer les informations du vendeur depuis le localStorage
    const sellerData = localStorage.getItem('seller');
    if (sellerData) {
      const seller = JSON.parse(sellerData);
      setSellerName(seller.fullName || '');
      setBrandName(seller.brandName || '');
    } else {
      // Rediriger si non connecté
      router.push('/auth/login');
    }
  }, [router]);
  
  const handleLogout = () => {
    localStorage.removeItem('seller');
    localStorage.removeItem('userType');
    router.push('/auth/login');
  };

  // Style pour orange gradient
  const orangeGradient = {
    background: 'linear-gradient(135deg, #FF8A2B, #FF6B00)'
  };
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 bg-white border-r border-gray-200 shadow-md lg:static lg:block`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-5 border-b border-gray-200">
            <div className="h-10 w-10 rounded-lg mr-3" style={orangeGradient}>
              <div className="flex items-center justify-center h-full text-white">
                <i className="fas fa-comments"></i>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Djula Commerce</h1>
              <p className="text-xs text-gray-500">Plateforme vendeur</p>
            </div>
          </div>
          
          {/* Menu */}
          <nav className="flex-1 px-4 py-5 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <Link href="/dashboard" legacyBehavior>
                  <a className={`flex items-center px-4 py-3 rounded-lg ${currentPath === '/dashboard' ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <i className={`fas fa-chart-line mr-3 ${currentPath === '/dashboard' ? 'text-orange-500' : 'text-gray-400'}`}></i>
                    <span>Tableau de bord</span>
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/dashboard/products" legacyBehavior>
                  <a className={`flex items-center px-4 py-3 rounded-lg ${currentPath.includes('/dashboard/products') ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <i className={`fas fa-box mr-3 ${currentPath.includes('/dashboard/products') ? 'text-orange-500' : 'text-gray-400'}`}></i>
                    <span>Produits</span>
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/dashboard/orders" legacyBehavior>
                  <a className={`flex items-center px-4 py-3 rounded-lg ${currentPath.includes('/dashboard/orders') ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <i className={`fas fa-shopping-cart mr-3 ${currentPath.includes('/dashboard/orders') ? 'text-orange-500' : 'text-gray-400'}`}></i>
                    <span>Commandes</span>
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/dashboard/customers" legacyBehavior>
                  <a className={`flex items-center px-4 py-3 rounded-lg ${currentPath.includes('/dashboard/customers') ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <i className={`fas fa-users mr-3 ${currentPath.includes('/dashboard/customers') ? 'text-orange-500' : 'text-gray-400'}`}></i>
                    <span>Clients</span>
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/dashboard/whatsapp" legacyBehavior>
                  <a className={`flex items-center px-4 py-3 rounded-lg ${currentPath.includes('/dashboard/whatsapp') ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <i className={`fab fa-whatsapp mr-3 ${currentPath.includes('/dashboard/whatsapp') ? 'text-orange-500' : 'text-gray-400'}`}></i>
                    <span>WhatsApp</span>
                  </a>
                </Link>
              </li>
            </ul>
            
            <div className="mt-8">
              <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Paramètres
              </h3>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link href="/dashboard/profile" legacyBehavior>
                    <a className={`flex items-center px-4 py-3 rounded-lg ${currentPath.includes('/dashboard/profile') ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <i className={`fas fa-user-circle mr-3 ${currentPath.includes('/dashboard/profile') ? 'text-orange-500' : 'text-gray-400'}`}></i>
                      <span>Profil</span>
                    </a>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/settings" legacyBehavior>
                    <a className={`flex items-center px-4 py-3 rounded-lg ${currentPath.includes('/dashboard/settings') ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <i className={`fas fa-cog mr-3 ${currentPath.includes('/dashboard/settings') ? 'text-orange-500' : 'text-gray-400'}`}></i>
                      <span>Paramètres</span>
                    </a>
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
          
          {/* Profil utilisateur */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-500">
                {sellerName.charAt(0)}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-700">{sellerName}</p>
                <p className="text-xs text-gray-500">{brandName}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 lg:px-8">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="block lg:hidden text-gray-600 focus:outline-none"
          >
            <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{getPageTitle(currentPath)}</h1>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none">
              <i className="fas fa-bell"></i>
              <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
            <button className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none">
              <i className="fas fa-comments"></i>
              <span className="absolute top-0 right-0 h-2 w-2 bg-green-500 rounded-full"></span>
            </button>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 lg:p-8">
          {children}
        </main>
      </div>
      
      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}
    </div>
  );
}

// Fonction utilitaire pour déterminer le titre de la page
function getPageTitle(path: string): string {
  if (path === '/dashboard') return 'Tableau de bord';
  if (path.includes('/dashboard/products')) return 'Gestion des produits';
  if (path.includes('/dashboard/orders')) return 'Commandes';
  if (path.includes('/dashboard/customers')) return 'Clients';
  if (path.includes('/dashboard/whatsapp')) return 'Connexion WhatsApp';
  if (path.includes('/dashboard/profile')) return 'Profil';
  if (path.includes('/dashboard/settings')) return 'Paramètres';
  return 'Djula Commerce';
}