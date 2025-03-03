import OpenAI from 'openai';
import { 
  Intent, 
  IntentType, 
  MessageContext, 
  ConversationState,
  CustomerPreferences,
  DEFAULT_PREFERENCES,
  Message
} from '../../types/ai.types';
import { ConversationService } from '../context/conversation.service';
import { ProductService } from '../product/product.service';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import { CustomerService } from '../customer/customer.service';
import { Logger } from '../../utils/logger';
import { createIntentPrompt, createResponsePrompt } from './prompts';

export interface AIResponse {
  response: string;
  intent: IntentType;
  suggestedReplies?: string[]; // Propriété ajoutée pour corriger l'erreur TypeScript
  actions: Array<{
    type: string;
    payload: any;
  }>;
}

export class OpenAIService {
  private openai: OpenAI;
  private conversationService: ConversationService;
  private productService: ProductService;
  private orderService: OrderService;
  private paymentService: PaymentService;
  private customerService: CustomerService;
  private logger: Logger;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OpenAI API key');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.conversationService = new ConversationService();
    this.productService = new ProductService();
    this.orderService = new OrderService();
    this.paymentService = new PaymentService();
    this.customerService = new CustomerService();
    this.logger = new Logger('OpenAIService');
  }

  /**
   * Main entry point for handling WhatsApp messages
   * @param message User's message content
   * @param customerId Customer identifier
   * @param session Optional session data
   */
  async handleConversation(
    message: string,
    customerId: string,
    session?: any
  ): Promise<AIResponse> {
    try {
      this.logger.log(`Processing message from ${customerId}: ${message}`);
      
      // Check if this is a button/list response ID rather than natural language
      const isInteractiveResponse = this.isInteractiveResponseId(message);
      
      // 1. Get customer context and preferences
      const [preferences, context, state] = await Promise.all([
        this.customerService.getCustomerPreferences(customerId),
        this.conversationService.getConversationContext(customerId),
        session || this.conversationService.getConversationState(customerId)
      ]);

      // 2. Determine customer intent
      let intent: Intent;
      if (isInteractiveResponse) {
        intent = this.handleInteractiveResponse(message, context);
      } else {
        intent = await this.interpretMessage(message, preferences, context);
      }

      // 3. Process actions based on intent
      const actions = await this.processActions(intent, customerId, state);

      // 4. Generate response based on intent and actions
      const response = await this.generateResponse(intent, preferences, actions);

      // 5. Generate suggested replies if appropriate
      const suggestedReplies = this.getSuggestedReplies(intent.type, actions);

      // 6. Update conversation context with this interaction
      await this.updateConversationContext(customerId, message, response, intent, actions);

      return {
        response,
        intent: intent.type,
        suggestedReplies,
        actions
      };
    } catch (error) {
      this.logger.error('Error handling WhatsApp message:', error);
      
      // Return graceful failure response
      return {
        response: "Désolé, une erreur s'est produite. Veuillez réessayer plus tard.",
        intent: 'UNKNOWN',
        suggestedReplies: ["Aide", "Réessayer", "Contacter support"],
        actions: [{ type: 'ERROR', payload: { message: error.message } }]
      };
    }
  }

  /**
   * Detect if a message is an interactive button/list response
   */
  private isInteractiveResponseId(message: string): boolean {
    const interactivePrefixes = [
      'product_', 'add_cart_', 'buy_now_', 'pay_', 'filter_', 
      'track_order_', 'cancel_order_', 'suggestion_'
    ];
    
    return interactivePrefixes.some(prefix => message.startsWith(prefix));
  }

  /**
   * Extract intent from interactive button responses
   */
  private handleInteractiveResponse(message: string, context: MessageContext): Intent {
    // Extract action type and ID from button response
    let actionType: string, actionId: string;
    
    if (message.includes('_')) {
      const parts = message.split('_');
      actionType = parts[0];
      actionId = parts.slice(1).join('_');
    } else {
      actionType = 'unknown';
      actionId = message;
    }
    
    // Map common button actions to intents
    switch (actionType) {
      case 'product':
        return {
          type: 'PRODUCT_QUERY',
          confidence: 1.0,
          parameters: { productId: actionId },
          context: {
            previousIntent: context.lastIntent?.type,
            orderInProgress: !!context.currentOrder,
            productDiscussion: true
          }
        };
        
      case 'add':
      case 'cart':
      case 'buy':
        return {
          type: 'ORDER_PLACEMENT',
          confidence: 1.0,
          parameters: { 
            productId: actionId,
            quantity: 1,
            action: actionType === 'buy' ? 'buy_now' : 'add_to_cart'
          },
          context: {
            previousIntent: context.lastIntent?.type,
            orderInProgress: true,
            productDiscussion: true
          }
        };
        
      case 'pay':
        return {
          type: 'PAYMENT',
          confidence: 1.0,
          parameters: { methodId: actionId },
          context: {
            previousIntent: context.lastIntent?.type,
            orderInProgress: true,
            productDiscussion: false
          }
        };
        
      case 'track':
        return {
          type: 'ORDER_STATUS',
          confidence: 1.0,
          parameters: { orderId: actionId },
          context: {
            previousIntent: context.lastIntent?.type,
            orderInProgress: false,
            productDiscussion: false
          }
        };
        
      case 'filter':
        return {
          type: 'CATALOG_BROWSE',
          confidence: 1.0,
          parameters: { category: actionId },
          context: {
            previousIntent: context.lastIntent?.type,
            orderInProgress: false,
            productDiscussion: true
          }
        };
        
      case 'suggestion':
        // Handle quick replies/suggestions based on context
        return this.getIntentFromSuggestion(actionId, context);
        
      default:
        // For any other button types, use context to infer intent
        if (message.includes('support') || message.includes('help')) {
          return {
            type: 'CUSTOMER_SUPPORT',
            confidence: 0.9,
            parameters: {},
            context: {
              previousIntent: context.lastIntent?.type,
              orderInProgress: !!context.currentOrder,
              productDiscussion: false
            }
          };
        }
        
        // Default to catalog browsing
        return {
          type: 'CATALOG_BROWSE',
          confidence: 0.6,
          parameters: {},
          context: {
            previousIntent: context.lastIntent?.type,
            orderInProgress: !!context.currentOrder,
            productDiscussion: true
          }
        };
    }
  }

  /**
   * Get intent based on suggestion button selection
   */
  private getIntentFromSuggestion(suggestionId: string, context: MessageContext): Intent {
    // Common suggestion patterns - adapt based on your app's actual suggestion patterns
    if (suggestionId === '0' || suggestionId.includes('product')) {
      return {
        type: 'CATALOG_BROWSE',
        confidence: 0.9,
        parameters: {},
        context: {
          previousIntent: context.lastIntent?.type,
          orderInProgress: !!context.currentOrder,
          productDiscussion: true
        }
      };
    } else if (suggestionId === '1' || suggestionId.includes('order')) {
      return {
        type: 'ORDER_STATUS',
        confidence: 0.9,
        parameters: {},
        context: {
          previousIntent: context.lastIntent?.type,
          orderInProgress: !!context.currentOrder,
          productDiscussion: false
        }
      };
    } else if (suggestionId === '2' || suggestionId.includes('help') || suggestionId.includes('support')) {
      return {
        type: 'CUSTOMER_SUPPORT',
        confidence: 0.9,
        parameters: {},
        context: {
          previousIntent: context.lastIntent?.type,
          orderInProgress: !!context.currentOrder,
          productDiscussion: false
        }
      };
    }

    // Default intent if we can't determine from suggestion
    return {
      type: 'UNKNOWN',
      confidence: 0.3,
      parameters: {},
      context: {
        previousIntent: context.lastIntent?.type,
        orderInProgress: !!context.currentOrder,
        productDiscussion: false
      }
    };
  }

  /**
   * Use GPT to interpret natural language user messages
   */
  private async interpretMessage(
    message: string,
    preferences: CustomerPreferences,
    context: MessageContext
  ): Promise<Intent> {
    try {
      // Create intent classification prompt
      const prompt = createIntentPrompt(message, preferences, context);
      
      // Call OpenAI with appropriate parameters
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });

      const result = completion.choices[0]?.message?.content;
      if (!result) {
        throw new Error('Failed to get intent from OpenAI');
      }

      // Parse JSON response
      try {
        const parsedIntent: Intent = JSON.parse(result);
        return parsedIntent;
      } catch (parseError) {
        this.logger.error('Error parsing OpenAI response:', parseError);
        this.logger.error('Raw response:', result);
        
        // Return fallback intent when JSON parsing fails
        return {
          type: 'UNKNOWN',
          confidence: 0.5,
          parameters: {},
          context: {
            orderInProgress: false,
            productDiscussion: false
          }
        };
      }
    } catch (error) {
      this.logger.error('Error in intent classification:', error);
      
      // Return fallback intent on error
      return {
        type: 'UNKNOWN',
        confidence: 0.3,
        parameters: {},
        context: {
          orderInProgress: false,
          productDiscussion: false
        }
      };
    }
  }

  /**
   * Process actions based on detected intent
   */
  private async processActions(
    intent: Intent,
    customerId: string,
    state: ConversationState
  ): Promise<Array<{ type: string; payload: any }>> {
    const actions = [];

    try {
      switch (intent.type) {
        case 'CATALOG_BROWSE':
          // Handle product catalog browsing
          const products = await this.productService.searchProducts({
            term: intent.parameters.term,
            category: intent.parameters.category,
            priceRange: intent.parameters.priceRange,
            limit: 5
          });
          
          actions.push({ type: 'SHOW_PRODUCTS', payload: products });
          break;

        case 'PRODUCT_QUERY':
          // Handle specific product queries
          if (intent.parameters.productId) {
            // Get single product details
            const product = await this.productService.getProduct(intent.parameters.productId);
            actions.push({ type: 'SHOW_PRODUCT_DETAIL', payload: product });
            
            // Get similar products
            const similar = await this.productService.getSimilarProducts(intent.parameters.productId);
            if (similar && similar.length > 0) {
              actions.push({ type: 'SHOW_SIMILAR_PRODUCTS', payload: similar });
            }
          } else {
            // Search for products
            const products = await this.productService.searchProducts({
              term: intent.parameters.term,
              category: intent.parameters.category
            });
            actions.push({ type: 'SHOW_PRODUCTS', payload: products });
          }
          break;

        case 'ORDER_PLACEMENT':
          // Handle order placement
          const orderData = {
            customerId,
            items: intent.parameters.items || [
              {
                productId: intent.parameters.productId,
                quantity: intent.parameters.quantity || 1
              }
            ],
            shippingAddress: intent.parameters.shippingAddress,
            paymentMethod: intent.parameters.paymentMethod
          };
          
          const order = await this.orderService.createOrder(customerId, orderData);
          actions.push({ type: 'CREATE_ORDER', payload: order });
          break;

        case 'ORDER_STATUS':
          // Get order status
          const orderId = intent.parameters.orderId || state?.activeOrder?.id;
          if (orderId) {
            const orderDetails = await this.orderService.getOrder(orderId);
            actions.push({ type: 'CHECK_ORDER_STATUS', payload: orderDetails });
          } else {
            // Get recent orders if no specific order ID
            const recentOrders = await this.orderService.getCustomerOrders(customerId);
            actions.push({ type: 'SHOW_RECENT_ORDERS', payload: recentOrders });
          }
          break;

        case 'PAYMENT':
          // Handle payment processing
          if (intent.parameters.methodId) {
            // Process a specific payment method
            const methods = await this.paymentService.getAvailablePaymentMethods(customerId);
            const selectedMethod = methods.find(m => m.id === intent.parameters.methodId);
            
            if (selectedMethod) {
              const orderId = intent.parameters.orderId || state?.activeOrder?.id;
              if (orderId) {
                const payment = await this.paymentService.initiatePayment(orderId, selectedMethod);
                actions.push({ 
                  type: 'PROCESS_PAYMENT', 
                  payload: { 
                    payment, 
                    method: selectedMethod,
                    orderId
                  } 
                });
              }
            }
          } else {
            // Show payment options
            const methods = await this.paymentService.getAvailablePaymentMethods(customerId);
            const orderId = intent.parameters.orderId || state?.activeOrder?.id;
            
            actions.push({ 
              type: 'SHOW_PAYMENT_METHODS', 
              payload: { 
                methods, 
                orderId 
              } 
            });
          }
          break;

        case 'CUSTOMER_SUPPORT':
          // Handle customer support requests
          const ticket = await this.customerService.createSupportTicket({
            customerId,
            issue: intent.parameters.issue || "Assistance requested",
            priority: intent.parameters.priority
          });
          
          actions.push({ type: 'CREATE_SUPPORT_TICKET', payload: ticket });
          break;

        case 'UNKNOWN':
          // For unknown intent, provide general help options
          const recommendedProducts = this.productService.getRecommendedProducts(customerId, 3);
          
          actions.push({ 
            type: 'UNKNOWN_INTENT', 
            payload: { 
              suggestedActions: ['browse_catalog', 'check_orders', 'contact_support']
            } 
          });
        
          // Add recommendations to help the user
          if (recommendedProducts && recommendedProducts.length > 0) {
            actions.push({ type: 'SHOW_RECOMMENDATIONS', payload: recommendedProducts });
          }
          break;
      }

      return actions;
    } catch (error) {
      this.logger.error(`Error processing actions for intent ${intent.type}:`, error);
      
      // Add error action
      actions.push({ 
        type: 'ERROR', 
        payload: { 
          message: "Une erreur s'est produite lors du traitement de votre demande.",
          error: error.message
        }
      });
      
      return actions;
    }
  }

  /**
   * Generate natural language response
   */
  private async generateResponse(
    intent: Intent,
    preferences: CustomerPreferences,
    actions: Array<{ type: string; payload: any }>
  ): Promise<string> {
    try {
      // Create prompt for response generation
      const prompt = createResponsePrompt(
        intent.type, 
        preferences, 
        JSON.stringify(actions, null, 2)
      );
      
      // Call OpenAI for response
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 400
      });

      return completion.choices[0]?.message?.content || 
        "Je m'excuse, je n'ai pas pu générer une réponse appropriée.";
    } catch (error) {
      this.logger.error('Error generating response:', error);
      
      // Return fallback response
      return "Je m'excuse, mais j'ai rencontré un problème technique. Comment puis-je vous aider autrement?";
    }
  }

  /**
   * Generate suggested quick replies based on context
   */
  private getSuggestedReplies(
    intentType: IntentType,
    actions: Array<{ type: string; payload: any }>
  ): string[] {
    switch (intentType) {
      case 'CATALOG_BROWSE':
        if (actions.some(a => a.type === 'SHOW_PRODUCTS' && a.payload?.length > 0)) {
          return ["Voir plus de détails", "Autres produits", "Filtrer par prix"];
        }
        return ["Voir les produits", "Catégories", "Filtrer par prix"];
        
      case 'PRODUCT_QUERY':
        const hasProduct = actions.some(a => a.type === 'SHOW_PRODUCT_DETAIL');
        if (hasProduct) {
          return ["Ajouter au panier", "Acheter maintenant", "Produits similaires"];
        }
        return ["Plus d'infos", "Ajouter au panier", "Produits similaires"];
        
      case 'ORDER_PLACEMENT':
        if (actions.some(a => a.type === 'CREATE_ORDER')) {
          return ["Payer maintenant", "Suivre commande", "Continuer mes achats"];
        }
        return ["Confirmer commande", "Modifier panier", "Options de livraison"];
        
      case 'ORDER_STATUS':
        return ["Suivre commande", "Contacter support", "Annuler commande"];
        
      case 'PAYMENT':
        return ["Aide au paiement", "Autres méthodes", "Contacter support"];
        
      case 'CUSTOMER_SUPPORT':
        return ["FAQ", "Mes commandes", "Retourner au catalogue"];
        
      case 'UNKNOWN':
        return ["Catalogue produits", "Mes commandes", "Aide"];
        
      default:
        return ["Voir les produits", "Mes commandes", "Aide"];
    }
  }

  /**
   * Update conversation context after processing
   */
  private async updateConversationContext(
    customerId: string,
    userMessage: string,
    aiResponse: string,
    intent: Intent,
    actions: Array<{ type: string; payload: any }>
  ): Promise<void> {
    try {
      // Create message objects for conversation history
      const userMessageObj: Message = {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        metadata: {
          intent: intent.type,
          parameters: intent.parameters
        }
      };

      const aiMessageObj: Message = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        metadata: {
          intent: intent.type
        }
      };

      // Extract products if present in actions
      const productsAction = actions.find(a => 
        ['SHOW_PRODUCTS', 'SHOW_PRODUCT_DETAIL', 'SHOW_SIMILAR_PRODUCTS'].includes(a.type)
      );
      
      if (productsAction) {
        aiMessageObj.metadata!.products = Array.isArray(productsAction.payload) ? 
          productsAction.payload : [productsAction.payload];
      }

      // Check for errors
      const errorAction = actions.find(a => a.type === 'ERROR');
      if (errorAction) {
        aiMessageObj.metadata!.error = true;
      }

      // Update context
      await this.conversationService.addMessagesToHistory(customerId, [userMessageObj, aiMessageObj]);

      // Ensuite, mettre à jour le contexte de conversation sans la propriété messages
      await this.conversationService.updateConversationContext(
        customerId,
        userMessage,
        intent.type,
        {
          lastIntent: intent,
          sessionData: {
            searchResults: productsAction?.payload,
            productDiscussion: intent.context.productDiscussion,
            orderInProgress: intent.context.orderInProgress,
            lastInteraction: new Date()
          }
        }
      );

      // Update session state
      const orderAction = actions.find(a => a.type === 'CREATE_ORDER');
      if (orderAction) {
        await this.conversationService.updateConversationState(
          customerId,
          {
            activeOrder: {
              id: orderAction.payload.id,
              status: orderAction.payload.status,
              items: orderAction.payload.items
            },
            sessionData: {
              lastInteraction: new Date(),
              lastIntent: intent.type,
              orderInProgress: true,
              paymentPending: true
            }
          }
        );
      }
    } catch (error) {
      this.logger.error('Error updating conversation context:', error);
      // Non-critical error, continue execution
    }
  }
}