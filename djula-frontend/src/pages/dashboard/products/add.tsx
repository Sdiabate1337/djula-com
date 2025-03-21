import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import useAuth from '@/src/hooks/useAuth';
import productService from '@/src/services/productService';

export default function AddProductPage() {
  const router = useRouter();
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
  
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  
  // Charger les catégories disponibles
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await productService.getCategories();
        if (Array.isArray(categoriesData)) {
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des catégories', error);
        // Catégories par défaut en cas d'erreur
        setCategories([
          'Vêtements', 'Chaussures', 'Accessoires', 'Électronique',
          'Maison', 'Beauté', 'Bijoux', 'Alimentation', 'Autres'
        ]);
      }
    };
    
    loadCategories();
  }, []);
  
  // Gérer les changements dans le formulaire
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductData({
      ...productData,
      [name]: value
    });
  };
  
  // Gérer l'upload d'images
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      // Limiter à 5 images maximum
      const newImages = [...images, ...selectedFiles].slice(0, 5);
      setImages(newImages);
      
      // Générer les aperçus
      const newPreviews = newImages.map(file => URL.createObjectURL(file));
      setPreviews(newPreviews);
    }
  };
  
  // Supprimer une image
  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
    
    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };
  
  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      setIsSubmitting(true);
      setError('');
      
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
      
      // Créer le produit
      const productPayload = {
        ...productData,
        price: parseFloat(productData.price),
        discountPrice: productData.discountPrice ? parseFloat(productData.discountPrice) : undefined,
        quantity: parseInt(productData.quantity, 10)
      };
      
      // Pour le développement (simuler un délai et une réponse)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const response = await productService.createProduct(user.id, productPayload);
        
        // Uploader les images si le produit a été créé
        if (response && response.id && images.length > 0) {
          // Upload des images une par une
          for (const image of images) {
            await productService.uploadProductImage(response.id, image);
          }
        }
        
        // Rediriger vers la liste des produits
        router.push('/dashboard/products');
      } catch (error) {
        // En mode développement, simuler un succès si l'API échoue
        if (process.env.NODE_ENV === 'development') {
          console.warn('Mode dev: Simulation de création de produit réussie malgré l\'erreur API');
          setTimeout(() => {
            router.push('/dashboard/products');
          }, 1000);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Erreur lors de la création du produit:', error);
      setError('Une erreur est survenue lors de la création du produit');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Nettoyer les URLs des aperçus lors du démontage du composant
  useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [previews]);
  
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
        <title>Ajouter un produit | Djula Commerce</title>
      </Head>
      
      <DashboardLayout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Ajouter un produit</h1>
          
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
                  placeholder="ex: T-shirt en coton bio"
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
                  placeholder="Décrivez votre produit en détail..."
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
                    step="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="ex: 12000"
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
                    step="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="ex: 9999"
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
                  <option value="">Sélectionnez une catégorie</option>
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
                  Images du produit ({previews.length}/5)
                </label>
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={preview} 
                        alt={`Aperçu ${index + 1}`} 
                        className="h-24 w-24 object-cover rounded border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  
                  {previews.length < 5 && (
                    <label className="h-24 w-24 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-orange-500 hover:text-orange-500 transition-colors">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-xs mt-1">Ajouter</span>
                      <input 
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={previews.length >= 5}
                      />
                    </label>
                  )}
                </div>
                
                <p className="text-xs text-gray-500">
                  JPG, PNG ou GIF. 5 images maximum. Taille recommandée: 800x800px.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard/products')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? 'Création en cours...' : 'Créer le produit'}
            </button>
          </div>
        </form>
      </DashboardLayout>
    </>
  );
}