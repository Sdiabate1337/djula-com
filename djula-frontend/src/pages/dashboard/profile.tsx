import { useState, useEffect } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import useAuth from '@/src/hooks/useAuth';

export default function ProfilePage() {
  const { user, loading } = useAuth('SELLER');
  const [profileData, setProfileData] = useState({
    fullName: '',
    whatsappNumber: '',
    email: '',
    shopName: '',
    shopDescription: '',
    shopAddress: '',
    shopLogo: null as File | null,
    shopCoverImage: null as File | null
  });

  const [logoPreview, setLogoPreview] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // Charger les données du profil utilisateur
  useEffect(() => {
    if (user && !loading) {
      setProfileData({
        fullName: user.fullName || '',
        whatsappNumber: user.whatsappNumber || '',
        email: user.email || '',
        shopName: user.shopName || '',
        shopDescription: user.shopDescription || '',
        shopAddress: user.shopAddress || '',
        shopLogo: null,
        shopCoverImage: null
      });
      
      // Si l'utilisateur a déjà des images
      if (user.profileImage) {
        setLogoPreview(user.profileImage);
      }
      if (user.coverImage) {
        setCoverPreview(user.coverImage);
      }
    }
  }, [user, loading]);

  // Gérer les changements de champs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Gérer l'upload du logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileData(prev => ({
        ...prev,
        shopLogo: file
      }));
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Gérer l'upload de l'image de couverture
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileData(prev => ({
        ...prev,
        shopCoverImage: file
      }));
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      // Simuler un délai pour l'API 
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simuler la réponse API
      setSuccessMessage('Votre profil a été mis à jour avec succès!');
      setIsEditMode(false);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      setError('Une erreur est survenue lors de la mise à jour de votre profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Nettoyer les URL des aperçus
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
      if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    };
  }, [logoPreview, coverPreview]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Profil | Djula Commerce</title>
      </Head>

      <DashboardLayout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Mon profil</h1>
          
          {!isEditMode && (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition flex items-center"
            >
              <i className="fas fa-edit mr-2"></i>
              Modifier
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Image de couverture */}
          <div 
            className="h-48 bg-gray-100 bg-cover bg-center relative" 
            style={{ backgroundImage: coverPreview ? `url(${coverPreview})` : 'none' }}
          >
            {isEditMode && (
              <label className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg cursor-pointer hover:bg-opacity-70 transition">
                <i className="fas fa-camera mr-2"></i>
                Changer la couverture
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Logo et nom de la boutique */}
          <div className="px-6 pt-4 pb-6 flex items-end -mt-12">
            <div className="relative">
              <div 
                className="w-24 h-24 bg-white rounded-full border-4 border-white shadow overflow-hidden bg-gray-100 flex items-center justify-center"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-store text-3xl text-gray-400"></i>
                )}
              </div>
              {isEditMode && (
                <label className="absolute bottom-0 right-0 bg-orange-500 text-white p-1 rounded-full cursor-pointer hover:bg-orange-600 transition">
                  <i className="fas fa-camera"></i>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold">{profileData.shopName || 'Votre boutique'}</h2>
              {profileData.whatsappNumber && (
                <p className="text-sm text-gray-500">{profileData.whatsappNumber}</p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100">
            {isEditMode ? (
              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Colonne gauche */}
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nom complet*
                      </label>
                      <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        value={profileData.fullName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Numéro WhatsApp*
                      </label>
                      <input
                        type="tel"
                        id="whatsappNumber"
                        name="whatsappNumber"
                        value={profileData.whatsappNumber}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  
                  {/* Colonne droite */}
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nom de la boutique*
                      </label>
                      <input
                        type="text"
                        id="shopName"
                        name="shopName"
                        value={profileData.shopName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="shopAddress" className="block text-sm font-medium text-gray-700 mb-1">
                        Adresse de la boutique
                      </label>
                      <input
                        type="text"
                        id="shopAddress"
                        name="shopAddress"
                        value={profileData.shopAddress}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="shopDescription" className="block text-sm font-medium text-gray-700 mb-1">
                        Description de la boutique
                      </label>
                      <textarea
                        id="shopDescription"
                        name="shopDescription"
                        rows={3}
                        value={profileData.shopDescription}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Décrivez votre boutique en quelques mots..."
                      ></textarea>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Mode visualisation */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Nom complet</h3>
                      <p className="mt-1">{profileData.fullName}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Numéro WhatsApp</h3>
                      <p className="mt-1">{profileData.whatsappNumber}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Email</h3>
                      <p className="mt-1">{profileData.email || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Nom de la boutique</h3>
                      <p className="mt-1">{profileData.shopName}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Adresse de la boutique</h3>
                      <p className="mt-1">{profileData.shopAddress || '-'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Description de la boutique</h3>
                      <p className="mt-1">{profileData.shopDescription || '-'}</p>
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