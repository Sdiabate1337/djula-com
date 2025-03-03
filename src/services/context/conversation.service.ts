import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MessageContext, 
  Message, 
  Intent, 
  IntentType,
  ConversationState,
  SessionData,
  ConversationContextUpdate ,
  ConversationStateUpdate
} from '../../types/ai.types';
import { Logger } from '../../utils/logger';

/**
 * Service de gestion du contexte conversationnel pour l'application WhatsApp E-commerce
 * Stocke et récupère l'historique des conversations, les états et les contextes
 */
export class ConversationService {
  private supabase: SupabaseClient;
  private logger: Logger;
  private contextCache: Map<string, { context: MessageContext, timestamp: number }>;
  private stateCache: Map<string, { state: ConversationState, timestamp: number }>;
  private readonly CACHE_TTL = 300000; // 5 minutes en millisecondes
  
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Les variables d\'environnement Supabase sont manquantes');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    this.logger = new Logger('ConversationService');
    this.contextCache = new Map();
    this.stateCache = new Map();

    // Nettoyage périodique du cache
    setInterval(() => this.cleanCache(), this.CACHE_TTL);
  }

  /**
   * Récupère le contexte de conversation pour un client
   */
  async getConversationContext(customerId: string): Promise<MessageContext> {
    try {
      // Vérifier le cache d'abord
      const cachedContext = this.contextCache.get(customerId);
      if (cachedContext && Date.now() - cachedContext.timestamp < this.CACHE_TTL) {
        return cachedContext.context;
      }

      // Get conversation history
      const { data: messages, error: messagesError } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', customerId)
        .order('timestamp', { ascending: true })
        .limit(20);

      if (messagesError) {
        throw messagesError;
      }

      // Get current order if exists
      const { data: currentOrder, error: orderError } = await this.supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'IN_PROGRESS')
        .single();

      if (orderError && orderError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw orderError;
      }

      // Get last intent
      const { data: lastIntentData, error: intentError } = await this.supabase
        .from('conversation_intents')
        .select('*')
        .eq('customer_id', customerId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (intentError && intentError.code !== 'PGRST116') {
        throw intentError;
      }

      const context: MessageContext = {
        conversationHistory: messages?.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          metadata: msg.metadata
        })) || [],
        currentOrder: currentOrder || undefined,
        lastIntent: lastIntentData ? JSON.parse(lastIntentData.intent_data) : undefined
      };
      
      // Mettre en cache le contexte
      this.contextCache.set(customerId, { context, timestamp: Date.now() });
      
      return context;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du contexte de conversation:', error);
      // Retourner un contexte vide en cas d'erreur
      return {
        conversationHistory: [],
      };
    }
  }

  /**
   * Récupère l'état de la conversation pour un client
   */
  async getConversationState(customerId: string): Promise<ConversationState> {
    try {
      // Vérifier le cache d'abord
      const cachedState = this.stateCache.get(customerId);
      if (cachedState && Date.now() - cachedState.timestamp < this.CACHE_TTL) {
        return cachedState.state;
      }

      const { data, error } = await this.supabase
        .from('customer_sessions')
        .select('state')
        .eq('customer_id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // "no rows returned"
          // Créer un nouvel état par défaut
          const defaultState = this.getDefaultState();
          await this.updateConversationState(customerId, defaultState);
          return defaultState;
        }
        throw error;
      }

      const state = data.state;
      
      // Mettre en cache l'état
      this.stateCache.set(customerId, { state, timestamp: Date.now() });
      
      return state;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de l\'état de conversation:', error);
      // Retourner un état par défaut en cas d'erreur
      return this.getDefaultState();
    }
  }

  /**
   * Met à jour le contexte de conversation pour un client
   */
  async updateConversationContext(
    customerId: string,
    userMessage: string,
    intentType: IntentType,
    updates: ConversationContextUpdate
  ): Promise<void> {
    try {
      // Récupérer le contexte actuel
      const currentContext = await this.getConversationContext(customerId);
      
      // Mettre à jour le dernier intent s'il est fourni
      if (updates.lastIntent) {
        await this.supabase
          .from('conversation_intents')
          .insert({
            customer_id: customerId,
            intent_type: intentType,
            intent_data: JSON.stringify(updates.lastIntent),
            message: userMessage,
            timestamp: new Date().toISOString()
          });
      }
  
      // Mettre à jour les données de session si fournies
      if (updates.sessionData) {
        await this.updateConversationState(customerId, {
          sessionData: updates.sessionData
        });
      }
      
      // Invalider le cache pour forcer un rechargement des données
      this.contextCache.delete(customerId);
  
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour du contexte de conversation:', error);
      throw error;
    }
  }

  /**
   * Met à jour l'état de la conversation pour un client
   */
 /**
 * Met à jour l'état de la conversation pour un client
 */
