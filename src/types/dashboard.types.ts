import { PaymentMethodType } from "../services/payment/payment.service";

// Types d'insights pour le tableau de bord
export enum InsightType {
  SALES = 'sales',
  INVENTORY = 'inventory',
  CUSTOMER = 'customer',
  PAYMENT = 'payment',
  MARKETING = 'marketing',
  PERFORMANCE = 'performance'
}

// Périodes de comparaison
export enum ComparisonPeriod {
  YESTERDAY = 'yesterday',
  LAST_WEEK = 'last_week',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom'
}

// Priorité des notifications
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Type de notification
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ALERT = 'alert',
  TIP = 'tip',
  INSIGHT = 'insight'
}

// Préférences du tableau de bord
export interface DashboardPreference {
  favoriteMetrics: string[];
  hiddenSections?: string[];
  defaultDateRange: string;
  notificationSettings: {
    email: boolean;
    whatsapp: boolean;
    inApp: boolean;
    salesAlerts: boolean;
    inventoryAlerts: boolean;
  };
}

// Mesure avec comparaison
export interface MetricWithComparison {
  value: number | string;
  unit?: string;
  previousValue?: number | string;
  change?: number;
  changePercentage?: number;
  trend: 'up' | 'down' | 'stable';
  isPositive: boolean;
}

// Métriques clés du tableau de bord
export interface KeyMetrics {
  sales: MetricWithComparison;
  orders: MetricWithComparison;
  customers: MetricWithComparison;
  averageOrderValue: MetricWithComparison;
  conversionRate?: MetricWithComparison;
}

// Activité récente
export interface RecentActivity {
  orders: RecentOrder[];
  customerInteractions: CustomerInteraction[];
  inventoryChanges: InventoryChange[];
}

// Commande récente
export interface RecentOrder {
  id: string;
  customerName?: string;
  whatsappNumber: string;
  amount: number;
  items: number;
  status: string;
  paymentMethod: string;
  timestamp: Date;
}

// Interaction client
export interface CustomerInteraction {
  customerId: string;
  customerName?: string;
  whatsappNumber: string;
  type: 'inquiry' | 'complaint' | 'feedback' | 'order' | 'return' | 'other';
  message?: string;
  timestamp: Date;
  resolved: boolean;
}

// Changement d'inventaire
export interface InventoryChange {
  productId: string;
  productName: string;
  previousStock: number;
  currentStock: number;
  reason: 'sale' | 'restock' | 'return' | 'adjustment' | 'expiration';
  timestamp: Date;
}

// Notification du tableau de bord
export interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  priority: NotificationPriority;
  read: boolean;
  action?: {
    label: string;
    url: string;
  };
}

// Informations régionales
export interface RegionalInsight {
  region: string;
  sales: number;
  orders: number;
  customers: number;
  topProducts: {
    id: string;
    name: string;
    sales: number;
  }[];
}

// Méthode de paiement populaire
export interface PaymentMethodInsight {
  method: string;
  type: PaymentMethodType;
  count: number;
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

// Temps forts des ventes
export interface SalesTimeInsight {
  hourOfDay: number;
  dayOfWeek: number;
  volume: 'low' | 'medium' | 'high' | 'very_high';
  ordersCount: number;
  salesAmount: number;
}

// Informations WhatsApp
export interface WhatsAppInsight {
  totalConversations: number;
  activeConversations: number;
  completedConversations: number;
  abandonedConversations: number;
  averageResponseTime: number; // en minutes
  conversionRate: number; // pourcentage
  topKeywords: {
    keyword: string;
    count: number;
  }[];
  conversationsByIntent: {
    intent: string;
    count: number;
    conversion: number;
  }[];
}

// Action recommandée
export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  priority: NotificationPriority;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  link?: string;
  completed: boolean;
}

// Tableau de bord vendeur complet
export interface SellerDashboard {
  seller: {
    id: string;
    fullName: string;
    brandName: string;
    profileImageUrl?: string;
  };
  timestamp: Date;
  datePeriod: {
    start: Date;
    end: Date;
    label: string;
  };
  keyMetrics: KeyMetrics;
  recentActivity: RecentActivity;
  notifications: DashboardNotification[];
  regionalInsights: RegionalInsight[];
  paymentMethods: PaymentMethodInsight[];
  salesTimings: SalesTimeInsight[];
  whatsappInsights: WhatsAppInsight;
  recommendedActions: RecommendedAction[];
  inventory: {
    lowStock: number;
    outOfStock: number;
    totalProducts: number;
    topSellers: {
      id: string;
      name: string;
      sold: number;
      remaining: number;
    }[];
  };
  forecast: {
    dailySales: number;
    weeklySales: number;
    monthlySales: number;
    trend: 'up' | 'down' | 'stable';
  };
}