import callApi from './api';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  images: string[];
  category: string;
  status: 'active' | 'draft' | 'soldout';
  quantity: number;
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  options: string[];
  price?: number;
}

export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  category: string;
  quantity: number;
  status?: 'active' | 'draft';
  variants?: Omit<ProductVariant, 'id'>[];
}

const productService = {
  /**
   * Récupère la liste des produits d'un vendeur
   */
  async getProducts(sellerId: string, page = 1, limit = 10, filters = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters
      });
      
      return await callApi(`api/sellers/${sellerId}/products?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des produits:', error);
      throw error;
    }
  },

  /**
   * Récupère les détails d'un produit
   */
  async getProduct(productId: string) {
    try {
      return await callApi(`api/products/${productId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération du produit:', error);
      throw error;
    }
  },

  /**
   * Crée un nouveau produit
   */
  async createProduct(sellerId: string, productData: CreateProductData) {
    try {
      return await callApi(`api/sellers/${sellerId}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      });
    } catch (error) {
      console.error('Erreur lors de la création du produit:', error);
      throw error;
    }
  },

  /**
   * Met à jour un produit existant
   */
  async updateProduct(productId: string, productData: Partial<CreateProductData>) {
    try {
      return await callApi(`api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du produit:', error);
      throw error;
    }
  },

  /**
   * Supprime un produit
   */
  async deleteProduct(productId: string) {
    try {
      return await callApi(`api/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du produit:', error);
      throw error;
    }
  },

  /**
   * Télécharge une image pour un produit
   */
  async uploadProductImage(productId: string, imageFile: File) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      // Utiliser directement fetch pour les upload de fichiers
      const response = await fetch(`/api/proxy/api/products/${productId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors du téléchargement de l\'image');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du téléchargement de l\'image:', error);
      throw error;
    }
  }
};

export default productService;