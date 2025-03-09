import { createClient } from '@supabase/supabase-js';
import { CustomerPreferences, DEFAULT_PREFERENCES } from '../../types/ai.types';

export interface Customer {
  id: string;
  phoneNumber: string;
  whatsappId: string;
  whatsappName: string;
  preferences: CustomerPreferences;
  metadata: {
    lastInteraction?: Date;
    totalInteractions?: number;
    lastOrderId?: string;
    language?: string;
    tags?: string[];
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  issue: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export class CustomerService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }

  async createOrUpdateCustomer(data: {
    phoneNumber: string;
    whatsappId: string;
    whatsappName: string;
    preferences?: Partial<CustomerPreferences>;
  }): Promise<Customer> {
    // Try to find existing customer by WhatsApp ID or phone number
    const existingCustomer = await this.findCustomer({
      whatsappId: data.whatsappId,
      phoneNumber: data.phoneNumber
    });

    if (existingCustomer) {
      // Update existing customer
      return this.updateCustomer(existingCustomer.id, {
        whatsappName: data.whatsappName,
        preferences: data.preferences,
        metadata: {
          ...existingCustomer.metadata,
          lastInteraction: new Date(),
          totalInteractions: (existingCustomer.metadata.totalInteractions || 0) + 1
        }
      });
    }

    // Create new customer
    const { data: customer, error } = await this.supabase
      .from('customers')
      .insert({
        phone_number: data.phoneNumber,
        whatsapp_id: data.whatsappId,
        whatsapp_name: data.whatsappName,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...data.preferences
        },
        metadata: {
          lastInteraction: new Date(),
          totalInteractions: 1,
          language: 'fr',
          tags: []
        },
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCustomerFromDB(customer);
  }

  async findCustomer(query: {
    id?: string;
    whatsappId?: string;
    phoneNumber?: string;
  }): Promise<Customer | null> {
    let dbQuery = this.supabase
      .from('customers')
      .select();

    if (query.id) {
      dbQuery = dbQuery.eq('id', query.id);
    } else if (query.whatsappId) {
      dbQuery = dbQuery.eq('whatsapp_id', query.whatsappId);
    } else if (query.phoneNumber) {
      dbQuery = dbQuery.eq('phone_number', query.phoneNumber);
    } else {
      throw new Error('At least one search parameter is required');
    }

    const { data: customer, error } = await dbQuery.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return customer ? this.mapCustomerFromDB(customer) : null;
  }

  async updateCustomer(
    customerId: string,
    data: Partial<{
      whatsappName: string;
      preferences: Partial<CustomerPreferences>;
      metadata: Partial<Customer['metadata']>;
    }>
  ): Promise<Customer> {
    const updates: any = {
      updated_at: new Date()
    };

    if (data.whatsappName) {
      updates.whatsapp_name = data.whatsappName;
    }

    if (data.preferences) {
      const customer = await this.findCustomer({ id: customerId });
      updates.preferences = {
        ...(customer?.preferences || DEFAULT_PREFERENCES),
        ...data.preferences
      };
    }

    if (data.metadata) {
      const customer = await this.findCustomer({ id: customerId });
      updates.metadata = {
        ...(customer?.metadata || {}),
        ...data.metadata
      };
    }

    const { data: updatedCustomer, error } = await this.supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return this.mapCustomerFromDB(updatedCustomer);
  }

  async updateCustomerPreferences(
    customerId: string,
    preferences: Partial<CustomerPreferences>
  ): Promise<Customer> {
    return this.updateCustomer(customerId, { preferences });
  }

  async getCustomerPreferences(customerId: string): Promise<CustomerPreferences> {
    const customer = await this.findCustomer({ id: customerId });
    return customer?.preferences || DEFAULT_PREFERENCES;
  }

  async createSupportTicket(data: {
    customerId: string;
    issue: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<SupportTicket> {
    const { data: ticket, error } = await this.supabase
      .from('support_tickets')
      .insert({
        customer_id: data.customerId,
        issue: data.issue,
        status: 'OPEN',
        priority: data.priority || 'MEDIUM',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTicketFromDB(ticket);
  }

  private mapCustomerFromDB(data: any): Customer {
    return {
      id: data.id,
      phoneNumber: data.phone_number,
      whatsappId: data.whatsapp_id,
      whatsappName: data.whatsapp_name,
      preferences: data.preferences,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapTicketFromDB(data: any): SupportTicket {
    return {
      id: data.id,
      customerId: data.customer_id,
      issue: data.issue,
      status: data.status,
      priority: data.priority,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined
    };
  }

  // Ajoutez ces méthodes à votre classe CustomerService existante

  // ====== MÉTHODES POUR L'HISTORIQUE DES COMMANDES ======

  /**
   * Récupère les commandes d'un client avec pagination et filtrage
   */
  async getCustomerOrders(
    customerId: string,
    options: { page: number; limit: number; status?: string }
  ): Promise<{ orders: any[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, status } = options;
      const offset = (page - 1) * limit;
      
      // Construire la requête de base
      let query = this.supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('customer_id', customerId);
      
      // Ajouter un filtre par statut si fourni
      if (status) {
        query = query.eq('status', status);
      }
      
      // Exécuter la requête avec pagination
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) throw error;
      
      // Mapper les résultats en format camelCase
      const orders = data?.map(order => ({
        id: order.id,
        customerId: order.customer_id,
        sellerId: order.seller_id,
        items: order.items,
        status: order.status,
        totalAmount: order.total_amount,
        shippingFee: order.shipping_fee,
        shippingAddress: order.shipping_address,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        metadata: order.metadata || {}
      })) || [];
      
      return {
        orders,
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      console.error('Error getting customer orders:', error);
      return {
        orders: [],
        total: 0,
        page: options.page,
        limit: options.limit
      };
    }
  }

  /**
   * Récupère les détails d'une commande spécifique
   * Vérifie que la commande appartient bien au client
   */
  async getCustomerOrderDetails(customerId: string, orderId: string): Promise<any | null> {
    try {
      // Récupérer la commande
      const { data: order, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          seller:seller_id (id, brand_name, whatsapp_number)
        `)
        .eq('id', orderId)
        .eq('customer_id', customerId)
        .single();
        
      if (error || !order) return null;
      
      // Récupérer l'historique des statuts
      const { data: statusHistory } = await this.supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      
      // Formater la réponse
      return {
        id: order.id,
        customerId: order.customer_id,
        sellerId: order.seller_id,
        items: order.order_items,
        status: order.status,
        statusHistory: statusHistory || [],
        totalAmount: order.total_amount,
        shippingFee: order.shipping_fee,
        shippingAddress: order.shipping_address,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        metadata: order.metadata || {},
        seller: order.seller
      };
    } catch (error) {
      console.error('Error getting order details:', error);
      return null;
    }
  }

  // ====== MÉTHODES POUR LA GESTION DES ADRESSES ======

  /**
   * Récupère toutes les adresses d'un client
   */
  async getCustomerAddresses(customerId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      return data?.map(address => ({
        id: address.id,
        customerId: address.customer_id,
        name: address.name,
        recipientName: address.recipient_name,
        phoneNumber: address.phone_number,
        street: address.street,
        city: address.city,
        region: address.region,
        postalCode: address.postal_code,
        country: address.country || 'CI',
        isDefault: address.is_default,
        additionalInfo: address.additional_info,
        createdAt: new Date(address.created_at),
        updatedAt: new Date(address.updated_at)
      })) || [];
    } catch (error) {
      console.error('Error getting customer addresses:', error);
      return [];
    }
  }

  /**
   * Ajoute une nouvelle adresse pour un client
   */
  async addCustomerAddress(customerId: string, addressData: {
    name: string;
    recipientName: string;
    phoneNumber: string;
    street: string;
    city: string;
    region?: string;
    postalCode?: string;
    country?: string;
    additionalInfo?: string;
    isDefault?: boolean;
  }): Promise<any> {
    try {
      // Vérifier d'abord si c'est la première adresse
      const { count } = await this.supabase
        .from('customer_addresses')
        .select('*', { count: 'exact' })
        .eq('customer_id', customerId);
      
      // Si c'est la première adresse, la définir comme adresse par défaut
      const isDefault = addressData.isDefault !== undefined ? addressData.isDefault : count === 0;
      
      // Si cette adresse est définie comme par défaut, mettre à jour les autres adresses
      if (isDefault) {
        await this.supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId);
      }
      
      // Préparer les données pour l'insertion
      const addressRecord = {
        customer_id: customerId,
        name: addressData.name,
        recipient_name: addressData.recipientName,
        phone_number: addressData.phoneNumber,
        street: addressData.street,
        city: addressData.city,
        region: addressData.region || '',
        postal_code: addressData.postalCode || '',
        country: addressData.country || 'CI',
        additional_info: addressData.additionalInfo || '',
        is_default: isDefault,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Insérer la nouvelle adresse
      const { data, error } = await this.supabase
        .from('customer_addresses')
        .insert(addressRecord)
        .select()
        .single();
        
      if (error) throw error;
      
      // Retourner l'adresse au format camelCase
      return {
        id: data.id,
        customerId: data.customer_id,
        name: data.name,
        recipientName: data.recipient_name,
        phoneNumber: data.phone_number,
        street: data.street,
        city: data.city,
        region: data.region,
        postalCode: data.postal_code,
        country: data.country,
        isDefault: data.is_default,
        additionalInfo: data.additional_info,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error adding customer address:', error);
      throw new Error('Impossible d\'ajouter l\'adresse');
    }
  }

  /**
   * Met à jour une adresse existante
   */
  async updateCustomerAddress(
    customerId: string,
    addressId: string,
    updates: any
  ): Promise<any | null> {
    try {
      // Vérifier que l'adresse existe et appartient au client
      const { data: existing } = await this.supabase
        .from('customer_addresses')
        .select()
        .eq('id', addressId)
        .eq('customer_id', customerId)
        .single();
        
      if (!existing) return null;
      
      // Préparer les mises à jour en convertissant de camelCase à snake_case
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.recipientName !== undefined) updateData.recipient_name = updates.recipientName;
      if (updates.phoneNumber !== undefined) updateData.phone_number = updates.phoneNumber;
      if (updates.street !== undefined) updateData.street = updates.street;
      if (updates.city !== undefined) updateData.city = updates.city;
      if (updates.region !== undefined) updateData.region = updates.region;
      if (updates.postalCode !== undefined) updateData.postal_code = updates.postalCode;
      if (updates.country !== undefined) updateData.country = updates.country;
      if (updates.additionalInfo !== undefined) updateData.additional_info = updates.additionalInfo;
      
      // Si cette adresse devient l'adresse par défaut
      if (updates.isDefault === true && !existing.is_default) {
        // Mettre à jour les autres adresses
        await this.supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId);
          
        updateData.is_default = true;
      }
      
      // Mettre à jour l'adresse
      const { data, error } = await this.supabase
        .from('customer_addresses')
        .update(updateData)
        .eq('id', addressId)
        .select()
        .single();
        
      if (error) throw error;
      
      // Retourner l'adresse mise à jour au format camelCase
      return {
        id: data.id,
        customerId: data.customer_id,
        name: data.name,
        recipientName: data.recipient_name,
        phoneNumber: data.phone_number,
        street: data.street,
        city: data.city,
        region: data.region,
        postalCode: data.postal_code,
        country: data.country,
        isDefault: data.is_default,
        additionalInfo: data.additional_info,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error updating customer address:', error);
      return null;
    }
  }

  /**
   * Supprime une adresse
   */
  async deleteCustomerAddress(customerId: string, addressId: string): Promise<boolean> {
    try {
      // Vérifier que l'adresse existe et appartient au client
      const { data: address } = await this.supabase
        .from('customer_addresses')
        .select('is_default')
        .eq('id', addressId)
        .eq('customer_id', customerId)
        .single();
        
      if (!address) return false;
      
      // Supprimer l'adresse
      const { error } = await this.supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId);
        
      if (error) throw error;
      
      // Si c'était l'adresse par défaut, définir une autre adresse comme par défaut
      if (address.is_default) {
        const { data: addresses } = await this.supabase
          .from('customer_addresses')
          .select('id')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (addresses && addresses.length > 0) {
          await this.supabase
            .from('customer_addresses')
            .update({ is_default: true })
            .eq('id', addresses[0].id);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting customer address:', error);
      return false;
    }
  }

  /**
   * Définit une adresse comme adresse par défaut
   */
  async setDefaultAddress(customerId: string, addressId: string): Promise<any[]> {
    try {
      // Vérifier que l'adresse existe et appartient au client
      const { data: address } = await this.supabase
        .from('customer_addresses')
        .select()
        .eq('id', addressId)
        .eq('customer_id', customerId)
        .single();
        
      if (!address) throw new Error('Adresse non trouvée');
      
      // Mettre à jour toutes les adresses du client (aucune n'est par défaut)
      await this.supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId);
      
      // Définir cette adresse comme adresse par défaut
      await this.supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', addressId);
      
      // Récupérer les adresses mises à jour
      return this.getCustomerAddresses(customerId);
    } catch (error) {
      console.error('Error setting default address:', error);
      throw new Error('Impossible de définir l\'adresse par défaut');
    }
  }

  // ====== MÉTHODES POUR LA LISTE DE FAVORIS ======

  /**
   * Récupère la liste des produits favoris du client
   */
  async getCustomerWishlist(customerId: string): Promise<any[]> {
    try {
      // Récupérer les IDs des produits en favoris
      const { data: wishlistItems, error } = await this.supabase
        .from('customer_wishlist')
        .select('product_id, added_at')
        .eq('customer_id', customerId);
      
      if (error) throw error;
      
      if (!wishlistItems || wishlistItems.length === 0) {
        return [];
      }
      
      // Récupérer les détails des produits
      const productIds = wishlistItems.map(item => item.product_id);
      
      const { data: products } = await this.supabase
        .from('products')
        .select('*')
        .in('id', productIds);
      
      if (!products) return [];
      
      // Créer une map des dates d'ajout par produit
      const addedDatesMap = wishlistItems.reduce((map, item) => {
        map[item.product_id] = item.added_at;
        return map;
      }, {} as Record<string, string>);
      
      // Combiner les informations
      return products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        images: product.images || [],
        imageUrl: product.images && product.images.length > 0 ? product.images[0] : null,
        stock: product.stock,
        sellerId: product.seller_id,
        addedToWishlistAt: new Date(addedDatesMap[product.id])
      }));
    } catch (error) {
      console.error('Error getting customer wishlist:', error);
      return [];
    }
  }

  /**
   * Ajoute un produit à la liste des favoris
   */
  async addToWishlist(customerId: string, productId: string): Promise<any[]> {
    try {
      // Vérifier si le produit existe
      const { data: productExists } = await this.supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .single();
      
      if (!productExists) {
        throw new Error('Produit non trouvé');
      }
      
      // Vérifier si le produit est déjà dans les favoris
      const { data: existing } = await this.supabase
        .from('customer_wishlist')
        .select()
        .eq('customer_id', customerId)
        .eq('product_id', productId)
        .single();
      
      if (!existing) {
        // Ajouter aux favoris s'il n'y est pas déjà
        const { error } = await this.supabase
          .from('customer_wishlist')
          .insert({
            customer_id: customerId,
            product_id: productId,
            added_at: new Date().toISOString()
          });
          
        if (error) throw error;
      }
      
      // Retourner la liste mise à jour
      return this.getCustomerWishlist(customerId);
    } catch (error) {
      console.error('Error adding product to wishlist:', error);
      throw new Error('Impossible d\'ajouter le produit aux favoris');
    }
  }

  /**
   * Supprime un produit de la liste des favoris
   */
  async removeFromWishlist(customerId: string, productId: string): Promise<any[]> {
    try {
      const { error } = await this.supabase
        .from('customer_wishlist')
        .delete()
        .eq('customer_id', customerId)
        .eq('product_id', productId);
        
      if (error) throw error;
      
      // Retourner la liste mise à jour
      return this.getCustomerWishlist(customerId);
    } catch (error) {
      console.error('Error removing product from wishlist:', error);
      throw new Error('Impossible de supprimer le produit des favoris');
    }
  }
}
