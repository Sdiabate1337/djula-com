export type IntentType = 
  | 'CATALOG_BROWSE'
  | 'PRODUCT_QUERY'
  | 'ORDER_PLACEMENT'
  | 'ORDER_STATUS'
  | 'PAYMENT'
  | 'CUSTOMER_SUPPORT'
  | 'UNKNOWN';

export interface Intent {
  type: IntentType;
  confidence: number;
  parameters: Record<string, any>;
  context: {
    previousIntent?: IntentType;
    orderInProgress?: boolean;
    productDiscussion?: boolean;
  };
}

export interface CustomerPreferences {
  preferredCategories: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  preferredLanguage: 'fr' | 'en';
  preferredPaymentMethods: string[];
  communicationPreferences: {
    notifications: boolean;
    promotions: boolean;
    orderUpdates: boolean;
  };
}

export interface DefaultCustomerPreferences extends CustomerPreferences {
  preferredCategories: [];
  preferredLanguage: 'fr';
  preferredPaymentMethods: [];
  communicationPreferences: {
    notifications: true;
    promotions: false;
    orderUpdates: true;
  };
}

export const DEFAULT_PREFERENCES: DefaultCustomerPreferences = {
  preferredCategories: [],
  preferredLanguage: 'fr',
  preferredPaymentMethods: [],
  communicationPreferences: {
    notifications: true,
    promotions: false,
    orderUpdates: true
  }
};

export interface SessionData {
  lastInteraction: Date;
  lastIntent: string;
  orderInProgress: boolean;
  paymentPending: boolean;
  [key: string]: any; // Permet des propriétés supplémentaires
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: IntentType;
    parameters?: Record<string, any>;
    products?: any[];
    error?: boolean;
  };
}

export interface MessageContext {
  conversationHistory: Message[];
  lastIntent?: Intent;
  currentOrder?: any;
  customerPreferences?: CustomerPreferences;
  sessionData?: SessionData;
  systemPrompt?: string;
}

export interface ConversationState {
  activeOrder?: {
    id: string;
    status: string;
    items: Array<{ productId: string; quantity: number }>;
  };
  lastProductQuery?: {
    term?: string;
    category?: string;
    filters?: Record<string, any>;
  };
  supportTicket?: {
    id: string;
    status: string;
    issue: string;
  };
  sessionData: {
    lastInteraction: Date;
    lastIntent: string;
    orderInProgress: boolean;
    paymentPending: boolean;
  };
}


export type SessionDataUpdate = Partial<SessionData>;

// NOUVEAU: Type pour les mises à jour de l'état de conversation
export interface ConversationStateUpdate {
  activeOrder?: {
    id: string;
    status: string;
    items: any[];
  };
  sessionData?: SessionDataUpdate;
}

// NOUVEAU: Type pour les mises à jour du contexte de conversation
export interface ConversationContextUpdate {
  lastIntent?: Intent;
  sessionData?: SessionDataUpdate;
}


export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED'
}