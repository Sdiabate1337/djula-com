import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';

export interface ProductQuery {
  term?: string;
  category?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  search?: string;
  limit?: number;
  offset?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  stock: number;
  metadata: Record<string, any>;
  imageUrl?: string; // For WhatsApp display
  sellerId: string;  // Ajout nécessaire pour la vérification de propriété
}

export class ProductService {
  private supabase: SupabaseClient;
  private logger: Logger;
  
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Les variables d\'environnement Supabase sont manquantes');
    }
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    this.logger = new Logger('ProductService');
  }

  /**
   * Search products based on criteria
   */
  async searchProducts(query: ProductQuery): Promise<Product[]> {
    try {
      let dbQuery = this.supabase
        .from('products')
        .select('*');

      if (query.category) {
        dbQuery = dbQuery.eq('category', query.category);
      }

      if (query.priceRange) {
        dbQuery = dbQuery
          .gte('price', query.priceRange.min)
          .lte('price', query.priceRange.max);
      }

      // Search by term or search parameter
      const searchTerm = query.term || query.search;
      if (searchTerm) {
        // Use text search if vector search is available, otherwise use LIKE
        if (this.hasVectorSearch()) {
          dbQuery = dbQuery.textSearch('name_description_vector', searchTerm);
        } else {
          dbQuery = dbQuery.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }
      }

      const { data, error } = await dbQuery
        .limit(query.limit || 10)
        .range(query.offset || 0, (query.offset || 0) + (query.limit || 10) - 1);

      if (error) throw error;
      
      // Process products for WhatsApp display
      return this.processProductsForDisplay(data);
    } catch (error) {
      this.logger.error('Error searching products:', error);
      return [];
    }
  }

  /**
   * Get a single product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;
      
      return this.processProductForDisplay(data);
    } catch (error) {
      this.logger.error(`Error getting product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Get similar products based on a product ID
   */
  async getSimilarProducts(productId: string): Promise<Product[]> {
    try {
      const product = await this.getProduct(productId);
      
      if (!product) {
        return [];
      }
      
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('category', product.category)
        .neq('id', productId)
        .limit(5);

      if (error) throw error;
      
      return this.processProductsForDisplay(data);
    } catch (error) {
      this.logger.error(`Error getting similar products for ${productId}:`, error);
      return [];
    }
  }

  /**
   * Get recommended products for a customer
   * This was missing proper implementation and causing TypeScript errors
   */
  async getRecommendedProducts(customerId: string, limit: number = 5): Promise<Product[]> {
    try {
      // Get customer data to inform recommendations
      const customerData = await this.getCustomerData(customerId);
      
      // Build signals from customer data
      const signals = {
        categories: customerData.preferredCategories || [],
        priceRange: customerData.priceRange,
        recentViews: customerData.recentViews || [],
        searchTerms: customerData.searchTerms || [],
        currentIntent: customerData.currentIntent || {}
      };
      
      // Use the existing getRecommendations method with appropriate signals
      return await this.getRecommendations(signals, limit);
    } catch (error) {
      this.logger.error(`Error getting recommended products for ${customerId}:`, error);
      // Return empty array instead of throwing
      return [];
    }
  }
  
  /**
   * Get recommendations based on specific signals
   */
  async getRecommendations(
    signals: {
      categories: string[];
      priceRange?: { min: number; max: number };
      recentViews: string[];
      searchTerms: string[];
      currentIntent: Record<string, any>;
    },
    limit: number = 5
  ): Promise<Product[]> {
    try {
      let query = this.supabase
        .from('products')
        .select('*');

      // Category filter (if provided)
      if (signals.categories && signals.categories.length > 0) {
        query = query.in('category', signals.categories);
      }

      // Price range filter (if provided)
      if (signals.priceRange) {
        query = query
          .gte('price', signals.priceRange.min)
          .lte('price', signals.priceRange.max);
      }

      // Get more products than needed for scoring
      const { data: products, error } = await query.limit(Math.max(20, limit * 2));

      if (error) throw error;
      if (!products || products.length === 0) {
        // Fall back to most popular products
        return this.getMostPopularProducts(limit);
      }

      // Score and sort products
      const scoredProducts = products.map(product => ({
        ...product,
        score: this.calculateRelevanceScore(product, signals)
      }));

      // Return top scoring products up to the limit
      const recommendedProducts = scoredProducts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
        
      return this.processProductsForDisplay(recommendedProducts);
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Get most popular products (fallback for recommendations)
   */
  private async getMostPopularProducts(limit: number = 5): Promise<Product[]> {
    try {
      // Using a hypothetical popularity field or view count
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .order('views', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return this.processProductsForDisplay(data || []);
    } catch (error) {
      // If this fails, just get any products
      const { data } = await this.supabase
        .from('products')
        .select('*')
        .limit(limit);
        
      return this.processProductsForDisplay(data || []);
    }
  }

  /**
   * Calculate relevance score for product recommendations
   */
  private calculateRelevanceScore(product: Product, signals: any): number {
    let score = 0;

    // Category match
    if (signals.categories.includes(product.category)) {
      score += 0.3;
    }

    // Price range match
    if (signals.priceRange &&
        product.price >= signals.priceRange.min &&
        product.price <= signals.priceRange.max) {
      score += 0.2;
    }

    // Recent views
    if (signals.recentViews.includes(product.id)) {
      score += 0.1;
    }

    // Search term relevance
    const productText = `${product.name} ${product.description}`.toLowerCase();
    const searchMatch = signals.searchTerms.some((term: string) =>
      productText.includes(term.toLowerCase())
    );
    if (searchMatch) score += 0.2;
    
    // Adjust score based on stock
    if (product.stock <= 0) {
      score *= 0.5; // Penalize out-of-stock items
    }

    return Math.min(score, 1);
  }

  /**
   * Validate order items and calculate prices
   */
  async validateAndPriceOrder(items: Array<{
    productId: string;
    quantity: number;
  }>): Promise<{
    valid: boolean;
    total: number;
    shipping: number;
    items?: Array<{
      product: Product;
      quantity: number;
      subtotal: number;
    }>;
    errors?: string[];
  }> {
    try {
      const errors: string[] = [];
      let total = 0;
      let shipping = 0;
      const validatedItems = [];

      // Validate and calculate for each item
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        
        if (!product) {
          errors.push(`Produit non trouvé: ${item.productId}`);
          continue;
        }

        if (product.stock < item.quantity) {
          errors.push(`Stock insuffisant pour ${product.name}: ${product.stock} disponible(s)`);
          continue;
        }

        const subtotal = product.price * item.quantity;
        total += subtotal;
        
        validatedItems.push({
          product,
          quantity: item.quantity,
          subtotal
        });
      }

      // Calculate shipping
      shipping = this.calculateShipping(total, items.length);

      return {
        valid: errors.length === 0,
        total,
        shipping,
        items: validatedItems,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      this.logger.error('Error validating order:', error);
      return {
        valid: false,
        total: 0,
        shipping: 0,
        errors: ['Erreur système lors de la validation de la commande']
      };
    }
  }

  /**
   * Calculate shipping costs
   */
  private calculateShipping(total: number, itemCount: number): number {
    // Basic shipping calculation
    let shipping = 1000; // Base shipping in CFA
    
    if (itemCount > 1) {
      shipping += (itemCount - 1) * 500; // Additional items
    }
    
    if (total > 50000) {
      shipping = 0; // Free shipping for orders over 50,000 CFA
    }
    
    return shipping;
  }
  
  /**
   * Get customer data for personalization
   */
  private async getCustomerData(customerId: string): Promise<{
    preferredCategories: string[];
    priceRange?: { min: number; max: number };
    recentViews: string[];
    searchTerms: string[];
    currentIntent: Record<string, any>;
  }> {
    try {
      // Fetch customer preferences
      const { data: preferences } = await this.supabase
        .from('customer_preferences')
        .select('*')
        .eq('customer_id', customerId)
        .single();
      
      // Fetch recent product views
      const { data: views } = await this.supabase
        .from('product_views')
        .select('product_id')
        .eq('customer_id', customerId)
        .order('viewed_at', { ascending: false })
        .limit(10);
        
      // Fetch recent searches
      const { data: searches } = await this.supabase
        .from('customer_searches')
        .select('term')
        .eq('customer_id', customerId)
        .order('searched_at', { ascending: false })
        .limit(5);
      
      // Process results
      return {
        preferredCategories: preferences?.preferred_categories || [],
        priceRange: preferences?.price_range,
        recentViews: views?.map(v => v.product_id) || [],
        searchTerms: searches?.map(s => s.term) || [],
        currentIntent: {}
      };
    } catch (error) {
      this.logger.warn(`Error getting customer data for ${customerId}:`, error);
      return {
        preferredCategories: [],
        recentViews: [],
        searchTerms: [],
        currentIntent: {}
      };
    }
  }
  
  /**
   * Process products for WhatsApp display
   */
  private processProductsForDisplay(products: Product[]): Product[] {
    return products.map(p => this.processProductForDisplay(p));
  }
  
  /**
   * Process a single product for WhatsApp display
   */
  private processProductForDisplay(product: any): Product {
    // Convertir snake_case en camelCase et ajouter imageUrl
    const processedProduct = {
      ...product,
      sellerId: product.seller_id, // Ajouter le champ sellerId
      imageUrl: (!product.imageUrl && product.images && product.images.length > 0) 
        ? product.images[0] 
        : product.imageUrl
    };
    
    return processedProduct;
  }
  
  /**
   * Check if Supabase instance has vector search capability
   */
  private hasVectorSearch(): boolean {
    try {
      // This is a placeholder - you'd need to implement a proper check
      // based on your Supabase configuration
      return process.env.ENABLE_VECTOR_SEARCH === 'true';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Record a product view
   */
  async recordProductView(customerId: string, productId: string): Promise<void> {
    try {
      await this.supabase
        .from('product_views')
        .insert({
          customer_id: customerId,
          product_id: productId,
          viewed_at: new Date().toISOString()
        });
    } catch (error) {
      this.logger.warn(`Error recording product view: ${customerId} / ${productId}`, error);
      // Non-critical error, just log
    }
  }

  /**
   * Get products with pagination and filters (alias pour searchProducts)
   */
  async getProducts(options: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    try {
      const offset = (options.page && options.limit) ? (options.page - 1) * options.limit : 0;
      
      const products = await this.searchProducts({
        category: options.category,
        search: options.search,
        limit: options.limit,
        offset: offset
      });
      
      // Récupérer le nombre total de produits pour la pagination
      let countQuery = this.supabase
        .from('products')
        .select('id', { count: 'exact' });
        
      if (options.category) {
        countQuery = countQuery.eq('category', options.category);
      }
      
      if (options.search) {
        if (this.hasVectorSearch()) {
          countQuery = countQuery.textSearch('name_description_vector', options.search);
        } else {
          countQuery = countQuery.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
        }
      }
      
      const { count, error } = await countQuery;
      
      if (error) throw error;
      
      return {
        products,
        total: count || products.length,
        page: options.page || 1,
        limit: options.limit || products.length
      };
    } catch (error) {
      this.logger.error('Error getting products:', error);
      return {
        products: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 10
      };
    }
  }

  /**
   * Get product by ID (alias pour getProduct)
   */
  async getProductById(productId: string): Promise<Product | null> {
    return this.getProduct(productId);
  }

  /**
   * Create a new product
   */
  async createProduct(data: {
    name: string;
    description: string;
    price: number;
    stock: number;
    category: string;
    images: string[];
    sellerId: string;
  }): Promise<Product | null> {
    try {
      const { data: product, error } = await this.supabase
        .from('products')
        .insert({
          name: data.name,
          description: data.description,
          price: data.price,
          stock: data.stock,
          category: data.category,
          images: data.images,
          seller_id: data.sellerId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            created_by: data.sellerId
          }
        })
        .select()
        .single();
        
      if (error) throw error;
      
      return this.processProductForDisplay(product);
    } catch (error) {
      this.logger.error('Error creating product:', error);
      return null;
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product | null> {
    try {
      // Convertir le nom des propriétés de camelCase à snake_case pour Supabase
      const dbUpdates: any = {};
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.images !== undefined) dbUpdates.images = updates.images;
      if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;
      
      // Toujours mettre à jour la date de modification
      dbUpdates.updated_at = new Date().toISOString();
      
      const { data: product, error } = await this.supabase
        .from('products')
        .update(dbUpdates)
        .eq('id', productId)
        .select()
        .single();
        
      if (error) throw error;
      
      return this.processProductForDisplay(product);
    } catch (error) {
      this.logger.error(`Error updating product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(productId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('products')
        .delete()
        .eq('id', productId);
        
      if (error) throw error;
      
      return true;
    } catch (error) {
      this.logger.error(`Error deleting product ${productId}:`, error);
      return false;
    }
  }

  /**
   * Vérifie si un produit appartient à un vendeur donné
   */
  async isProductOwnedBySeller(productId: string, sellerId: string): Promise<boolean> {
    try {
      const product = await this.getProductById(productId);
      return product !== null && product.sellerId === sellerId;
    } catch (error) {
      return false;
    }
  }
}