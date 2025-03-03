/**
 * Service de journalisation pour l'application WhatsApp E-commerce
 * Gère les logs avec différents niveaux et formats adaptés au contexte
 */
export class Logger {
    private context: string;
    private static readonly LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
    private static currentLogLevel: string = process.env.LOG_LEVEL || 'info';
  
    constructor(context: string) {
      this.context = context;
    }
  
    /**
     * Journalise un message d'erreur
     */
    error(message: string, error?: any): void {
      this.logWithLevel('error', message, error);
    }
  
    /**
     * Journalise un avertissement
     */
    warn(message: string, metadata?: any): void {
      this.logWithLevel('warn', message, metadata);
    }
  
    /**
     * Journalise un message informatif
     */
    log(message: string, metadata?: any): void {
      this.logWithLevel('info', message, metadata);
    }
  
    /**
     * Journalise un message informatif (alias pour log)
     */
    info(message: string, metadata?: any): void {
      this.log(message, metadata);
    }
  
    /**
     * Journalise un message de débogage
     */
    debug(message: string, metadata?: any): void {
      this.logWithLevel('debug', message, metadata);
    }
  
    /**
     * Méthode commune pour journaliser avec un niveau spécifique
     */
    private logWithLevel(level: 'error' | 'warn' | 'info' | 'debug', message: string, metadata?: any): void {
      // Vérifier si on doit journaliser ce niveau
      if (!this.shouldLog(level)) return;
  
      const timestamp = new Date().toISOString();
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${this.context}] ${message}`;
  
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          if (metadata) {
            if (metadata instanceof Error) {
              console.error(`Stack: ${metadata.stack}`);
            } else {
              console.error(metadata);
            }
          }
          break;
        case 'warn':
          console.warn(formattedMessage);
          if (metadata) console.warn(metadata);
          break;
        case 'info':
          console.log(formattedMessage);
          if (metadata) console.log(metadata);
          break;
        case 'debug':
          console.debug(formattedMessage);
          if (metadata) console.debug(metadata);
          break;
      }
  
      // En production, on pourrait également envoyer les logs à un service externe
      this.sendToExternalLogService(level, formattedMessage, metadata);
    }
  
    /**
     * Détermine si un message de ce niveau doit être journalisé
     */
    private shouldLog(level: 'error' | 'warn' | 'info' | 'debug'): boolean {
      const levels = Logger.LOG_LEVELS;
      const currentLevelIndex = levels.indexOf(Logger.currentLogLevel as any);
      const messageLevelIndex = levels.indexOf(level);
      
      return messageLevelIndex <= currentLevelIndex;
    }
  
    /**
     * Envoie les logs à un service externe en production
     * Cette fonction est un placeholder pour l'intégration avec un service externe
     */
    private sendToExternalLogService(level: string, message: string, metadata?: any): void {
      // Uniquement en production et pour les erreurs graves
      if (process.env.NODE_ENV === 'production' && (level === 'error' || level === 'warn')) {
        // Implémentation pour un service comme Sentry, LogRocket, etc.
        // Par exemple:
        // ExternalLogService.captureMessage({
        //   level,
        //   message,
        //   context: this.context,
        //   metadata,
        //   timestamp: new Date().toISOString()
        // });
      }
    }
  
    /**
     * Modifie le niveau de log global
     */
    static setLogLevel(level: string): void {
      if (Logger.LOG_LEVELS.includes(level as any)) {
        Logger.currentLogLevel = level;
      }
    }
  }