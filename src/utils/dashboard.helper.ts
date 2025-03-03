import { supabase } from '../supabase/supabase.client';
import { 
  MetricWithComparison, 
  SellerDashboard,
  NotificationType,
  NotificationPriority,
  RecommendedAction,
  PaymentMethodInsight
} from '../types/dashboard.types';
import { formatDateTime } from './date.utils';

/**
 * Calcule les métriques avec comparaison
 */
export function calculateChangeMetrics(
  currentValue: number, 
  previousValue: number,
  unit: string = ''
): MetricWithComparison {
  // Calculer la variation
  const change = currentValue - previousValue;
  const changePercentage = previousValue !== 0 
    ? (change / previousValue) * 100 
    : currentValue > 0 ? 100 : 0;
  
  // Déterminer la tendance et si c'est positif
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
  const isPositive = change >= 0;
  
  // Formater les valeurs
  const formattedCurrent = unit === 'FCFA' 
    ? formatCurrency(currentValue) 
    : currentValue.toString();
  
  const formattedPrevious = unit === 'FCFA' 
    ? formatCurrency(previousValue) 
    : previousValue.toString();
  
  return {
    value: formattedCurrent,
    unit,
    previousValue: formattedPrevious,
    change,
    changePercentage: Math.round(changePercentage * 10) / 10, // Arrondir à 1 décimale
    trend,
    isPositive
  };
}

/**
 * Formate un montant en devise FCFA
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Détermine les problèmes urgents qui nécessitent une notification
 */
export async function determineUrgentIssues(sellerId: string): Promise<Array<{
  type: string;
  title: string;
  message: string;
  priority: string;
  actionLabel?: string;
  actionUrl?: string;
}>> {
  const issues = [];

  try {
    // 1. Vérifier les produits en rupture de stock
    const { data: outOfStockProducts, error: stockError } = await supabase
      .from('products')
      .select('id, name, stock')
      .eq('seller_id', sellerId)
      .eq('active', true)
      .lte('stock', 0)
      .limit(5);
    
    if (!stockError && outOfStockProducts && outOfStockProducts.length > 0) {
      issues.push({
        type: 'ALERT',
        title: `${outOfStockProducts.length} produit(s) en rupture de stock`,
        message: `Réapprovisionnez rapidement: ${outOfStockProducts.map(p => p.name).join(', ')}`,
        priority: 'HIGH',
        actionLabel: 'Gérer le stock',
        actionUrl: '/inventory/stock'
      });
    }
    
    // 2. Vérifier les commandes récentes en attente de traitement
    const { data: pendingOrders, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('status', 'CONFIRMED')
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(10);
    
    if (!orderError && pendingOrders && pendingOrders.length > 0) {
      issues.push({
        type: 'WARNING',
        title: `${pendingOrders.length} commande(s) en attente`,
        message: `Vous avez des commandes qui attendent d'être traitées depuis plus de 24h.`,
        priority: 'MEDIUM',
        actionLabel: 'Voir les commandes',
        actionUrl: '/orders/pending'
      });
    }
    
    // 3. Vérifier les messages WhatsApp non répondus
    const { data: unansweredMessages, error: messageError } = await supabase
      .from('whatsapp_messages')
      .select('id, customer_id')
      .eq('seller_id', sellerId)
      .eq('is_from_customer', true)
      .eq('status', 'UNREAD')
      .limit(10);
    
    if (!messageError && unansweredMessages && unansweredMessages.length > 0) {
      // Compter les clients uniques avec des messages non lus
      const uniqueCustomers = new Set(unansweredMessages.map(m => m.customer_id)).size;
      
      issues.push({
        type: 'ALERT',
        title: `${uniqueCustomers} client(s) attendent une réponse`,
        message: `Vous avez ${unansweredMessages.length} message(s) WhatsApp non lus.`,
        priority: 'HIGH',
        actionLabel: 'Répondre',
        actionUrl: '/messages/unread'
      });
    }
    
    // 4. Vérifier si des avis négatifs récents
    const { data: negativeReviews, error: reviewError } = await supabase
      .from('product_reviews')
      .select('id, product_id')
      .eq('seller_id', sellerId)
      .lte('rating', 2)
      .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5);
    
    if (!reviewError && negativeReviews && negativeReviews.length > 0) {
      issues.push({
        type: 'WARNING',
        title: `${negativeReviews.length} avis négatif(s) récent(s)`,
        message: `Vous avez reçu des avis négatifs au cours de la dernière semaine.`,
        priority: 'MEDIUM',
        actionLabel: 'Voir les avis',
        actionUrl: '/reviews/negative'
      });
    }
    
  } catch (error) {
    console.error('Erreur lors de la détermination des problèmes urgents:', error);
  }
  
  return issues;
}

