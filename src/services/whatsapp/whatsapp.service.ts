import { OpenAIService } from '../ai/openai.service';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import { ProductService } from '../product/product.service';
import { CustomerService } from '../customer/customer.service';
import { SessionManager } from '../../utils/session-manager';
import { Logger } from '../../utils/logger';

export interface WhatsAppMessage {
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'interactive' | 'template';
  content: any;
}

export class WhatsAppService {
  private openAIService: OpenAIService;
  private orderService: OrderService;
  private paymentService: PaymentService;
  private productService: ProductService;
  private customerService: CustomerService;
  private sessionManager: SessionManager;
  private logger: Logger;
  private messageRateLimit: Map<string, number>; // Track message rates by customer ID
  private readonly MAX_MESSAGES_PER_MINUTE = 15; // WhatsApp business API limit

  constructor() {
    this.openAIService = new OpenAIService();
    this.orderService = new OrderService();
    this.paymentService = new PaymentService();
    this.productService = new ProductService();
    this.customerService = new CustomerService();
    this.sessionManager = new SessionManager();
    this.logger = new Logger('WhatsAppService');
    this.messageRateLimit = new Map();
    
    // Clean rate limiting data every minute
    setInterval(() => this.cleanRateLimitData(), 60000);
  }

  async handleMessage(message: any, customerId: string): Promise<void> {
    try {
      // Extract the message content based on type
      const messageContent = this.extractMessageContent(message);
      
      // Get or create user session
      const session = await this.sessionManager.getSession(customerId);
      
      // Log incoming message
      this.logger.info(`Received message from ${customerId}`, {
        messageType: message.type,
        content: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : '')
      });
      
      // Process message with OpenAI
      const { response, intent, actions, suggestedReplies } = await this.openAIService.handleConversation(
        messageContent,
        customerId,
        session
      );

      // Handle actions based on intent
      await this.processActions(actions, customerId, session);
      
      // Update session context
      await this.sessionManager.updateSession(customerId, {
        ...session,
        lastActivity: new Date(),
        state: {
          ...session.state,
          sessionData: {
            ...session.state.sessionData,
            lastInteraction: new Date(),
            lastIntent: intent
          }
        }
      });

      // Send response back to WhatsApp based on context
      if (actions.some(action => action.type === 'SHOW_PRODUCTS' || action.type === 'SHOW_PRODUCT_DETAIL')) {
        // Products need special display
        await this.handleProductDisplay(customerId, actions.find(a => 
          a.type === 'SHOW_PRODUCTS' || a.type === 'SHOW_PRODUCT_DETAIL'
        ).payload);
      } else if (actions.some(action => action.type === 'PROCESS_PAYMENT' || action.type === 'SHOW_PAYMENT_METHODS')) {
        // Payment options need interactive elements
        await this.handlePaymentOptions(customerId, actions.find(a => 
          a.type === 'PROCESS_PAYMENT' || a.type === 'SHOW_PAYMENT_METHODS'
        ).payload);
      } else if (actions.some(action => action.type === 'CHECK_ORDER_STATUS' || action.type === 'SHOW_RECENT_ORDERS')) {
        // Order status display
        await this.handleOrderStatus(customerId, actions.find(a =>
          a.type === 'CHECK_ORDER_STATUS' || a.type === 'SHOW_RECENT_ORDERS'
        ).payload);
      } else {
        // Standard text response with possible quick reply buttons
        await this.sendTextWithSuggestions(customerId, response, suggestedReplies || this.getSuggestedReplies(intent));
      }
    } catch (error) {
      this.logger.error('Error handling WhatsApp message:', error);
      await this.sendWhatsAppMessage(
        customerId,
        {
          type: 'text',
          content: { body: "Désolé, une erreur s'est produite. Veuillez réessayer plus tard." }
        }
      );
    }
  }

  /**
   * Extract content from different message types
   */
  private extractMessageContent(message: any): string {
    if (!message) return '';
    
    if (message.type === 'text' && message.text) {
      return message.text.body || '';
    } else if (message.type === 'interactive') {
      // Extract response from button or list selection
      if (message.interactive.button_reply) {
        return message.interactive.button_reply.id;
      } else if (message.interactive.list_reply) {
        return message.interactive.list_reply.id;
      }
    } else if (message.type === 'image' && message.image) {
      // For image messages, we can return a placeholder
      return "[Image received]";
    } else if (message.type === 'document' && message.document) {
      return "[Document received]";
    } else if (message.type === 'audio' && message.audio) {
      return "[Audio received]";
    } else if (message.type === 'video' && message.video) {
      return "[Video received]";
    } else if (message.type === 'location' && message.location) {
      return `[Location received: ${message.location.latitude}, ${message.location.longitude}]`;
    }
    
    return '';
  }

  /**
   * Process actions returned by the AI service
   */
  private async processActions(
    actions: Array<{ type: string; payload: any }>, 
    customerId: string,
    session?: any
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'CREATE_ORDER':
            const order = await this.orderService.createOrder(
              customerId,
              action.payload.items
            );
            await this.sendOrderConfirmation(customerId, order);
            break;

          case 'PROCESS_PAYMENT':
            const methods = await this.paymentService.getAvailablePaymentMethods(customerId);
            if (action.payload.methodId) {
              const selectedMethod = methods.find(m => m.id === action.payload.methodId);
              if (selectedMethod) {
                const paymentInfo = await this.paymentService.initiatePayment(
                  action.payload.orderId,
                  selectedMethod
                );
                await this.sendPaymentInstructions(customerId, paymentInfo, selectedMethod);
              }
            } else {
              await this.sendPaymentOptions(customerId, methods, action.payload.orderId);
            }
            break;

          case 'SHOW_PAYMENT_METHODS':
            const paymentMethods = await this.paymentService.getAvailablePaymentMethods(customerId);
            await this.sendPaymentOptions(customerId, paymentMethods, action.payload.orderId);
            break;

          case 'CHECK_ORDER_STATUS':
            const orderDetails = await this.orderService.getOrder(action.payload.orderId);
            await this.sendOrderStatus(customerId, orderDetails);
            break;

          case 'SHOW_RECENT_ORDERS':
            await this.sendRecentOrders(customerId, action.payload);
            break;

          case 'SHOW_PRODUCTS':
            const products = action.payload;
            await this.sendProductCatalog(customerId, products);
            break;
            
          case 'SHOW_PRODUCT_DETAIL':
            await this.sendProductDetail(customerId, action.payload);
            break;
            
          case 'SHOW_SIMILAR_PRODUCTS':
            await this.sendSimilarProducts(customerId, action.payload);
            break;

          case 'CREATE_SUPPORT_TICKET':
            const ticketId = action.payload?.id || `TKT-${Date.now()}`;
            await this.sendWhatsAppMessage(customerId, {
              type: 'text',
              content: { 
                body: `Votre ticket de support #${ticketId} a été créé. Notre équipe vous contactera bientôt.` 
              }
            });
            break;
            
          case 'SHOW_RECOMMENDATIONS':
            await this.sendProductRecommendations(customerId, action.payload);
            break;
            
          case 'END_CONVERSATION':
            await this.sendWhatsAppMessage(customerId, {
              type: 'text',
              content: { 
                body: "Merci d'avoir échangé avec nous. N'hésitez pas à revenir si vous avez d'autres questions!" 
              }
            });
            break;

          default:
            this.logger.warn(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        this.logger.error(`Error processing action ${action.type}:`, error);
      }
    }
  }

  /**
   * Send message to WhatsApp API with rate limiting
   */
  private async sendWhatsAppMessage(customerId: string, message: WhatsAppMessage): Promise<void> {
    try {
      // Apply rate limiting
      if (!this.checkAndUpdateRateLimit(customerId)) {
        this.logger.warn(`Rate limit exceeded for customer ${customerId}`);
        // We'll proceed anyway but log the warning
      }
      
      const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      
      let requestBody: any = {
        messaging_product: 'whatsapp',
        to: customerId,
        recipient_type: 'individual',
      };
      
      // Add message specific content based on type
      switch (message.type) {
        case 'text':
          requestBody = {
            ...requestBody,
            type: 'text',
            text: message.content
          };
          break;
          
        case 'image':
          requestBody = {
            ...requestBody,
            type: 'image',
            image: message.content
          };
          break;
          
        case 'audio':
          requestBody = {
            ...requestBody,
            type: 'audio',
            audio: message.content
          };
          break;
          
        case 'video':
          requestBody = {
            ...requestBody,
            type: 'video',
            video: message.content
          };
          break;
          
        case 'document':
          requestBody = {
            ...requestBody,
            type: 'document',
            document: message.content
          };
          break;
          
        case 'location':
          requestBody = {
            ...requestBody,
            type: 'location',
            location: message.content
          };
          break;
          
        case 'interactive':
          requestBody = {
            ...requestBody,
            type: 'interactive',
            interactive: message.content
          };
          break;
          
        case 'template':
          requestBody = {
            ...requestBody,
            type: 'template',
            template: message.content
          };
          break;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${response.statusText}, Details: ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      this.logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Rate limiting implementation
   */
  private checkAndUpdateRateLimit(customerId: string): boolean {
    const now = Date.now();
    const currentCount = this.messageRateLimit.get(customerId) || 0;
    
    this.messageRateLimit.set(customerId, currentCount + 1);
    
    return currentCount < this.MAX_MESSAGES_PER_MINUTE;
  }
  
  private cleanRateLimitData(): void {
    this.messageRateLimit.clear();
  }

  // Enhanced messaging methods for rich experiences

  /**
   * Send text message with suggested quick replies
   */
  private async sendTextWithSuggestions(
    customerId: string, 
    message: string, 
    suggestions: string[] = []
  ): Promise<void> {
    // If we have suggestions, send as interactive buttons
    if (suggestions && suggestions.length > 0) {
      // WhatsApp limits to 3 buttons max
      const buttons = suggestions.slice(0, 3).map((suggestion, index) => ({
        type: 'reply',
        reply: {
          id: `suggestion_${index}`,
          title: suggestion.substring(0, 20) // WhatsApp button title limit
        }
      }));

      await this.sendWhatsAppMessage(customerId, {
        type: 'interactive',
        content: {
          type: 'button',
          body: {
            text: message.substring(0, 1024) // WhatsApp message limit
          },
          action: {
            buttons: buttons
          }
        }
      });
    } else {
      // Otherwise send as plain text
      await this.sendWhatsAppMessage(customerId, {
        type: 'text',
        content: { body: message }
      });
    }
  }

  /**
   * Get contextual quick replies based on intent
   */
  private getSuggestedReplies(intent: string): string[] {
    // Generate contextual quick replies based on intent
    switch (intent) {
      case 'CATALOG_BROWSE':
        return ["Voir les produits", "Catégories", "Filtrer par prix"];
      case 'PRODUCT_QUERY':
        return ["Plus d'infos", "Prix", "Disponibilité"];
      case 'ORDER_PLACEMENT':
      case 'ORDER_CREATION': // Supporting both naming conventions
        return ["Confirmer commande", "Modifier panier", "Options de livraison"];
      case 'ORDER_STATUS':
        return ["Suivre commande", "Contacter support", "Annuler commande"];
      case 'PAYMENT':
        return ["Aide au paiement", "Autres méthodes", "Contacter support"];
      case 'CUSTOMER_SUPPORT':
        return ["FAQ", "Mes commandes", "Parler à un agent"];
      default:
        return ["Voir les produits", "Mes commandes", "Aide"];
    }
  }

  // Product display methods
  
  /**
   * Handle product display - single product or catalog
   */
  private async handleProductDisplay(customerId: string, products: any | any[]): Promise<void> {
    // Check if it's a single product object or an array
    if (!Array.isArray(products)) {
      await this.sendProductDetail(customerId, products);
      return;
    }
    
    if (!products || products.length === 0) {
      await this.sendWhatsAppMessage(customerId, {
        type: 'text', 
        content: { body: "Désolé, aucun produit n'a été trouvé correspondant à votre recherche." }
      });
      return;
    }
    
    if (products.length === 1) {
      // Single product detail view
      await this.sendProductDetail(customerId, products[0]);
    } else {
      // Product catalog view
      await this.sendProductCatalog(customerId, products);
    }
  }

  /**
   * Handle payment options display and selection
   */
  private async handlePaymentOptions(customerId: string, payload: any): Promise<void> {
    // Check if it's a payment processing result or payment methods list
    if (payload.payment) {
      // It's a payment result
      const { payment, method } = payload;
      await this.sendPaymentInstructions(customerId, payment, method);
    } else if (payload.methods) {
      // It's a list of payment methods
      await this.sendPaymentOptions(customerId, payload.methods, payload.orderId);
    } else {
      // Fallback for legacy payload format
      await this.sendPaymentOptions(customerId, payload, payload.orderId || 'unknown');
    }
  }

  /**
   * Handle order status display
   */
  private async handleOrderStatus(customerId: string, payload: any): Promise<void> {
    if (Array.isArray(payload)) {
      // List of orders
      await this.sendRecentOrders(customerId, payload);
    } else {
      // Single order
      await this.sendOrderStatus(customerId, payload);
    }
  }
  
  /**
   * Send product catalog view
   */
  private async sendProductCatalog(
    customerId: string, 
    products: Array<any>
  ): Promise<void> {
    // First send a header message
    await this.sendWhatsAppMessage(customerId, {
      type: 'text',
      content: {
        body: `📋 *${products.length} Produits Trouvés*\n` +
              `Voici les produits qui correspondent à votre recherche:`
      }
    });
    
    // WhatsApp has list message limitations, so we'll work within these
    if (products.length <= 10) {
      // We can show products in a list message
      const sections = [{
        title: "Produits disponibles",
        rows: products.slice(0, 10).map(product => ({
          id: `product_${product.id}`,
          title: product.name.substring(0, 24), // WhatsApp title limit
          description: `${product.price}`.substring(0, 72) // WhatsApp description limit
        }))
      }];
      
      await this.sendWhatsAppMessage(customerId, {
        type: 'interactive',
        content: {
          type: 'list',
          body: {
            text: "Sélectionnez un produit pour voir les détails:"
          },
          action: {
            button: "Voir les produits",
            sections: sections
          }
        }
      });
    } else {
      // Too many products for one list, show first few with most important info
      // and provide category filtering options
      
      // Extract categories from products
      const categories = [...new Set(products.map(p => p.category))].slice(0, 3);
      
      // Show first 3 products individually
      for (const product of products.slice(0, 3)) {
        // Send product image
        if (product.imageUrl) {
          await this.sendWhatsAppMessage(customerId, {
            type: 'image',
            content: {
              link: product.imageUrl,
              caption: `${product.name}: ${product.price}`
            }
          });
          
          // Brief pause to avoid flooding
          await new Promise(r => setTimeout(r, 300));
        }
      }
      
      // Then offer category filtering
      const buttons = categories.map(category => ({
        type: 'reply',
        reply: {
          id: `filter_${category}`,
          title: category.substring(0, 20)
        }
      }));
      
      await this.sendWhatsAppMessage(customerId, {
        type: 'interactive',
        content: {
          type: 'button',
          body: {
            text: `Nous avons trouvé ${products.length} produits. Filtrer par catégorie:`
          },
          action: {
            buttons: buttons
          }
        }
      });
    }
  }
  
  /**
   * Send detailed product view
   */
  private async sendProductDetail(customerId: string, product: any): Promise<void> {
    // Strategy: Send sequential messages for rich product presentation
    
    // Step 1: Send product image if available
    if (product.imageUrl) {
      await this.sendWhatsAppMessage(customerId, {
        type: 'image',
        content: {
          link: product.imageUrl,
          caption: product.name
        }
      });
    }
    
    // Step 2: Send product details with action buttons
    const productDescription = `*${product.name}*\n\n` +
                              `💰 *Prix:* ${product.price}\n` +
                              `📦 *Stock:* ${product.inStock ? '✅ Disponible' : '❌ Rupture de stock'}\n\n` +
                              `${product.description ? product.description.substring(0, 200) : ''}`;
                              
    await this.sendWhatsAppMessage(customerId, {
      type: 'interactive',
      content: {
        type: 'button',
        body: {
          text: productDescription
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: `add_cart_${product.id}`,
                title: "Ajouter au panier"
              }
            },
            {
              type: 'reply',
              reply: {
                id: `buy_now_${product.id}`,
                title: "Acheter maintenant" 
              }
            },
            {
              type: 'reply',
              reply: {
                id: `more_info_${product.id}`,
                title: "Plus d'infos"
              }
            }
          ]
        }
      }
    });
  }

  /**
   * Send similar products suggestions
   */
  private async sendSimilarProducts(customerId: string, products: any[]): Promise<void> {
    if (!products || products.length === 0) return;
    
    await this.sendWhatsAppMessage(customerId, {
      type: 'text',
      content: { body: "📌 *Produits similaires qui pourraient vous intéresser:*" }
    });
    
    // Send up to 3 similar products with images and basic info
    for (const product of products.slice(0, 3)) {
      if (product.imageUrl) {
        await this.sendWhatsAppMessage(customerId, {
          type: 'image',
          content: {
            link: product.imageUrl,
            caption: `${product.name}: ${product.price}`
          }
        });
      } else {
        await this.sendWhatsAppMessage(customerId, {
          type: 'text',
          content: { 
            body: `✨ *${product.name}*\nPrix: ${product.price}` 
          }
        });
      }
      
      // Brief pause between products
      await new Promise(r => setTimeout(r, 300));
    }
    
    // Add a "See more" button if there are more products
    if (products.length > 3) {
      await this.sendWhatsAppMessage(customerId, {
        type: 'interactive',
        content: {
          type: 'button',
          body: {
            text: `Voir ${products.length - 3} autres produits similaires?`
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'see_more_similar',
                  title: "Voir plus"
                }
              }
            ]
          }
        }
      });
    }
  }

  /**
   * Send product recommendations
   */
  private async sendProductRecommendations(customerId: string, products: any[]): Promise<void> {
    if (!products || products.length === 0) return;
    
    await this.sendWhatsAppMessage(customerId, {
      type: 'text',
      content: { body: "🌟 *Recommandé pour vous:*" }
    });
    
    // For recommendations, use list format if possible
    if (products.length <= 10) {
      const sections = [{
        title: "Recommandations",
        rows: products.slice(0, 10).map(product => ({
          id: `product_${product.id}`,
          title: product.name.substring(0, 24),
          description: `${product.price}`.substring(0, 72)
        }))
      }];
      
      await this.sendWhatsAppMessage(customerId, {
        type: 'interactive',
        content: {
          type: 'list',
          body: {
            text: "Des produits sélectionnés en fonction de vos préférences:"
          },
          action: {
            button: "Voir recommandations",
            sections: sections
          }
        }
      });
    } else {
      // Too many products, show top 3 with images
      for (const product of products.slice(0, 3)) {
        if (product.imageUrl) {
          await this.sendWhatsAppMessage(customerId, {
            type: 'image',
            content: {
              link: product.imageUrl,
              caption: `${product.name}: ${product.price}`
            }
          });
        }
        
        // Brief pause between products
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  // Payment handling methods - Updated to remove bank transfers
  
  /**
   * Send payment method options
   */
  private async sendPaymentOptions(
    customerId: string, 
    methods: any[], 
    orderId: string
  ): Promise<void> {
    // African markets typically have various payment methods
    // Group them by type for better organization
    const mobileMoneyMethods = methods.filter(m => m.type === 'mobile_money');
    const otherMethods = methods.filter(m => m.type !== 'mobile_money' && m.type !== 'bank_transfer');
    
    // First, send an explanatory message
    await this.sendWhatsAppMessage(customerId, {
      type: 'text',
      content: {
        body: `💳 *Options de Paiement*\n\n` +
              `Veuillez choisir votre méthode de paiement préférée pour votre commande #${orderId}`
      }
    });
    
    // Mobile money options (common in Africa) are our primary focus
    if (mobileMoneyMethods.length > 0) {
      const buttons = mobileMoneyMethods.slice(0, 3).map(method => ({
        type: 'reply',
        reply: {
          id: `pay_${method.id}_${orderId}`,
          title: method.name.substring(0, 20)
        }
      }));
      
      await this.sendWhatsAppMessage(customerId, {
        type: 'interactive',
        content: {
          type: 'button',
          body: {
            text: "Options Mobile Money:"
          },
          action: {
            buttons: buttons
          }
        }
      });
    }
    
    // For other payment methods, use a list if there are many
    if (otherMethods.length > 0) {
      // If just a few, use buttons
      if (otherMethods.length <= 3) {
        const buttons = otherMethods.map(method => ({
          type: 'reply',
          reply: {
            id: `pay_${method.id}_${orderId}`,
            title: method.name.substring(0, 20)
          }
        }));
        
        await this.sendWhatsAppMessage(customerId, {
          type: 'interactive',
          content: {
            type: 'button',
            body: {
              text: "Autres options de paiement:"
            },
            action: {
              buttons: buttons
            }
          }
        });
      } else {
        // If more than 3, use a list format
        const sections = [{
          title: "Options de paiement",
          rows: otherMethods.slice(0, 10).map(method => ({
            id: `pay_${method.id}_${orderId}`,
            title: method.name.substring(0, 24),
            description: this.getPaymentDescription(method.type)
          }))
        }];
        
        await this.sendWhatsAppMessage(customerId, {
          type: 'interactive',
          content: {
            type: 'list',
            body: {
              text: "Choisissez une option de paiement:"
            },
            action: {
              button: "Voir les options",
              sections: sections
            }
          }
        });
      }
    }
  }
  
  /**
   * Get payment method description
   */
  private getPaymentDescription(type: string): string {
    switch(type) {
      case 'mobile_money': return 'Paiement via mobile';
      case 'card': return 'Carte bancaire';
      case 'cash_on_delivery': return 'Paiement à la livraison';
      default: return 'Autre méthode de paiement';
    }
  }
  
  /**
   * Send payment instructions
   */
  private async sendPaymentInstructions(
    customerId: string, 
    paymentInfo: any,
    method: any
  ): Promise<void> {
    // For mobile money (common in Africa), we provide clear instructions
    if (method.type === 'mobile_money') {
      await this.sendWhatsAppMessage(customerId, {
        type: 'text',
        content: {
          body: `*Instructions de Paiement ${method.name}*\n\n` +
                `1. Ouvrez l'application ${method.name} sur votre téléphone\n` +
                `2. Sélectionnez "Payer"\n` +
                `3. Entrez le numéro: *${paymentInfo.merchantNumber || '123456789'}*\n` +
                `4. Montant: *${paymentInfo.amount} ${paymentInfo.currency || 'FCFA'}*\n` +
                `5. Référence: *${paymentInfo.reference}*\n\n` +
                `Une fois le paiement effectué, votre commande sera traitée automatiquement.`
        }
      });
    } 
    // For payment links (cards etc)
    else {
      await this.sendWhatsAppMessage(customerId, {
        type: 'text',
        content: {
          body: `*Finaliser votre paiement*\n\n` +
                `Veuillez cliquer sur le lien suivant pour finaliser votre paiement de ` +
                `${paymentInfo.amount} ${paymentInfo.currency || 'FCFA'}:\n\n` +
                `${paymentInfo.paymentLink}`
        }
      });
    }
    
        // Add follow-up options
        await this.sendWhatsAppMessage(customerId, {
          type: 'interactive',
          content: {
            type: 'button',
            body: {
              text: "Besoin d'aide avec votre paiement?"
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: 'payment_help',
                    title: "Aide au paiement"
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: 'payment_other_method',
                    title: "Autre méthode"
                  }
                }
              ]
            }
          }
        });
      }
      
      // Order handling methods
      
      /**
       * Send order confirmation
       */
      private async sendOrderConfirmation(customerId: string, order: any): Promise<void> {
        // Build a nicely formatted order confirmation
        const itemsList = order.items.map((item: any) => 
          `• ${item.quantity}x ${item.name} - ${item.price * item.quantity}`
        ).join('\n');
        
        const orderSummary = 
          `🛍️ *Confirmation de Commande #${order.id}*\n\n` +
          `📦 *Articles:*\n${itemsList}\n\n` +
          `💰 *Sous-total:* ${order.totalAmount}\n` +
          `🚚 *Livraison:* ${order.shipping || 'À calculer'}\n` +
          `💵 *Total:* ${order.totalAmount + (order.shipping || 0)}\n\n` +
          `📅 *Date de commande:* ${new Date().toLocaleDateString('fr-FR')}\n` +
          `🏠 *Adresse de livraison:*\n${this.formatAddress(order.shippingAddress)}`;
        
        await this.sendWhatsAppMessage(customerId, {
          type: 'text',
          content: { body: orderSummary }
        });
        
        // Offer next actions
        await this.sendWhatsAppMessage(customerId, {
          type: 'interactive',
          content: {
            type: 'button',
            body: {
              text: "Que souhaitez-vous faire maintenant?"
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: `pay_order_${order.id}`,
                    title: "Payer maintenant"
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: `track_order_${order.id}`,
                    title: "Suivre ma commande"
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: 'continue_shopping',
                    title: "Continuer mes achats"
                  }
                }
              ]
            }
          }
        });
      }
      
      /**
       * Format address for display
       */
      private formatAddress(address: any): string {
        if (!address) return 'Non spécifiée';
        
        return `${address.street || ''}\n` +
               `${address.city || ''} ${address.postalCode || ''}\n` +
               `${address.country || ''}\n` +
               `${address.instructions ? `Instructions: ${address.instructions}` : ''}`;
      }
    
      /**
       * Send recent orders list
       */
      private async sendRecentOrders(customerId: string, orders: any[]): Promise<void> {
        if (!orders || orders.length === 0) {
          await this.sendWhatsAppMessage(customerId, {
            type: 'text',
            content: { body: "Vous n'avez pas encore passé de commande chez nous." }
          });
          return;
        }
        
        // First send a header message
        await this.sendWhatsAppMessage(customerId, {
          type: 'text',
          content: { body: "📋 *Vos commandes récentes:*" }
        });
        
        // If we have just a few orders, we can show details for each
        if (orders.length <= 3) {
          for (const order of orders) {
            await this.sendOrderStatus(customerId, order);
            
            // Brief pause between orders
            await new Promise(r => setTimeout(r, 300));
          }
        } else {
          // If we have many orders, use a list format
          const sections = [{
            title: "Vos commandes",
            rows: orders.slice(0, 10).map(order => ({
              id: `order_${order.id}`,
              title: `Commande #${order.id}`,
              description: `${this.translateOrderStatus(order.status)} - ${new Date(order.createdAt).toLocaleDateString('fr-FR')}`
            }))
          }];
          
          await this.sendWhatsAppMessage(customerId, {
            type: 'interactive',
            content: {
              type: 'list',
              body: {
                text: "Sélectionnez une commande pour voir les détails:"
              },
              action: {
                button: "Voir les commandes",
                sections: sections
              }
            }
          });
        }
      }
      
      /**
       * Send order status details
       */
      private async sendOrderStatus(customerId: string, order: any): Promise<void> {
        // Use status icons for better visual communication
        const statusIcons = {
          'DRAFT': '📝',
          'PENDING': '⏳',
          'CONFIRMED': '✅',
          'PROCESSING': '🔄',
          'SHIPPED': '🚚',
          'DELIVERED': '📦',
          'CANCELLED': '❌',
          'RETURNED': '↩️'
        };
        
        const statusIcon = statusIcons[order.status] || '📋';
        const formattedDate = new Date(order.createdAt).toLocaleDateString('fr-FR');
        
        const statusMessage = 
          `${statusIcon} *État de commande #${order.id}*\n\n` +
          `*Statut:* ${this.translateOrderStatus(order.status)}\n` +
          `*Date:* ${formattedDate}\n` +
          `*Montant:* ${order.totalAmount} ${order.currency || 'FCFA'}\n` +
          `*Paiement:* ${this.translatePaymentStatus(order.paymentStatus)}\n`;
        
        // Add tracking info if available
        const trackingInfo = order.metadata?.trackingNumber ? 
          `\n📍 *Suivi:* ${order.metadata.trackingNumber}\n` +
          `🗓️ *Livraison estimée:* ${order.metadata.estimatedDelivery || 'Non disponible'}\n` : '';
        
        await this.sendWhatsAppMessage(customerId, {
          type: 'text',
          content: { body: statusMessage + trackingInfo }
        });
        
        // Offer relevant actions based on order status
        const actionButtons = [];
        
        if (['CONFIRMED', 'PROCESSING'].includes(order.status) && order.paymentStatus !== 'COMPLETED') {
          actionButtons.push({
            type: 'reply',
            reply: {
              id: `pay_order_${order.id}`,
              title: "Payer maintenant"
            }
          });
        }
        
        if (['CONFIRMED', 'PROCESSING'].includes(order.status)) {
          actionButtons.push({
            type: 'reply',
            reply: {
              id: `cancel_order_${order.id}`,
              title: "Annuler la commande"
            }
          });
        }
        
        actionButtons.push({
          type: 'reply',
          reply: {
            id: 'contact_support',
            title: "Contacter le support"
          }
        });
        
        // Only send interactive buttons if we have actions to offer
        if (actionButtons.length > 0) {
          await this.sendWhatsAppMessage(customerId, {
            type: 'interactive',
            content: {
              type: 'button',
              body: {
                text: "Que souhaitez-vous faire avec cette commande?"
              },
              action: {
                buttons: actionButtons.slice(0, 3) // WhatsApp limits to 3 buttons
              }
            }
          });
        }
      }
      
      /**
       * Translate order status to French
       */
      private translateOrderStatus(status: string): string {
        const statusMap: {[key: string]: string} = {
          'DRAFT': 'Brouillon',
          'PENDING': 'En attente',
          'CONFIRMED': 'Confirmée',
          'PROCESSING': 'En traitement',
          'SHIPPED': 'Expédiée',
          'DELIVERED': 'Livrée',
          'CANCELLED': 'Annulée',
          'RETURNED': 'Retournée'
        };
        return statusMap[status] || status;
      }
      
      /**
       * Translate payment status to French
       */
      private translatePaymentStatus(status: string): string {
        const statusMap: {[key: string]: string} = {
          'PENDING': 'En attente',
          'PROCESSING': 'En cours',
          'COMPLETED': 'Complété',
          'FAILED': 'Échoué',
          'REFUNDED': 'Remboursé'
        };
        return statusMap[status] || status;
      }
    
      /**
       * Send product story with sequential messages for dramatic effect
       */
      async sendProductStory(customerId: string, product: any): Promise<void> {
        // First: Teaser message
        await this.sendWhatsAppMessage(customerId, {
          type: 'text', 
          content: { body: `🌟 *Découvrez* notre ${product.name}...` }
        });
        
        // Short delay for dramatic effect
        await new Promise(r => setTimeout(r, 800));
        
        // Second: Product image
        if (product.imageUrl) {
          await this.sendWhatsAppMessage(customerId, {
            type: 'image',
            content: {
              link: product.imageUrl,
              caption: product.name
            }
          });
        }
        
        // Another short delay
        await new Promise(r => setTimeout(r, 1000));
        
        // Third: Story and call to action
        const story = product.marketingStory || 
          `Ce produit ${product.name} est l'un de nos articles les plus populaires. ` +
          `Il offre une qualité exceptionnelle et une grande valeur.`;
        
        await this.sendWhatsAppMessage(customerId, {
          type: 'text',
          content: { body: story }
        });
        
        // Final step: Call to action buttons
        await this.sendWhatsAppMessage(customerId, {
          type: 'interactive',
          content: {
            type: 'button',
            body: {
              text: "Intéressé(e) par ce produit?"
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: `view_product_${product.id}`,
                    title: "Voir détails"
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: `add_cart_${product.id}`,
                    title: "Ajouter au panier"
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: 'see_similar',
                    title: "Produits similaires"
                  }
                }
              ]
            }
          }
        });
      }
    }