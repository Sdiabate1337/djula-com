import { createClient } from '@supabase/supabase-js';
import { ConversationState } from '../types/ai.types';
import { Logger } from './logger';

/**
 * Interface pour les données de session
 */
export interface Session {
  customerId: string;
  lastActivity: Date;
  state: ConversationState;
  metadata?: Record<string, any>;
}

/**
 * Service de gestion des sessions utilisateur
 * Stocke et récupère les sessions via Supabase
 */
export class SessionManager {
  private supabase;
  private sessions: Map<string, Session>;
  private readonly TABLE_NAME = 'customer_sessions';
  private readonly SESSION_TIMEOUT_MS = 3600000; // 1 heure
  private logger: Logger;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    this.sessions = new Map();
    this.logger = new Logger('SessionManager');

    // Lancer le nettoyage automatique des sessions inactives
    setInterval(() => this.cleanInactiveSessions(), this.SESSION_TIMEOUT_MS);
  }

  /**
   * Récupère ou crée une session pour un client
   */
  async getSession(customerId: string): Promise<Session> {
    // Vérifier d'abord le cache en mémoire
    const cachedSession = this.sessions.get(customerId);
    if (cachedSession) {
      // Mettre à jour le timestamp d'activité
      cachedSession.lastActivity = new Date();
      return cachedSession;
    }

    // Sinon, essayer de récupérer depuis la base de données
    try {
      const { data, error } = await this.supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (error || !data) {
        // Créer une nouvelle session
        return this.createNewSession(customerId);
      }

      // Construire la session à partir des données DB
      const session: Session = {
        customerId,
        lastActivity: new Date(),
        state: data.state || this.getDefaultState(),
        metadata: data.metadata || {}
      };

      // Mettre en cache
      this.sessions.set(customerId, session);
      return session;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de la session pour ${customerId}:`, error);
      return this.createNewSession(customerId);
    }
  }

  /**
   * Met à jour une session existante
   */
  async updateSession(customerId: string, updates: Partial<Session>): Promise<Session> {
    try {
      // Récupérer la session existante
      const session = await this.getSession(customerId);
      
      // Appliquer les mises à jour
      const updatedSession: Session = {
        ...session,
        ...updates,
        lastActivity: new Date(), // Toujours mettre à jour l'horodatage d'activité
        customerId // S'assurer que l'ID client ne change pas
      };

      // Mettre à jour le cache
      this.sessions.set(customerId, updatedSession);

      // Persister dans la base de données
      await this.supabase
        .from(this.TABLE_NAME)
        .upsert({
          customer_id: customerId,
          state: updatedSession.state,
          metadata: updatedSession.metadata,
          last_activity: updatedSession.lastActivity.toISOString()
        });

      return updatedSession;
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour de la session pour ${customerId}:`, error);
      return this.sessions.get(customerId) || await this.createNewSession(customerId);
    }
  }

  /**
   * Met à jour uniquement l'état de conversation d'une session
   */
  async updateState(customerId: string, stateUpdates: Partial<ConversationState>): Promise<void> {
    try {
      const session = await this.getSession(customerId);
      
      // Mettre à jour l'état
      session.state = {
        ...session.state,
        ...stateUpdates,
        // Toujours mettre à jour les données de session
        sessionData: {
          ...session.state.sessionData,
          ...stateUpdates.sessionData,
          lastInteraction: new Date()
        }
      };

      // Sauvegarder la session mise à jour
      await this.updateSession(customerId, { state: session.state });
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour de l'état pour ${customerId}:`, error);
    }
  }

  /**
   * Termine une session utilisateur
   */
  async endSession(customerId: string): Promise<void> {
    try {
      // Supprimer du cache
      this.sessions.delete(customerId);
      
      // Marquer comme terminée dans la base de données
      await this.supabase
        .from(this.TABLE_NAME)
        .update({
          active: false,
          ended_at: new Date().toISOString()
        })
        .eq('customer_id', customerId);
    } catch (error) {
      this.logger.error(`Erreur lors de la terminaison de la session pour ${customerId}:`, error);
    }
  }

  /**
   * Crée une nouvelle session pour un client
   */
  private async createNewSession(customerId: string): Promise<Session> {
    const newSession: Session = {
      customerId,
      lastActivity: new Date(),
      state: this.getDefaultState(),
      metadata: {}
    };

    // Ajouter au cache
    this.sessions.set(customerId, newSession);

    // Persister dans la base de données
    await this.supabase
      .from(this.TABLE_NAME)
      .upsert({
        customer_id: customerId,
        state: newSession.state,
        metadata: newSession.metadata,
        last_activity: newSession.lastActivity.toISOString(),
        created_at: newSession.lastActivity.toISOString(),
        active: true
      });

    return newSession;
  }

  /**
   * Retourne l'état par défaut pour une nouvelle session
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
   * Nettoie les sessions inactives du cache
   */
  private cleanInactiveSessions(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [customerId, session] of this.sessions.entries()) {
      const lastActivity = session.lastActivity.getTime();
      if (now - lastActivity > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(customerId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug(`Nettoyage de sessions: ${expiredCount} sessions inactives supprimées`);
    }
  }

  /**
   * Récupère des statistiques sur les sessions actives
   */
  getSessionStats(): {
    activeSessions: number;
    averageSessionAge: number;
  } {
    const now = Date.now();
    let totalAge = 0;
    let count = 0;

    for (const session of this.sessions.values()) {
      totalAge += now - session.lastActivity.getTime();
      count++;
    }

    return {
      activeSessions: count,
      averageSessionAge: count > 0 ? totalAge / count : 0
    };
  }
}