import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import useAuth from '@/src/hooks/useAuth';
import productService from '@/src/services/productService';

export default function EditProductPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useAuth('SELLER');
  
  const [productData, setProductData] = useState({
    name: '',
    description: '',
    price: '',
    discountPrice: '',
    category: '',
    quantity: '1',
    status: 'draft'
  });
  
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Catégories disponibles
  const categories = [
    'Vêtements', 'Chaussures', 'Accessoires', 'Électronique', 
    'Maison', 'Beauté', 'Bijoux', 'Alimentation', 'Autres'
  ];
  
  // Charger les données du produit
  useEffect(() => {
    if (id && !loading) {
      // En développement, simuler un produit
      setIsLoading(true);
      
      setTimeout(() => {
        // Produit simulé pour le développement
        const mockProduct = {
          id: id as string,
          name: 'T-shirt Premium',
          description: 'Un t-shirt de qualité supérieure, fait en coton bio. Parfait pour toutes les occasions.',
          price: '15000',
          discountPrice: '12000',
          category: 'Vêtements',
          quantity: '25',
          status: 'active',
          images: [
            'https://source.unsplash.com/random/300x300?tshirt=1',
            'https://source.unsplash.com/random/300x300?tshirt=2'
          ]
        };
        
        setProductData({
          name: mockProduct.name,
          description: mockProduct.description,
          price: mockProduct.price,
          discountPrice: mockProduct.discountPrice,
          category: mockProduct.category,
          quantity: mockProduct.quantity,
          status: mockProduct.status
        });
        
        setExistingImages(mockProduct.images);
        setIsLoading(false);
      }, 800);
    }
  }, [id, loading]);
  
  // Gérer les changements dans le formulaire
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductData({
      ...productData,
      [name]: value
    });
  };
  
  // Gérer l'upload de nouvelles images
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      // Limiter le nombre total d'images à 5
      const totalImagesCount = existingImages.length + newImages.length;
      const remainingSlots = 5 - totalImagesCount;
      
      if (remainingSlots <= 0) {
        setError('Vous ne pouvez pas ajouter plus de 5 images au total');
        return;
      }
      
      const filesToAdd = selectedFiles.slice(0, remainingSlots);
      setNewImages([...newImages, ...filesToAdd]);
      
      // Générer les aperçus
      const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
      setNewImagePreviews([...newImagePreviews, ...newPreviews]);
    }
  };
  
  // Supprimer une image existante
  const removeExistingImage = (index: number) => {
    const newImages = [...existingImages];
    newImages.splice(index, 1);
    setExistingImages(newImages);
  };
  
  // Supprimer une nouvelle image
  const removeNewImage = (index: number) => {
    const updatedImages = [...newImages];
    updatedImages.splice(index, 1);
    setNewImages(updatedImages);
    
    const updatedPreviews = [...newImagePreviews];
    URL.revokeObjectURL(updatedPreviews[index]);
    updatedPreviews.splice(index, 1);
    setNewImagePreviews(updatedPreviews);
  };
  
  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError('');
      setSubmitSuccess(false);
      
      // Valider les données
      if (!productData.name) {
        setError('Le nom du produit est requis');
        setIsSubmitting(false);
        return;
      }
      
      if (!productData.price || isNaN(parseFloat(productData.price))) {
        setError('Le prix doit être un nombre valide');
        setIsSubmitting(false);
        return;
      }
      
      // Simuler une mise à jour réussie
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSubmitSuccess(true);
      
      // Rediriger après 1.5 secondes
      setTimeout(() => {
        router.push({
          pathname: '/dashboard/products',
          query: { 
            success: 'updated', 
            product: productData.name 
          }
        });
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour du produit:', error);
      setError('Une erreur est survenue lors de la mise à jour du produit');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Nettoyer les URLs des aperçus lors du démontage du composant
  useEffect(() => {
    return () => {
      newImagePreviews.forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [newImagePreviews]);
  
  if (isLoading) {
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
      {/* Your existing JSX code here */}
      <Head>
        <title>Modifier le produit | Djula Commerce</title>
      </Head>
      
      <DashboardLayout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Modifier le produit</h1>
          
          <button
            onClick={() => router.push('/dashboard/products')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition"
          >
            Retour
          </button>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {submitSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            Produit mis à jour avec succès! Redirection en cours...
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonne de gauche */}
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={productData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  value={productData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                ></textarea>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                    Prix (FCFA)*
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={productData.price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="discountPrice" className="block text-sm font-medium text-gray-700 mb-1">
                    Prix remisé (FCFA)
                  </label>
                  <input
                    type="number"
                    id="discountPrice"
                    name="discountPrice"
                    value={productData.discountPrice}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Colonne de droite */}
            <div className="space-y-6">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                <select
                  id="category"
                  name="category"
                  value={productData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité en stock
                </label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  value={productData.quantity}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  id="status"
                  name="status"
                  value={productData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="draft">Brouillon</option>
                  <option value="active">Actif</option>
                  <option value="soldout">Épuisé</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Images du produit ({existingImages.length + newImagePreviews.length}/5)
                </label>
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {/* Images existantes */}
                  {existingImages.map((imageUrl, index) => (
                    <div key={`existing-${index}`} className="relative">
                      <img 
                        src={imageUrl} 
                        alt={`Image ${index + 1}`} 
                        className="h-24 w-24 object-cover rounded border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  
                  {/* Nouvelles images */}
                  {newImagePreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative">
                      <img 
                        src={preview} 
                        alt={`Nouvelle image ${index + 1}`} 
                        className="h-24 w-24 object-cover rounded border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  
                  {/* Bouton d'ajout d'image */}
                  {(existingImages.length + newImagePreviews.length < 5) && (
                    <label className="h-24 w-24 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-orange-500 hover:text-orange-500 transition-colors">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 // filepath: /workspaces/djula-com/djula-frontend/src/pages/dashboard/products/edit/[id].tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import useAuth from '@/src/hooks/useAuth';
import productService from '@/src/services/productService';

export default function EditProductPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useAuth('SELLER');
  
  const [productData, setProductData] = useState({
    name: '',
    description: '',
    price: '',
    discountPrice: '',
    category: '',
    quantity: '1',
    status: 'draft'
  });
  
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Catégories disponibles
  const categories = [
    'Vêtements', 'Chaussures', 'Accessoires', 'Électronique', 
    'Maison', 'Beauté', 'Bijoux', 'Alimentation', 'Autres'
  ];
  
  // Charger les données du produit
  useEffect(() => {
    if (id && !loading) {
      // En développement, simuler un produit
      setIsLoading(true);
      
      setTimeout(() => {
        // Produit simulé pour le développement
        const mockProduct = {
          id: id as string,
          name: 'T-shirt Premium',
          description: 'Un t-shirt de qualité supérieure, fait en coton bio. Parfait pour toutes les occasions.',
          price: '15000',
          discountPrice: '12000',
          category: 'Vêtements',
          quantity: '25',
          status: 'active',
          images: [
            'https://source.unsplash.com/random/300x300?tshirt=1',
            'https://source.unsplash.com/random/300x300?tshirt=2'
          ]
        };
        
        setProductData({
          name: mockProduct.name,
          description: mockProduct.description,
          price: mockProduct.price,
          discountPrice: mockProduct.discountPrice,
          category: mockProduct.category,
          quantity: mockProduct.quantity,
          status: mockProduct.status
        });
        
        setExistingImages(mockProduct.images);
        setIsLoading(false);
      }, 800);
    }
  }, [id, loading]);
  
  // Gérer les changements dans le formulaire
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductData({
      ...productData,
      [name]: value
    });
  };
  
  // Gérer l'upload de nouvelles images
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      // Limiter le nombre total d'images à 5
      const totalImagesCount = existingImages.length + newImages.length;
      const remainingSlots = 5 - totalImagesCount;
      
      if (remainingSlots <= 0) {
        setError('Vous ne pouvez pas ajouter plus de 5 images au total');
        return;
      }
      
      const filesToAdd = selectedFiles.slice(0, remainingSlots);
      setNewImages([...newImages, ...filesToAdd]);
      
      // Générer les aperçus
      const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
      setNewImagePreviews([...newImagePreviews, ...newPreviews]);
    }
  };
  
  // Supprimer une image existante
  const removeExistingImage = (index: number) => {
    const newImages = [...existingImages];
    newImages.splice(index, 1);
    setExistingImages(newImages);
  };
  
  // Supprimer une nouvelle image
  const removeNewImage = (index: number) => {
    const updatedImages = [...newImages];
    updatedImages.splice(index, 1);
    setNewImages(updatedImages);
    
    const updatedPreviews = [...newImagePreviews];
    URL.revokeObjectURL(updatedPreviews[index]);
    updatedPreviews.splice(index, 1);
    setNewImagePreviews(updatedPreviews);
  };
  
  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError('');
      setSubmitSuccess(false);
      
      // Valider les données
      if (!productData.name) {
        setError('Le nom du produit est requis');
        setIsSubmitting(false);
        return;
      }
      
      if (!productData.price || isNaN(parseFloat(productData.price))) {
        setError('Le prix doit être un nombre valide');
        setIsSubmitting(false);
        return;
      }
      
      // Simuler une mise à jour réussie
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSubmitSuccess(true);
      
      // Rediriger après 1.5 secondes
      setTimeout(() => {
        router.push({
          pathname: '/dashboard/products',
          query: { 
            success: 'updated', 
            product: productData.name 
          }
        });
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour du produit:', error);
      setError('Une erreur est survenue lors de la mise à jour du produit');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Nettoyer les URLs des aperçus lors du démontage du composant
  useEffect(() => {
    return () => {
      newImagePreviews.forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [newImagePreviews]);
  
  if (isLoading) {
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
        <title>Modifier le produit | Djula Commerce</title>
      </Head>
      
      <DashboardLayout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Modifier le produit</h1>
          
          <button
            onClick={() => router.push('/dashboard/products')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition"
          >
            Retour
          </button>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {submitSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            Produit mis à jour avec succès! Redirection en cours...
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonne de gauche */}
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={productData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  value={productData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                ></textarea>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                    Prix (FCFA)*
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={productData.price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="discountPrice" className="block text-sm font-medium text-gray-700 mb-1">
                    Prix remisé (FCFA)
                  </label>
                  <input
                    type="number"
                    id="discountPrice"
                    name="discountPrice"
                    value={productData.discountPrice}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Colonne de droite */}
            <div className="space-y-6">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                <select
                  id="category"
                  name="category"
                  value={productData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité en stock
                </label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  value={productData.quantity}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  id="status"
                  name="status"
                  value={productData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="draft">Brouillon</option>
                  <option value="active">Actif</option>
                  <option value="soldout">Épuisé</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Images du produit ({existingImages.length + newImagePreviews.length}/5)
                </label>
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {/* Images existantes */}
                  {existingImages.map((imageUrl, index) => (
                    <div key={`existing-${index}`} className="relative">
                      <img 
                        src={imageUrl} 
                        alt={`Image ${index + 1}`} 
                        className="h-24 w-24 object-cover rounded border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  
                  {/* Nouvelles images */}
                  {newImagePreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative">
                      <img 
                        src={preview} 
                        alt={`Nouvelle image ${index + 1}`} 
                        className="h-24 w-24 object-cover rounded border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  
                  {/* Bouton d'ajout d'image */}
                  {(existingImages.length + newImagePreviews.length < 5) && (
                    <label className="h-24 w-24 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-orange-500 hover:text-orange-500 transition-colors">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-6 flex justify-end">
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className={`px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg 
                                ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              {isSubmitting ? 'Mise à jour...' : 'Mettre à jour le produit'}
                            </button>
                          </div>
                        </form>
                      </DashboardLayout>
                    </>
                  );
                }