/**
 * Génère des actions recommandées pour le vendeur
 */
export async function generateRecommendedActions(sellerId: string): Promise<RecommendedAction[]> {
  const actions: RecommendedAction[] = [];

  try {
    // 1. Actions liées à l'inventaire
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id, name, stock, low_stock_threshold')
      .eq('seller_id', sellerId)
      .gt('stock', 0) // pas complètement épuisés
      .lt('stock', 10) // seuil arbitraire pour test
      .order('stock', { ascending: true }) // les plus bas en stock d'abord
      .limit(3);
    
    if (lowStockProducts && lowStockProducts.length > 0) {
      // Produits à faible stock
      actions.push({
        id: `stock_${Date.now()}`,
        title: `Réapprovisionner ${lowStockProducts.length} produit(s)`,
        description: `Les produits suivants sont presque épuisés: ${lowStockProducts.map(p => p.name).join(', ')}`,
        priority: 'medium',
        impact: 'high',
        effort: 'medium',
        link: '/inventory/restock',
        completed: false
      });
    }
    
    // 2. Actions liées au marketing
    const { data: unlisted } = await supabase
      .from('products')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('active', false)
      .limit(5);
    
    if (unlisted && unlisted.length > 0) {
      actions.push({
        id: `activate_${Date.now()}`,
        title: 'Activer des produits en attente',
        description: `Vous avez ${unlisted.length} produit(s) non listés qui pourraient générer des ventes.`,
        priority: 'low',
        impact: 'medium',
        effort: 'low',
        link: '/products/inactive',
        completed: false
      });
    }
    
    // 3. Actions liées au service client
    const { data: whatsappStats } = await supabase
      .from('seller_analytics')
      .select('whatsapp_response_time')
      .eq('seller_id', sellerId)
      .single();
      
    if (whatsappStats && whatsappStats.whatsapp_response_time > 30) { // > 30 minutes
      actions.push({
        id: `response_${Date.now()}`,
        title: 'Améliorer votre temps de réponse WhatsApp',
        description: 'Répondre plus rapidement peut augmenter votre taux de conversion de 35%.',
        priority: 'medium',
        impact: 'high',
        effort: 'medium',
        link: '/settings/notifications',
        completed: false
      });
    }
    
    // 4. Actions liées aux paiements
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select(`
        payment_method
      `)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (payments && payments.length > 0) {
      // Compter les méthodes de paiement utilisées
      const methodCounts = new Map<string, number>();
      payments.forEach(payment => {
        const method = payment.payment_method?.type || 'unknown';
        methodCounts.set(method, (methodCounts.get(method) || 0) + 1);
      });
      
      // Vérifier si Wave est peu utilisé par rapport à d'autres méthodes
      const waveCount = methodCounts.get('digital_wallet') || 0;
      const mobileMoneyCount = methodCounts.get('mobile_money') || 0;
      
      // Si mobile money est beaucoup plus utilisé que Wave
      if (mobileMoneyCount > waveCount * 3 && mobileMoneyCount > 10) {
        actions.push({
          id: `wave_${Date.now()}`,
          title: 'Promouvoir Wave comme option de paiement',
          description: 'Wave a des frais réduits pour vos clients. Mentionnez-le dans vos messages.',
          priority: 'medium',
          impact: 'medium',
          effort: 'low',
          link: '/payments/methods',
          completed: false
        });
      }
    }
    
  } catch (error) {
    console.error('Erreur lors de la génération des actions recommandées:', error);
  }
  
  return actions;
}

/**
 * Enrichit les données du tableau de bord avec des insights supplémentaires
 */