async updateConversationState(
  customerId: string,
  updates: ConversationStateUpdate
): Promise<void> {
  try {
    // Récupérer l'état actuel ou créer un état par défaut
    const currentState = await this.getConversationState(customerId)
      .catch(() => this.getDefaultState());
    
    // Fusion des mises à jour avec l'état actuel
    const updatedState = this.mergeStates(currentState, updates);
    
    // Mettre à jour l'état dans la base de données
    await this.supabase
      .from('customer_sessions')
      .upsert({
        customer_id: customerId,
        state: updatedState,
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    // Mettre à jour le cache avec le nouvel état
    this.stateCache.set(customerId, { 
      state: updatedState, 
      timestamp: Date.now() 
    });

  } catch (error) {
    this.logger.error('Erreur lors de la mise à jour de l\'état de la conversation:', error);
    throw error;
  }
}

  /**
   * Ajoute des messages à l'historique de la conversation
   */
  async addMessagesToHistory(customerId: string, messages: Message[]): Promise<void> {
    if (!messages || messages.length === 0) return;

    try {
      // Préparer les entrées pour l'insertion dans la base de données
      const entries = messages.map(message => ({
        customer_id: customerId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        metadata: message.metadata || {}
      }));

      // Insérer les messages dans la base de données
      const { error } = await this.supabase
        .from('conversations')
        .insert(entries);

      if (error) {
        throw error;
      }

      // Invalider le cache pour forcer un rechargement des données
      this.contextCache.delete(customerId);

    } catch (error) {
      this.logger.error('Erreur lors de l\'ajout de messages à l\'historique:', error);
    }
  }

  /**
   * Efface le contexte de conversation pour un client
   */
  async clearConversationContext(customerId: string): Promise<void> {
    try {
      // Supprimer les messages de conversation
      await this.supabase
        .from('conversations')
        .delete()
        .eq('customer_id', customerId);
      
      // Supprimer les intents
      await this.supabase
        .from('conversation_intents')
        .delete()
        .eq('customer_id', customerId);
      
      // Réinitialiser l'état de session
      await this.supabase
        .from('customer_sessions')
        .update({
          state: this.getDefaultState(),
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customerId);
      
      // Nettoyer le cache
      this.contextCache.delete(customerId);
      this.stateCache.delete(customerId);
      
      this.logger.info(`Contexte de conversation effacé pour le client ${customerId}`);
    } catch (error) {
      this.logger.error('Erreur lors de l\'effacement du contexte de conversation:', error);
      throw error;
    }
  }

  /**
   * Obtient l'état par défaut pour une nouvelle conversation
   */
  private getDefaultState(): ConversationState {
    return {
      sessionData: {
        lastInteraction: new Date(),
        lastIntent: 'UNKNOWN',
        orderInProgress: false,
        paymentPending: false
      }
    };
  }

  /**
   * Fusionne deux états de conversation
   */
  /**
 * Fusionne deux états de conversation
 */
private mergeStates(
  currentState: ConversationState, 
  updates: ConversationStateUpdate
): ConversationState {
  // Fusion spécifique pour sessionData
  let mergedSessionData: SessionData;
  
  if (updates.sessionData) {
    mergedSessionData = {
      // Garder les valeurs actuelles comme base
      ...currentState.sessionData,
      // Appliquer les mises à jour
      ...updates.sessionData
    };
  } else {
    mergedSessionData = currentState.sessionData;
  }

  return {
    activeOrder: updates.activeOrder || currentState.activeOrder,
    sessionData: mergedSessionData
  };
}

  /**
   * Nettoie les entrées de cache périmées
   */
  private cleanCache(): void {
    const now = Date.now();
    const expiredTime = now - this.CACHE_TTL;
    
    // Nettoyer le cache de contexte
    for (const [key, value] of this.contextCache.entries()) {
      if (value.timestamp < expiredTime) {
        this.contextCache.delete(key);
      }
    }
    
    // Nettoyer le cache d'état
    for (const [key, value] of this.stateCache.entries()) {
      if (value.timestamp < expiredTime) {
        this.stateCache.delete(key);
      }
    }
  }

  /**
   * Recherche dans l'historique des conversations
   */
  async searchConversationHistory(
    customerId: string,
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Message[]> {
    try {
      const { limit = 10, offset = 0 } = options;
      
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', customerId)
        .ilike('content', `%${query}%`)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data?.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        metadata: msg.metadata
      })) || [];
    } catch (error) {
      this.logger.error('Erreur lors de la recherche dans l\'historique des conversations:', error);
      return [];
    }
  }
  
  /**
   * Récupère les statistiques de conversation
   */
  async getConversationStats(customerId: string): Promise<{
    totalMessages: number;
    firstInteraction: Date | null;
    lastInteraction: Date | null;
    commonTopics: string[];
  }> {
    try {
      // Obtenir le nombre total de messages
      const { count: totalMessages, error: countError } = await this.supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId);

      if (countError) throw countError;

      // Obtenir première et dernière interaction
      const { data: timeData, error: timeError } = await this.supabase
        .from('conversations')
        .select('timestamp')
        .eq('customer_id', customerId)
        .order('timestamp', { ascending: true });

      if (timeError) throw timeError;

      const firstInteraction = timeData && timeData.length > 0 ? new Date(timeData[0].timestamp) : null;
      const lastInteraction = timeData && timeData.length > 0 ? new Date(timeData[timeData.length - 1].timestamp) : null;

      // Obtenir les sujets communs (à partir des intents)
      const { data: intents, error: intentsError } = await this.supabase
        .from('conversation_intents')
        .select('intent_type')
        .eq('customer_id', customerId)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (intentsError) throw intentsError;

      // Compter les occurrences des types d'intent
      const intentCounts: Record<string, number> = {};
      intents?.forEach(item => {
        intentCounts[item.intent_type] = (intentCounts[item.intent_type] || 0) + 1;
      });

      // Obtenir les 3 sujets les plus fréquents
      const commonTopics = Object.entries(intentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([intent]) => this.translateIntent(intent));

      return {
        totalMessages: totalMessages || 0,
        firstInteraction,
        lastInteraction,
        commonTopics
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques de conversation:', error);
      return {
        totalMessages: 0,
        firstInteraction: null,
        lastInteraction: null,
        commonTopics: []
      };
    }
  }
  
  /**
   * Traduit le type d'intent en un libellé utilisateur
   */
  private translateIntent(intentType: string): string {
    const translations: Record<string, string> = {
      'CATALOG_BROWSE': 'Parcourir le catalogue',
      'PRODUCT_QUERY': 'Informations sur les produits',
      'ORDER_PLACEMENT': 'Passer une commande',
      'ORDER_STATUS': 'État des commandes',
      'PAYMENT': 'Paiements',
      'CUSTOMER_SUPPORT': 'Support client',
      'UNKNOWN': 'Divers'
    };
    
    return translations[intentType] || intentType;
  }
}