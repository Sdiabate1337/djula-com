import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { ProductService } from '../product/product.service';
import  {OrderStatus}  from '../../types/ai.types'; 

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  name?: string; // Product name for display
  metadata?: Record<string, any>;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  instructions?: string;
  recipientName?: string;
  phoneNumber?: string;
}

export interface Order {
  id: string;
  customerId: string;
  sellerId: string; // Ajout de cette propriété
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  shippingFee?: number;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  metadata: {
    estimatedDelivery?: Date;
    trackingNumber?: string;
    notes?: string;
    mobileMoneyNumber?: string;
    mobileMoneyProvider?: string;
    paymentReference?: string;
    deliveryPartner?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: Date;
  description: string;
  actor?: string; // Who made the change
}



export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export class OrderService {
  private supabase: SupabaseClient;
  private logger: Logger;
  private productService: ProductService;
  private orderCache: Map<string, { order: Order, timestamp: number }>;
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Les variables d\'environnement Supabase sont manquantes');
    }
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    this.logger = new Logger('OrderService');
    this.productService = new ProductService();
    this.orderCache = new Map();

    // Nettoyage périodique du cache
    setInterval(() => this.cleanCache(), this.CACHE_TTL);
  }

  /**
   * Create a new order
   */
  async createOrder(customerId: string, data: {
    customerId: string;
    sellerId: string; // Ajout de cette ligne
    items: Array<{ productId: string; quantity: number; }>;
    shippingAddress?: ShippingAddress;
    paymentMethod?: string;
  }): Promise<Order> {
    try {
      // Validate products and calculate totals with the ProductService
      const validation = await this.productService.validateAndPriceOrder(data.items);
      
      if (!validation.valid) {
        throw new Error(`Validation de commande échouée: ${validation.errors?.join(', ')}`);
      }

      // Prepare order items with product details
      const orderItems: OrderItem[] = validation.items?.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        name: item.product.name,
        metadata: {
          imageUrl: item.product.imageUrl || item.product.images?.[0],
          category: item.product.category
        }
      })) || [];

      // Set default shipping address if not provided
      const shippingAddress = data.shippingAddress || {
        street: '',
        city: '',
        country: 'Côte d\'Ivoire', // Default country
        recipientName: '' // Will be filled later
      };

      // Prepare order data
      const orderData = {
        customer_id: customerId,
        seller_id: data.sellerId, // Ajoutez cette ligne
        items: orderItems,
        status: OrderStatus.DRAFT, // Start as draft until confirmation
        total_amount: validation.total,
        shipping_fee: validation.shipping,
        shipping_address: shippingAddress,
        payment_method: data.paymentMethod || 'MOBILE_MONEY', // Default to mobile money in African context
        payment_status: PaymentStatus.PENDING,
        metadata: {
          estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          notes: 'Commande créée via WhatsApp'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert the order
      const { data: order, error } = await this.supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;
      
      // Add initial status to history
      await this.addOrderStatusHistory(
        order.id,
        OrderStatus.DRAFT,
        'Commande créée',
        customerId
      );

      const mappedOrder = this.mapOrderFromDB(order);
      
      // Update cache
      this.orderCache.set(mappedOrder.id, {
        order: mappedOrder,
        timestamp: Date.now()
      });
      
      return mappedOrder;
    } catch (error) {
      this.logger.error('Erreur lors de la création de la commande:', error);
      throw new Error(`Impossible de créer la commande: ${error.message}`);
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    try {
      // Check cache first
      const cachedOrder = this.orderCache.get(orderId);
      if (cachedOrder && Date.now() - cachedOrder.timestamp < this.CACHE_TTL) {
        return cachedOrder.order;
      }
      
      const { data, error } = await this.supabase
        .from('orders')
        .select()
        .eq('id', orderId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw error;
      }

      const order = this.mapOrderFromDB(data);
      
      // Update cache
      this.orderCache.set(orderId, {
        order,
        timestamp: Date.now()
      });
      
      return order;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de la commande ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Get order with detailed status timeline
   */
  async getOrderStatus(orderId: string): Promise<{
    order: Order;
    timeline: OrderTimeline[];
  } | null> {
    try {
      const [orderResult, timelineResult] = await Promise.all([
        this.supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single(),
        this.supabase
          .from('order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
      ]);

      if (orderResult.error) {
        if (orderResult.error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw orderResult.error;
      }
      
      if (timelineResult.error) throw timelineResult.error;

      return {
        order: this.mapOrderFromDB(orderResult.data),
        timeline: timelineResult.data.map(entry => ({
          status: entry.status,
          timestamp: new Date(entry.created_at),
          description: entry.description,
          actor: entry.actor
        }))
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du statut de commande ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    description?: string,
    actorId?: string
  ): Promise<Order | null> {
    try {
      const updates = {
        status,
        updated_at: new Date().toISOString()
      };

      // Update the order status
      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (orderError) throw orderError;

      // Add to status history
      await this.addOrderStatusHistory(
        orderId,
        status, 
        description || `Statut de la commande mis à jour: ${status}`,
        actorId
      );

      const mappedOrder = this.mapOrderFromDB(order);
      
      // Update cache
      this.orderCache.set(orderId, {
        order: mappedOrder,
        timestamp: Date.now()
      });
      
      return mappedOrder;
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour du statut de commande ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Add entry to order status history
   */
  private async addOrderStatusHistory(
    orderId: string,
    status: OrderStatus,
    description: string,
    actorId?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status,
          description,
          actor: actorId,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      this.logger.error(`Erreur lors de l'ajout à l'historique de statut pour ${orderId}:`, error);
      // Non-critical error, continue execution
    }
  }

  /**
   * Get orders for a customer
   */
  async getCustomerOrders(
    customerId: string,
    options: {
      status?: OrderStatus;
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<Order[]> {
    try {
      let query = this.supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (options.status) {
        query = query.eq('status', options.status);
      }
      
      if (options.fromDate) {
        query = query.gte('created_at', options.fromDate.toISOString());
      }
      
      if (options.toDate) {
        query = query.lte('created_at', options.toDate.toISOString());
      }
      
      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.range(
          options.offset, 
          options.offset + (options.limit || 10) - 1
        );
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map(this.mapOrderFromDB);
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des commandes pour ${customerId}:`, error);
      return [];
    }
  }

  /**
   * Update payment status of an order
   */
  async updatePaymentStatus(
    orderId: string, 
    paymentStatus: PaymentStatus,
    paymentDetails?: {
      reference?: string;
      mobileMoneyNumber?: string;
      mobileMoneyProvider?: string;
      notes?: string;
    }
  ): Promise<Order | null> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error(`Commande ${orderId} introuvable`);
      }
      
      // Prepare updates
      const updates: any = {
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      };
      
      // Update metadata with payment details
      if (paymentDetails) {
        updates.metadata = {
          ...order.metadata,
          paymentReference: paymentDetails.reference || order.metadata.paymentReference,
          mobileMoneyNumber: paymentDetails.mobileMoneyNumber || order.metadata.mobileMoneyNumber,
          mobileMoneyProvider: paymentDetails.mobileMoneyProvider || order.metadata.mobileMoneyProvider,
          paymentNotes: paymentDetails.notes
        };
      }
      
      // If payment is completed, also update order status to CONFIRMED if it was PENDING
      if (paymentStatus === PaymentStatus.COMPLETED && order.status === OrderStatus.PENDING) {
        updates.status = OrderStatus.CONFIRMED;
      }
      
      // Update the order
      const { data, error } = await this.supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();
        
      if (error) throw error;
      
      // Add to order history if status was changed
      if (updates.status) {
        await this.addOrderStatusHistory(
          orderId,
          updates.status,
          `Commande confirmée suite au paiement`,
          order.customerId
        );
      }
      
      const updatedOrder = this.mapOrderFromDB(data);
      
      // Update cache
      this.orderCache.set(orderId, {
        order: updatedOrder,
        timestamp: Date.now()
      });
      
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour du statut de paiement ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Update shipping information
   */
  async updateShippingInfo(
    orderId: string,
    updates: {
      address?: Partial<ShippingAddress>;
      trackingNumber?: string;
      estimatedDelivery?: Date;
      deliveryPartner?: string;
    }
  ): Promise<Order | null> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error(`Commande ${orderId} introuvable`);
      }
      
      const orderUpdates: any = {
        updated_at: new Date().toISOString()
      };
      
      // Update shipping address if provided
      if (updates.address) {
        orderUpdates.shipping_address = {
          ...order.shippingAddress,
          ...updates.address
        };
      }
      
      // Update metadata
      const updatedMetadata = { ...order.metadata };
      
      if (updates.trackingNumber) {
        updatedMetadata.trackingNumber = updates.trackingNumber;
      }
      
      if (updates.estimatedDelivery) {
        updatedMetadata.estimatedDelivery = updates.estimatedDelivery;
      }
      
      if (updates.deliveryPartner) {
        updatedMetadata.deliveryPartner = updates.deliveryPartner;
      }
      
      orderUpdates.metadata = updatedMetadata;
      
      // Update the order
      const { data, error } = await this.supabase
        .from('orders')
        .update(orderUpdates)
        .eq('id', orderId)
        .select()
        .single();
        
      if (error) throw error;
      
      const updatedOrder = this.mapOrderFromDB(data);
      
      // Update cache
      this.orderCache.set(orderId, {
        order: updatedOrder,
        timestamp: Date.now()
      });
      
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour des infos d'expédition ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    initiatedBy: string
  ): Promise<Order | null> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error(`Commande ${orderId} introuvable`);
      }
      
      // Check if order can be cancelled (only certain statuses)
      if (![OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
        throw new Error(`Impossible d'annuler une commande avec le statut ${order.status}`);
      }
      
      // Update order status
      const { data, error } = await this.supabase
        .from('orders')
        .update({
          status: OrderStatus.CANCELLED,
          updated_at: new Date().toISOString(),
          metadata: {
            ...order.metadata,
            cancellationReason: reason,
            cancelledBy: initiatedBy,
            cancelledAt: new Date().toISOString()
          }
        })
        .eq('id', orderId)
        .select()
        .single();
        
      if (error) throw error;
      
      // Add to order history
      await this.addOrderStatusHistory(
        orderId,
        OrderStatus.CANCELLED,
        `Commande annulée: ${reason}`,
        initiatedBy
      );
      
      const cancelledOrder = this.mapOrderFromDB(data);
      
      // Update cache
      this.orderCache.set(orderId, {
        order: cancelledOrder,
        timestamp: Date.now()
      });
      
      return cancelledOrder;
    } catch (error) {
      this.logger.error(`Erreur lors de l'annulation de la commande ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Add a note to an order
   */
  async addOrderNote(
    orderId: string,
    note: string,
    addedBy: string
  ): Promise<boolean> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error(`Commande ${orderId} introuvable`);
      }
      
      // Get existing notes
      const existingNotes = order.metadata.notes || '';
      
      // Add the new note with timestamp
      const timestamp = new Date().toISOString();
      const formattedNote = `[${timestamp}] ${addedBy}: ${note}`;
      
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n${formattedNote}` 
        : formattedNote;
        
      // Update the order
      const { error } = await this.supabase
        .from('orders')
        .update({
          metadata: {
            ...order.metadata,
            notes: updatedNotes
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
        
      if (error) throw error;
      
      // Invalidate cache
      this.orderCache.delete(orderId);
      
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de l'ajout d'une note à la commande ${orderId}:`, error);
      return false;
    }
  }

  /**
   * Get order statistics for a customer
   */
  async getCustomerOrderStats(customerId: string): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate: Date | null;
  }> {
    try {
      // Get all orders for this customer
      const { data, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId);
        
      if (error) throw error;
      
      // Default stats
      const stats = {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        lastOrderDate: null as Date | null
      };
      
      if (!data || data.length === 0) {
        return stats;
      }
      
      // Calculate statistics
      const orders = data.map(this.mapOrderFromDB);
      
      stats.totalOrders = orders.length;
      
      stats.completedOrders = orders.filter(
        order => order.status === OrderStatus.DELIVERED
      ).length;
      
      stats.pendingOrders = orders.filter(
        order => [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED].includes(order.status)
      ).length;
      
      // Calculate financial metrics
      const completedOrdersArray = orders.filter(
        order => order.status === OrderStatus.DELIVERED && order.paymentStatus === PaymentStatus.COMPLETED
      );
      
      stats.totalSpent = completedOrdersArray.reduce(
        (sum, order) => sum + order.totalAmount, 
        0
      );
      
      stats.averageOrderValue = completedOrdersArray.length 
        ? stats.totalSpent / completedOrdersArray.length 
        : 0;
        
      // Find last order date
      if (orders.length > 0) {
        const lastOrder = orders.reduce(
          (latest, order) => latest.createdAt > order.createdAt ? latest : order
        );
        stats.lastOrderDate = lastOrder.createdAt;
      }
      
      return stats;
    } catch (error) {
      this.logger.error(`Erreur lors du calcul des statistiques pour ${customerId}:`, error);
      return {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        lastOrderDate: null
      };
    }
  }

  /**
   * Convert database order to Order type
   */
  private mapOrderFromDB(data: any): Order {
    return {
      id: data.id,
      customerId: data.customer_id,
      sellerId: data.seller_id, // Ajout de cette ligne
      items: data.items,
      status: data.status,
      totalAmount: data.total_amount,
      shippingFee: data.shipping_fee,
      shippingAddress: data.shipping_address,
      paymentMethod: data.payment_method,
      paymentStatus: data.payment_status,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Clean expired entries from the cache
   */
  private cleanCache(): void {
    const now = Date.now();
    const expiredTime = now - this.CACHE_TTL;
    
    for (const [key, value] of this.orderCache.entries()) {
      if (value.timestamp < expiredTime) {
        this.orderCache.delete(key);
      }
    }
  }

  /**
   * Update order items (e.g., changing quantities)
   */
  async updateOrderItems(
    orderId: string,
    items: OrderItem[]
  ): Promise<Order | null> {
    try {
      // Only allow updating items for DRAFT or PENDING orders
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error(`Commande ${orderId} introuvable`);
      }
      
      if (![OrderStatus.DRAFT, OrderStatus.PENDING].includes(order.status)) {
        throw new Error(`Impossible de modifier les articles d'une commande avec le statut ${order.status}`);
      }
      
      // Validate the new items
      const productIds = items.map(item => ({ 
        productId: item.productId, 
        quantity: item.quantity 
      }));
      
      const validation = await this.productService.validateAndPriceOrder(productIds);
      
      if (!validation.valid) {
        throw new Error(`Validation des articles échouée: ${validation.errors?.join(', ')}`);
      }
      
      // Update the order
      const { data, error } = await this.supabase
        .from('orders')
        .update({
          items: items,
          total_amount: validation.total,
          shipping_fee: validation.shipping,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();
        
      if (error) throw error;
      
      const updatedOrder = this.mapOrderFromDB(data);
      
      // Update cache
      this.orderCache.set(orderId, {
        order: updatedOrder,
        timestamp: Date.now()
      });
      
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour des articles de la commande ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Get estimated delivery time based on location and products
   */
  getEstimatedDeliveryTime(address: ShippingAddress): { min: number, max: number } {
    // This is a simplified implementation
    // In a real scenario, this would incorporate logistics data
    
    // Default: 3-7 days
    let minDays = 3;
    let maxDays = 7;
    
    // Adjust based on location
    if (address.country !== 'Côte d\'Ivoire') {
      // International delivery takes longer
      minDays += 5;
      maxDays += 10;
    } else if (address.city && ['Abidjan', 'Abijan'].includes(address.city)) {
      // Major city is faster
      minDays = 1;
      maxDays = 3;
    } else {
      // Other domestic locations
      minDays = 2;
      maxDays = 5;
    }
    
    return { min: minDays, max: maxDays };
  }

  /**
   * Check if a mobile money payment is valid
   * This simulates integration with mobile money APIs
   */
  async validateMobileMoneyPayment(
    orderId: string,
    phoneNumber: string,
    provider: string,
    amount: number
  ): Promise<{
    valid: boolean;
    reference?: string;
    message: string;
  }> {
    try {
      // In a real implementation, this would call the mobile money provider's API
      // Here we're simulating a successful payment most of the time
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demonstration purposes, we'll validate using simple rules:
      // 1. Phone number must be at least 8 digits
      // 2. Provider must be one of the major ones
      // 3. Random success rate to simulate real-world scenarios
      
      if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 8) {
        return {
          valid: false,
          message: "Le numéro de téléphone est invalide"
        };
      }
      
      const validProviders = ['ORANGE', 'MTN', 'MOOV', 'WAVE', 'MPESA'];
      if (!validProviders.includes(provider.toUpperCase())) {
        return {
          valid: false,
          message: "Fournisseur de mobile money non pris en charge"
        };
      }
      
      // Simulate 85% success rate
      const isSuccessful = Math.random() < 0.85;
      
      if (!isSuccessful) {
        const errorMessages = [
          "Solde insuffisant",
          "Transaction refusée par l'opérateur",
          "Délai d'attente dépassé pour la transaction",
          "Erreur technique temporaire"
        ];
        return {
          valid: false,
          message: errorMessages[Math.floor(Math.random() * errorMessages.length)]
        };
      }
      
      // Generate a payment reference
      const reference = `MM-${provider.substring(0, 3)}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      // Update the order with this payment reference
      await this.updatePaymentStatus(
        orderId,
        PaymentStatus.COMPLETED,
        {
          reference,
          mobileMoneyNumber: phoneNumber,
          mobileMoneyProvider: provider,
          notes: `Paiement par ${provider} (${phoneNumber}) validé`
        }
      );
      
      return {
        valid: true,
        reference,
        message: "Paiement validé avec succès"
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la validation du paiement mobile pour ${orderId}:`, error);
      return {
        valid: false,
        message: "Une erreur est survenue lors du traitement du paiement"
      };
    }
  }

  /**
   * Alias pour getCustomerOrders pour compatibilité avec les routes existantes
   */
  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return this.getCustomerOrders(userId);
  }

  /**
   * Alias pour getOrder pour compatibilité avec les routes existantes
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    return this.getOrder(orderId);
  }

  /**
   * Get orders for a seller
   * This is semantically different from getOrdersByUserId which gets orders placed BY a user
   * while this method gets orders managed BY a seller
   */
  async getOrdersBySellerId(sellerId: string, options: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 20, status } = options;
      const offset = (page - 1) * limit;
      
      // Construire la requête de base
      let query = this.supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('seller_id', sellerId);
      
      // Filtrer par statut si fourni
      if (status) {
        query = query.eq('status', status);
      }
      
      // Appliquer pagination
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return {
        orders: data ? data.map(this.mapOrderFromDB) : [],
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des commandes pour le vendeur ${sellerId}:`, error);
      return {
        orders: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 20
      };
    }
  }
}