export function enrichDashboardData(dashboard: SellerDashboard): SellerDashboard {
  try {
    // Enrichir les données de la méthode de paiement avec des insights contextuels
    if (dashboard.paymentMethods.length > 0) {
      dashboard.paymentMethods = enrichPaymentMethodsInsights(dashboard.paymentMethods);
    }
    
    // Déterminer les heures optimales pour les interactions
    if (dashboard.salesTimings.length > 0) {
      // Trouver les 3 meilleures heures
      const bestTimes = dashboard.salesTimings
        .filter(t => t.ordersCount > 0)
        .sort((a, b) => b.ordersCount - a.ordersCount)
        .slice(0, 3);
      
      if (bestTimes.length > 0) {
        // Ajouter comme notification d'insight
        dashboard.notifications.push({
          id: `best_times_${Date.now()}`,
          type: 'INSIGHT',
          title: 'Heures optimales de vente identifiées',
          message: `Concentrez vos efforts marketing entre ${bestTimes[0].hourOfDay}h et ${bestTimes[0].hourOfDay + 1}h pour maximiser vos ventes.`,
          timestamp: new Date(),
          priority: 'MEDIUM',
          read: false
        });
      }
    }
    
    // Enrichir avec des insights spécifiques à la date
    const now = new Date();
    const today = now.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
    
    // Insight pour un jour spécifique (par exemple le dimanche)
    if (today === 0) {
      dashboard.notifications.push({
        id: `sunday_prep_${Date.now()}`,
        type: 'TIP',
        title: 'Préparez votre semaine',
        message: `Le dimanche est idéal pour préparer vos stocks et planifier vos promotions de la semaine.`,
        timestamp: new Date(),
        priority: 'LOW',
        read: false
      });
    }
    
    // Ajouter des prévisions d'activité pour aujourd'hui
    dashboard.notifications.push({
      id: `daily_forecast_${Date.now()}`,
      type: 'INSIGHT',
      title: `Prévision du jour - ${formatDateTime(now).split(' ')[0]}`,
      message: `Prévision de ventes aujourd'hui: environ ${formatCurrency(dashboard.forecast.dailySales)}`,
      timestamp: new Date(),
      priority: 'LOW',
      read: false
    });
    
    return dashboard;
  } catch (error) {
    console.error('Erreur lors de l\'enrichissement des données du tableau de bord:', error);
    return dashboard; // Retourner le dashboard non modifié en cas d'erreur
  }
}

/**
 * Enrichit les insights des méthodes de paiement avec des contextes spécifiques à l'Afrique
 */
function enrichPaymentMethodsInsights(methods: PaymentMethodInsight[]): PaymentMethodInsight[] {
  const enrichedMethods = [...methods];
  
  // Trouver les méthodes spécifiques et ajouter des métadonnées
  for (const method of enrichedMethods) {
    // Enrichir Wave si présent
    if (method.method === 'Wave' || method.method.includes('Wave')) {
      method.metadata = {
        ...(method.metadata || {}),
        benefitMessage: "0% de frais pour vos clients",
        ussdCode: "*933#",
        extraInfo: "Option populaire en Côte d'Ivoire"
      };
    } 
    // Enrichir Orange Money si présent
    else if (method.method === 'Orange Money' || method.method.includes('Orange')) {
      method.metadata = {
        ...(method.metadata || {}),
        benefitMessage: "Largement disponible dans toute l'Afrique de l'Ouest",
        ussdCode: "*144#",
        extraInfo: "Frais moyens de 1% pour le client"
      };
    }
    // Enrichir MTN Mobile Money si présent
    else if (method.method === 'MTN Mobile Money' || method.method.includes('MTN')) {
      method.metadata = {
        ...(method.metadata || {}),
        benefitMessage: "Réseau étendu dans plusieurs pays",
        ussdCode: "*133#",
        extraInfo: "Frais moyens de 1.5% pour le client"
      };
    }
    // Enrichir Djamo si présent
    else if (method.method === 'Djamo' || method.method.includes('Djamo')) {
      method.metadata = {
        ...(method.metadata || {}),
        benefitMessage: "Option idéale pour les clients bancarisés",
        extraInfo: "Accepte les cartes virtuelles"
      };
    }
  }
  
  return enrichedMethods;
}