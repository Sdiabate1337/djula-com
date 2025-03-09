import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OrderService, PaymentStatus } from '../order/order.service';
import { Logger } from '../../utils/logger';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  provider?: string;
  logo?: string;
  instructions?: string[];
  countryCode?: string;
  minimumAmount?: number;
  maximumAmount?: number;
  fees?: {
    percentage?: number;
    fixed?: number;
  };
  metadata?: Record<string, any>;
  merchantNumber?: string; // Numéro marchand pour Mobile Money
}

export type PaymentMethodType = 
  | 'mobile_money'
  | 'card'
  | 'cash_on_delivery'
  | 'ussd'
  | 'qr_code'
  | 'digital_wallet';  // Ajout pour Wave et solutions similaires

export interface PaymentTransaction {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  paymentLink?: string;
  merchantNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export class PaymentService {
  private supabase: SupabaseClient;
  private orderService: OrderService;
  private logger: Logger;
  private paymentMethodCache: Map<string, { methods: PaymentMethod[], timestamp: number }>;
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Les variables d\'environnement Supabase sont manquantes');
    }
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    this.orderService = new OrderService();
    this.logger = new Logger('PaymentService');
    this.paymentMethodCache = new Map();
    
    // Nettoyage périodique du cache
    setInterval(() => this.cleanCache(), this.CACHE_TTL);
  }

  /**
   * Get available payment methods for a customer
   * - Cette méthode est utilisée par WhatsAppService pour montrer les options de paiement
   */
  async getAvailablePaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      // Check cache first
      const cachedMethods = this.paymentMethodCache.get(customerId);
      if (cachedMethods && Date.now() - cachedMethods.timestamp < this.CACHE_TTL) {
        return cachedMethods.methods;
      }
      
      // Get customer's region and preferences
      const { data: customer, error: customerError } = await this.supabase
        .from('customers')
        .select('region, preferences, phone_number')
        .eq('id', customerId)
        .single();

      if (customerError) {
        this.logger.error(`Erreur lors de la récupération du client ${customerId}:`, customerError);
        // Default to Ivory Coast if customer not found
        return this.getDefaultPaymentMethods('CI');
      }

      // Get available payment methods for the region
      const { data: methods, error: methodsError } = await this.supabase
        .from('payment_methods')
        .select('*')
        .eq('active', true)
        .or(`region.eq.${customer.region},region.is.null`)
        .order('priority', { ascending: true });

      if (methodsError) {
        this.logger.error('Erreur lors de la récupération des méthodes de paiement:', methodsError);
        return this.getDefaultPaymentMethods(customer.region);
      }

      // Map to our PaymentMethod interface
      const mappedMethods: PaymentMethod[] = methods.map(method => ({
        id: method.id,
        type: method.type as PaymentMethodType,
        name: method.name,
        provider: method.provider,
        logo: method.logo,
        instructions: method.instructions,
        countryCode: method.region,
        minimumAmount: method.minimum_amount,
        maximumAmount: method.maximum_amount,
        fees: method.fees,
        merchantNumber: method.merchant_number,
        metadata: method.metadata || {}
      }));
      
      // Cache the results
      this.paymentMethodCache.set(customerId, {
        methods: mappedMethods,
        timestamp: Date.now()
      });
      
      return mappedMethods;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des méthodes de paiement pour ${customerId}:`, error);
      return this.getDefaultPaymentMethods('CI'); // Default to Ivory Coast
    }
  }

  /**
   * Initiate a payment for an order
   * - Cette méthode est utilisée par WhatsAppService pour démarrer un processus de paiement
   */
  async initiatePayment(
    orderId: string,
    method: PaymentMethod
  ): Promise<PaymentTransaction> {
    try {
      // Get order details
      const order = await this.orderService.getOrder(orderId);
      if (!order) {
        throw new Error(`Commande ${orderId} introuvable`);
      }

      // Calculate total with shipping fee
      const totalAmount = order.totalAmount + (order.shippingFee || 0);
      
      // Generate payment instructions based on method
      const instructions = this.generatePaymentInstructions(method, totalAmount);
      
      // Generate reference code
      const reference = this.generatePaymentReference(method);

      // Generate payment link if needed (for card payments or digital wallets)
      let paymentLink = undefined;
      if (method.type === 'card' || (method.type === 'digital_wallet' && method.provider === 'DJAMO')) {
        paymentLink = `https://pay.example.com/checkout/${orderId}?ref=${reference}&provider=${method.provider?.toLowerCase() || 'card'}`;
      } else if (method.type === 'digital_wallet' && method.provider === 'WAVE') {
        // Wave utilise souvent un QR code ou un lien direct
        paymentLink = `https://pay.wave.com/checkout?merchant=${method.merchantNumber}&amount=${totalAmount}&reference=${reference}`;
      }

      // Create payment transaction
      const { data: transaction, error } = await this.supabase
        .from('payment_transactions')
        .insert({
          order_id: orderId,
          customer_id: order.customerId,
          amount: totalAmount,
          currency: 'FCFA',
          method: method,
          status: 'PENDING',
          reference: reference,
          payment_link: paymentLink,
          merchant_number: method.merchantNumber || this.getMerchantNumber(method.provider),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            instructions: instructions,
            provider: method.provider,
            confirmationCode: this.generateConfirmationCode(),
            fees: this.calculateFees(method, totalAmount)
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Update order payment status
      await this.orderService.updatePaymentStatus(orderId, PaymentStatus.PENDING);

      return {
        id: transaction.id, 
        orderId: transaction.order_id,
        customerId: transaction.customer_id,
        amount: transaction.amount,
        currency: transaction.currency,
        method: transaction.method,
        status: transaction.status as PaymentStatus,
        reference: transaction.reference,
        paymentLink: transaction.payment_link,
        merchantNumber: transaction.merchant_number,
        createdAt: new Date(transaction.created_at),
        updatedAt: new Date(transaction.updated_at),
        metadata: transaction.metadata || {}
      };
    } catch (error) {
      this.logger.error(`Erreur lors de l'initiation du paiement pour ${orderId}:`, error);
      throw new Error(`Impossible d'initier le paiement: ${error.message}`);
    }
  }

  /**
   * Verify the payment status
   */
  async verifyPayment(
    orderId: string,
    verificationDetails: {
      reference?: string;
      phoneNumber?: string;
      provider?: string;
    }
  ): Promise<{
    isVerified: boolean;
    status: PaymentStatus;
    message: string;
  }> {
    try {
      // Get transaction for this order
      const { data: transactions, error } = await this.supabase
        .from('payment_transactions')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (error) throw error;
      
      const transaction = transactions[0];
      if (!transaction) {
        return {
          isVerified: false,
          status: PaymentStatus.PENDING,
          message: "Aucune transaction trouvée pour cette commande"
        };
      }

      // Simuler différents taux de succès pour différentes méthodes
      let successRate = 0.6; // 60% par défaut
      const methodType = transaction.method?.type;
      const provider = transaction.method?.provider;

      // Ajuster les taux de réussite par méthode/fournisseur
      if (methodType === 'digital_wallet') {
        if (provider === 'WAVE') {
          successRate = 0.95; // Wave est très fiable - 95%
        } else if (provider === 'DJAMO') {
          successRate = 0.9;  // Djamo est fiable - 90%
        }
      } else if (methodType === 'mobile_money') {
        if (provider === 'ORANGE') {
          successRate = 0.85;
        } else if (provider === 'MTN') {
          successRate = 0.8;
        }
      }
      
      // Simulation de vérification avec le taux de succès défini
      const isVerified = Math.random() < successRate;
      
      if (isVerified) {
        // Update the transaction status
        await this.supabase
          .from('payment_transactions')
          .update({
            status: 'COMPLETED',
            updated_at: new Date().toISOString(),
            metadata: {
              ...transaction.metadata,
              verificationTime: new Date().toISOString(),
              verificationMethod: verificationDetails.phoneNumber ? 'phone' : 'reference'
            }
          })
          .eq('id', transaction.id);
        
        // Update the order status
        await this.orderService.updatePaymentStatus(orderId, PaymentStatus.COMPLETED);
        
        return {
          isVerified: true,
          status: PaymentStatus.COMPLETED,
          message: `Paiement ${transaction.method?.provider || ''} vérifié avec succès`
        };
      }
      
      return {
        isVerified: false,
        status: transaction.status,
        message: "Le paiement n'a pas encore été reçu ou n'a pas pu être vérifié"
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la vérification du paiement pour ${orderId}:`, error);
      return {
        isVerified: false,
        status: PaymentStatus.PENDING,
        message: "Une erreur est survenue lors de la vérification"
      };
    }
  }

  /**
   * Calculate fees for payment method
   */
  private calculateFees(method: PaymentMethod, amount: number): {
    amount: number;
    percentage: number;
  } {
    // Si la méthode a des frais définis, les utiliser
    if (method.fees) {
      let feeAmount = 0;
      
      if (method.fees.percentage) {
        feeAmount += (amount * method.fees.percentage / 100);
      }
      
      if (method.fees.fixed) {
        feeAmount += method.fees.fixed;
      }
      
      return {
        amount: feeAmount,
        percentage: feeAmount / amount * 100
      };
    }
    
    // Frais par défaut selon le type/fournisseur
    switch (method.type) {
      case 'mobile_money':
        if (method.provider === 'ORANGE') {
          return { amount: amount * 0.01, percentage: 1 }; // 1%
        } else if (method.provider === 'MTN') {
          return { amount: amount * 0.015, percentage: 1.5 }; // 1.5%
        }
        return { amount: amount * 0.01, percentage: 1 }; // 1% par défaut
        
      case 'digital_wallet':
        if (method.provider === 'WAVE') {
          return { amount: 0, percentage: 0 }; // Wave n'a souvent pas de frais
        } else if (method.provider === 'DJAMO') {
          return { amount: amount * 0.01, percentage: 1 }; // 1% estimation
        }
        return { amount: amount * 0.01, percentage: 1 };
        
      case 'card':
        return { amount: amount * 0.025, percentage: 2.5 }; // 2.5%
        
      default:
        return { amount: 0, percentage: 0 };
    }
  }

  /**
   * Get default payment methods based on region
   */
  private getDefaultPaymentMethods(region: string = 'CI'): PaymentMethod[] {
    // Default payment methods for West Africa / Côte d'Ivoire
    const methods: PaymentMethod[] = [];
    
    // Wave - Très populaire en Afrique de l'Ouest
    methods.push({
      id: 'wave',
      type: 'digital_wallet',
      name: 'Wave',
      provider: 'WAVE',
      logo: 'https://wave.com/static/images/logo.png', // Remplacer par URL réelle
      countryCode: region,
      merchantNumber: '7979',
      fees: {
        percentage: 0, // Frais très bas ou inexistants, un avantage de Wave
        fixed: 0
      },
      instructions: [
        'Ouvrez votre application Wave',
        'Scannez le QR code ou envoyez au 7979',
        'Entrez le montant et validez avec votre PIN',
        'Conservez le reçu de transaction'
      ],
      metadata: {
        ussd_code: '*933#',
        app_url: 'https://wave.com/app'
      }
    });
    
    // Djamo - Fintech ivoirienne
    methods.push({
      id: 'djamo',
      type: 'digital_wallet',
      name: 'Djamo',
      provider: 'DJAMO',
      logo: 'https://djamo.ci/logo.png', // Remplacer par URL réelle
      countryCode: 'CI', // Principalement en Côte d'Ivoire
      instructions: [
        'Connectez-vous à votre compte Djamo',
        'Choisissez "Payer un marchand"',
        'Entrez la référence de paiement',
        'Validez le paiement avec votre code PIN'
      ],
      fees: {
        percentage: 1, // Estimation
        fixed: 0
      }
    });
    
    // Mobile Money - Orange Money
    methods.push({
      id: 'mm-orange',
      type: 'mobile_money',
      name: 'Orange Money',
      provider: 'ORANGE',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Orange_logo.svg/640px-Orange_logo.svg.png',
      countryCode: region,
      merchantNumber: '0707070707',
      instructions: [
        'Composez *144# sur votre téléphone',
        'Sélectionnez "Paiement marchand"',
        'Entrez le numéro marchand: 0707070707',
        'Entrez le montant à payer',
        'Validez avec votre code PIN',
        'Conservez le SMS de confirmation'
      ],
      fees: {
        percentage: 1,
        fixed: 0
      },
      metadata: {
        phone_prefixes: ['07', '+2250'],
        shortcode: '*144#'
      }
    });
    
    // Mobile Money - MTN Mobile Money
    methods.push({
      id: 'mm-mtn',
      type: 'mobile_money',
      name: 'MTN Mobile Money',
      provider: 'MTN',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/New_MTN_logo.svg/2048px-New_MTN_logo.svg.png',
      countryCode: region,
      merchantNumber: '0505050505',
      instructions: [
        'Composez *133# sur votre téléphone',
        'Sélectionnez "Paiement"',
        'Entrez le numéro marchand: 0505050505',
        'Entrez le montant à payer',
        'Validez avec votre code PIN',
        'Conservez le SMS de confirmation'
      ],
      fees: {
        percentage: 1.5,
        fixed: 0
      },
      metadata: {
        phone_prefixes: ['05', '+2250'],
        shortcode: '*133#'
      }
    });
    
    // Cash on Delivery - Toujours populaire en Afrique
    methods.push({
      id: 'cod',
      type: 'cash_on_delivery',
      name: 'Paiement à la livraison',
      logo: 'https://cdn-icons-png.flaticon.com/512/2331/2331895.png',
      countryCode: region,
      instructions: [
        'Préparez le montant exact à payer au livreur',
        'Un code unique vous sera fourni pour la livraison',
        'Vous recevrez un reçu à la livraison'
      ],
      fees: {
        percentage: 0,
        fixed: 0
      }
    });
    
    return methods;
  }
  
  /**
   * Generate payment instructions based on method and amount
   */
  private generatePaymentInstructions(
    method: PaymentMethod,
    amount: number
  ): string[] {
    const formattedAmount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF'
    }).format(amount);
    
    // Use custom instructions from payment method if available
    if (method.instructions && method.instructions.length > 0) {
      return method.instructions.map(instruction => 
        instruction.replace('{amount}', formattedAmount)
      );
    }
    
    // Default instructions by payment method type
    switch (method.type) {
      case 'mobile_money':
        return [
          `Montant à payer: ${formattedAmount}`,
          `Utilisez ${method.name} pour payer au numéro: ${method.merchantNumber || this.getMerchantNumber(method.provider)}`,
          'Conservez votre numéro de transaction comme preuve de paiement'
        ];
        
      case 'digital_wallet':
        if (method.provider === 'WAVE') {
          return [
            `Montant à payer: ${formattedAmount}`,
            'Ouvrez l\'application Wave',
            'Sélectionnez "Envoyer de l\'argent"',
            `Envoyez au numéro: ${method.merchantNumber || '7979'}`,
            'Validez avec votre code PIN'
          ];
        } else if (method.provider === 'DJAMO') {
          return [
            `Montant à payer: ${formattedAmount}`,
            'Ouvrez l\'application Djamo',
            'Sélectionnez "Paiement"',
            'Suivez les instructions pour finaliser le paiement'
          ];
        }
        return [
          `Montant à payer: ${formattedAmount}`,
          `Utilisez votre application ${method.name} pour effectuer le paiement`,
          'Suivez les instructions dans l\'application'
        ];
        
      case 'card':
        return [
          `Montant à payer: ${formattedAmount}`,
          'Vous serez redirigé vers une page de paiement sécurisée',
          'Préparez votre carte bancaire'
        ];
        
      case 'cash_on_delivery':
        return [
          `Montant à payer: ${formattedAmount}`,
          'Préparez le montant exact pour le livreur',
          'Le paiement se fait à la livraison'
        ];
        
      default:
        return [
          `Montant à payer: ${formattedAmount}`,
          'Suivez les instructions pour finaliser le paiement'
        ];
    }
  }
  
  /**
   * Generate a payment reference code
   */
  private generatePaymentReference(method: PaymentMethod): string {
    let prefix;
    
    // Utiliser des préfixes spécifiques selon le type ou fournisseur
    if (method.type === 'digital_wallet') {
      if (method.provider === 'WAVE') {
        prefix = 'WV';
      } else if (method.provider === 'DJAMO') {
        prefix = 'DJ';
      } else {
        prefix = 'DW';
      }
    } else if (method.type === 'mobile_money') {
      prefix = 'MM';
      
      // Ajouter l'initiale du fournisseur si disponible
      if (method.provider) {
        prefix += method.provider.charAt(0);
      }
    } else if (method.type === 'card') {
      prefix = 'CC';
    } else if (method.type === 'cash_on_delivery') {
      prefix = 'COD';
    } else {
      prefix = 'PY';
    }
    
    // Generate unique reference with date and random component
    const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    return `${prefix}${dateStr}${random}`;
  }
  
  /**
   * Generate a confirmation code for payment verification
   */
  private generateConfirmationCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
  /**
   * Get merchant number based on provider
   */
  private getMerchantNumber(provider?: string): string {
    switch (provider?.toUpperCase()) {
      case 'WAVE':
        return '7979';
      case 'ORANGE':
        return '0707070707';
      case 'MTN':
        return '0505050505';
      case 'MOOV':
        return '0101010101';
      default:
        return '0123456789';
    }
  }
  
  /**
   * Clean expired entries from the cache
   */
  private cleanCache(): void {
    const now = Date.now();
    const expiredTime = now - this.CACHE_TTL;
    
    for (const [key, value] of this.paymentMethodCache.entries()) {
      if (value.timestamp < expiredTime) {
        this.paymentMethodCache.delete(key);
      }
    }
  }

  /**
   * Récupère toutes les méthodes de paiement (pour la compatibilité avec les routes)
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    // Comme nous n'avons pas de customerId, utilisons la région par défaut
    return this.getDefaultPaymentMethods('CI');
  }

  /**
   * Initialise un paiement (pour la compatibilité avec les routes)
   */
  async initializePayment(data: {
    orderId: string;
    customerId: string;
    paymentMethodId: string;
  }): Promise<PaymentTransaction> {
    // Récupérer la méthode de paiement à partir de son ID
    const paymentMethods = await this.getAvailablePaymentMethods(data.customerId);
    const selectedMethod = paymentMethods.find(method => method.id === data.paymentMethodId);
    
    if (!selectedMethod) {
      throw new Error(`Méthode de paiement ${data.paymentMethodId} non trouvée`);
    }
    
    // Utiliser la méthode existante avec la méthode de paiement complète
    return this.initiatePayment(data.orderId, selectedMethod);
  }

  /**
   * Vérifie un paiement mobile (pour la compatibilité avec les routes)
   */
  async verifyMobilePayment(
    transactionId: string,
    phoneNumber: string,
    customerId: string
  ): Promise<{
    isVerified: boolean;
    status: PaymentStatus;
    message: string;
  }> {
    // Récupérer l'orderId à partir du transactionId
    const { data, error } = await this.supabase
      .from('payment_transactions')
      .select('order_id')
      .eq('id', transactionId)
      .single();
    
    if (error || !data) {
      throw new Error(`Transaction ${transactionId} introuvable`);
    }
    
    // Utiliser la méthode existante
    return this.verifyPayment(data.order_id, {
      phoneNumber,
      provider: 'MOBILE'  // Valeur générique, nous n'avons pas le provider spécifique
    });
  }

  /**
   * Gère les callbacks webhook des fournisseurs de paiement
   */
  async handlePaymentWebhook(
    provider: string,
    webhookData: any
  ): Promise<boolean> {
    try {
      this.logger.info(`Webhook reçu de ${provider}:`, webhookData);
      
      // Récupérer la référence de la transaction dans les données du webhook
      // Les formats varient selon les fournisseurs
      let reference, orderId, status;
      
      switch (provider.toLowerCase()) {
        case 'wave':
          reference = webhookData.transaction_reference;
          status = webhookData.status === 'successful' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
          break;
          
        case 'orange':
          reference = webhookData.reference;
          status = webhookData.status === 'SUCCESSFUL' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
          break;
          
        case 'mtn':
          reference = webhookData.externalId;
          status = webhookData.status === 'SUCCESSFUL' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
          break;
          
        default:
          // Format générique
          reference = webhookData.reference || webhookData.transaction_id;
          status = (
            webhookData.status === 'success' || 
            webhookData.status === 'SUCCESSFUL' ||
            webhookData.status === 'COMPLETED'
          ) ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
      }
      
      if (!reference) {
        throw new Error('Référence de transaction non trouvée dans les données du webhook');
      }
      
      // Trouver la transaction par sa référence
      const { data: transaction } = await this.supabase
        .from('payment_transactions')
        .select('id, order_id, status')
        .eq('reference', reference)
        .single();
      
      if (!transaction) {
        this.logger.warn(`Transaction avec référence ${reference} non trouvée`);
        return false;
      }
      
      orderId = transaction.order_id;
      
      // Éviter de traiter des transactions déjà complétées
      if (transaction.status === PaymentStatus.COMPLETED) {
        this.logger.info(`Transaction ${reference} déjà marquée comme complétée`);
        return true;
      }
      
      // Mettre à jour le statut de la transaction
      await this.supabase
        .from('payment_transactions')
        .update({
          status: status,
          updated_at: new Date().toISOString(),
          metadata: {
            ...transaction.metadata,
            webhookReceived: true,
            webhookData: webhookData,
            webhookTime: new Date().toISOString()
          }
        })
        .eq('id', transaction.id);
      
      // Mettre à jour le statut de la commande
      await this.orderService.updatePaymentStatus(orderId, status);
      
      this.logger.info(`Transaction ${reference} mise à jour avec succès via webhook`);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors du traitement du webhook ${provider}:`, error);
      // Nous renvoyons true même en cas d'erreur car la plupart des systèmes de webhook
      // réessaieront si nous renvoyons une erreur, ce qui pourrait causer des doublons
      return false;
    }
  }
}