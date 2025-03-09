import { supabase } from '../supabase/supabase.client';
import { SellerService } from '../seller/seller.service';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product.service';
import { InsightsService } from './insights.service';
import { Logger } from '../../utils/logger';
import { 
  SellerDashboard, 
  KeyMetrics,
  RecentActivity,
  DashboardNotification,
  NotificationType,
  NotificationPriority,
  RecommendedAction,
  ComparisonPeriod
} from '../../types/dashboard.types';
import {
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  subtractDays,
  subtractMonths,
  formatDate,
  formatDateTime
} from '../../utils/date.utils';
import { 
  calculateChangeMetrics,
  generateRecommendedActions,
  enrichDashboardData,
  determineUrgentIssues 
} from '../../utils/dashboard.helper';

export class DashboardService {
  private sellerService: SellerService;
  private orderService: OrderService;
  private productService: ProductService;
  private insightsService: InsightsService;
  private logger: Logger;

  constructor() {
    this.sellerService = new SellerService();
    this.orderService = new OrderService();
    this.productService = new ProductService();
    this.insightsService = new InsightsService();
    this.logger = new Logger('DashboardService');
  }

  /**
   * Génère le tableau de bord complet pour un vendeur
   * 
   * @param sellerId ID du vendeur ou numéro WhatsApp
   * @param period Période d'analyse (jour, semaine, mois)
   * @param date Date de référence (par défaut: maintenant)
   */
  async generateDashboard(
    sellerIdentifier: string,
    period: 'day' | 'week' | 'month' = 'day',
    date?: Date
  ): Promise<SellerDashboard> {
    try {
      // Utiliser la date actuelle si non spécifiée
      const referenceDate = date || new Date();
      
      // Identifier le vendeur (par ID ou WhatsApp)
      let seller;
      if (sellerIdentifier.includes('+') || /^\d+$/.test(sellerIdentifier)) {
        // C'est probablement un numéro WhatsApp
        seller = await this.sellerService.getSellerByWhatsApp(sellerIdentifier);
      } else {
        // Rechercher par ID
        const { data } = await supabase
          .from('sellers')
          .select('*')
          .eq('id', sellerIdentifier)
          .single();
        
        if (data) {
          seller = this.sellerService.mapSellerProfile(data);
        }
      }

      if (!seller) {
        throw new Error(`Vendeur non trouvé: ${sellerIdentifier}`);
      }
      
      // Définir les périodes d'analyse
      const { startDate, endDate, label } = this.getDashboardPeriod(period, referenceDate);
      
      // Récupérer les métriques clés
      const keyMetrics = await this.getKeyMetrics(seller.id, startDate, endDate);
      
      // Récupérer l'activité récente
      const recentActivity = await this.getRecentActivity(seller.id);
      
      // Récupérer les notifications
      const notifications = await this.getNotifications(seller.id);
      
      // Récupérer les insights régionaux
      const regionalInsights = await this.insightsService.getRegionalInsights(
        seller.id, 
        startDate, 
        endDate
      );

      // Récupérer les insights sur les méthodes de paiement
      const paymentMethods = await this.insightsService.getPaymentMethodInsights(
        seller.id,
        startDate,
        endDate
      );

      // Récupérer les insights sur les heures de vente
      const salesTimings = await this.insightsService.getSalesTimingInsights(
        seller.id,
        startDate,
        endDate
      );

      // Récupérer les insights WhatsApp
      const whatsappInsights = await this.insightsService.getWhatsAppInsights(
        seller.id,
        startDate,
        endDate
      );
      
      // Générer des actions recommandées
      const recommendedActions = await this.getRecommendedActions(seller.id);
      
      // Récupérer les informations d'inventaire
      const inventory = await this.getInventorySummary(seller.id);
      
      // Générer des prévisions
      const forecast = await this.generateForecast(seller.id, startDate, endDate);

      // Assembler le tableau de bord
      const dashboard: SellerDashboard = {
        seller: {
          id: seller.id,
          fullName: seller.fullName,
          brandName: seller.brandName,
          profileImageUrl: seller.profileImageUrl
        },
        timestamp: new Date(),
        datePeriod: {
          start: startDate,
          end: endDate,
          label
        },
        keyMetrics,
        recentActivity,
        notifications,
        regionalInsights,
        paymentMethods,
        salesTimings,
        whatsappInsights,
        recommendedActions,
        inventory,
        forecast
      };
      
      // Enrichir avec des données contextuelles et des insights supplémentaires
      return enrichDashboardData(dashboard);
      
    } catch (error) {
      this.logger.error(`Erreur lors de la génération du tableau de bord:`, error);
      throw new Error(`Impossible de générer le tableau de bord: ${error.message}`);
    }
  }

  /**
   * Obtenir les métriques clés pour le dashboard
   */
  private async getKeyMetrics(
    sellerId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<KeyMetrics> {
    // Définir la période précédente pour comparaison
    const duration = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - duration);
    const previousEndDate = new Date(endDate.getTime() - duration);
    
    // Récupérer les commandes de la période actuelle
    const { data: currentOrders } = await supabase
      .from('orders')
      .select('id, customer_id, total_amount, created_at, status')
      .eq('seller_id', sellerId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    // Récupérer les commandes de la période précédente
    const { data: previousOrders } = await supabase
      .from('orders')
      .select('id, customer_id, total_amount, created_at, status')
      .eq('seller_id', sellerId)
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString());
    
    // Calculer les métriques actuelles
    const currentSales = currentOrders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
    const currentOrdersCount = currentOrders?.length || 0;
    
    // Ensemble unique de clients pour la période actuelle
    const currentCustomerIds = new Set();
    currentOrders?.forEach(order => currentCustomerIds.add(order.customer_id));
    const currentCustomersCount = currentCustomerIds.size;
    
    // Calculer l'AOV (Average Order Value)
    const currentAOV = currentOrdersCount > 0 ? currentSales / currentOrdersCount : 0;
    
    // Calculer les métriques précédentes
    const previousSales = previousOrders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
    const previousOrdersCount = previousOrders?.length || 0;
    
    // Ensemble unique de clients pour la période précédente
    const previousCustomerIds = new Set();
    previousOrders?.forEach(order => previousCustomerIds.add(order.customer_id));
    const previousCustomersCount = previousCustomerIds.size;
    
    // Calculer l'AOV précédent
    const previousAOV = previousOrdersCount > 0 ? previousSales / previousOrdersCount : 0;
    
    // Créer les métriques avec comparaison
    return {
      sales: calculateChangeMetrics(currentSales, previousSales, "FCFA"),
      orders: calculateChangeMetrics(currentOrdersCount, previousOrdersCount),
      customers: calculateChangeMetrics(currentCustomersCount, previousCustomersCount),
      averageOrderValue: calculateChangeMetrics(currentAOV, previousAOV, "FCFA"),
      conversionRate: {
        value: "32%", // À intégrer avec le service d'analytics
        previousValue: "28%",
        change: 4,
        changePercentage: 14.3,
        trend: 'up',
        isPositive: true
      }
    };
  }

  /**
   * Récupère l'activité récente pour le vendeur
   */
  private async getRecentActivity(sellerId: string): Promise<RecentActivity> {
    // Récupérer les commandes récentes
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id, 
        customer_id,
        total_amount,
        status,
        payment_status,
        created_at,
        payment_method,
        order_items (
          id, 
          product_id,
          quantity,
          price
        )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Récupérer les interactions clients récentes
    const { data: recentInteractions } = await supabase
      .from('whatsapp_messages')
      .select(`
        id,
        customer_id,
        message_type,
        content,
        created_at,
        is_from_customer,
        intent
      `)
      .eq('seller_id', sellerId)
      .eq('is_from_customer', true)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Récupérer les changements d'inventaire récents
    const { data: inventoryChanges } = await supabase
      .from('inventory_changes')
      .select(`
        id,
        product_id,
        previous_stock,
        new_stock,
        change_reason,
        created_at
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Récupérer les informations des clients
    const customerIds = new Set([
      ...recentOrders?.map(o => o.customer_id) || [],
      ...recentInteractions?.map(i => i.customer_id) || []
    ]);
    
    const { data: customers } = await supabase
      .from('customers')
      .select('id, full_name, whatsapp_number')
      .in('id', Array.from(customerIds));
    
    // Mapper les clients par ID pour un accès facile
    const customerMap = new Map();
    customers?.forEach(c => customerMap.set(c.id, c));
    
    // Récupérer les informations des produits
    const productIds = new Set([
      ...inventoryChanges?.map(c => c.product_id) || [],
      ...recentOrders?.flatMap(o => o.order_items.map(item => item.product_id)) || []
    ]);
    
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', Array.from(productIds));
    
    // Mapper les produits par ID
    const productMap = new Map();
    products?.forEach(p => productMap.set(p.id, p));
    
    // Transformer les commandes
    const mappedOrders = recentOrders?.map(order => {
      const customer = customerMap.get(order.customer_id);
      return {
        id: order.id,
        customerName: customer?.full_name || 'Client inconnu',
        whatsappNumber: customer?.whatsapp_number || '',
        amount: order.total_amount,
        items: order.order_items.length,
        status: order.status,
        paymentMethod: order.payment_method || 'Non spécifié',
        timestamp: new Date(order.created_at)
      };
    }) || [];
    
    // Transformer les interactions clients
    const mappedInteractions = recentInteractions?.map(interaction => {
      const customer = customerMap.get(interaction.customer_id);
      let type: 'inquiry' | 'complaint' | 'feedback' | 'order' | 'return' | 'other' = 'inquiry';
      
      // Déterminer le type d'interaction basé sur l'intention ou le contenu
      if (interaction.intent === 'COMPLAINT' || interaction.content?.toLowerCase().includes('problème')) {
        type = 'complaint';
      } else if (interaction.intent === 'FEEDBACK' || interaction.content?.toLowerCase().includes('avis')) {
        type = 'feedback';
      } else if (interaction.intent === 'ORDER_PLACEMENT' || interaction.content?.toLowerCase().includes('commander')) {
        type = 'order';
      } else if (interaction.intent === 'RETURN' || interaction.content?.toLowerCase().includes('retour')) {
        type = 'return';
      }
      
      return {
        customerId: interaction.customer_id,
        customerName: customer?.full_name || 'Client inconnu',
        whatsappNumber: customer?.whatsapp_number || '',
        type,
        message: interaction.content || '',
        timestamp: new Date(interaction.created_at),
        resolved: false // Par défaut, considéré comme non résolu
      };
    }) || [];
    
    // Transformer les changements d'inventaire
    const mappedInventoryChanges = inventoryChanges?.map(change => {
      const product = productMap.get(change.product_id);
      
      let reason: 'sale' | 'restock' | 'return' | 'adjustment' | 'expiration' = 'adjustment';
      
      // Déterminer la raison du changement
      if (change.change_reason === 'sale' || change.new_stock < change.previous_stock) {
        reason = 'sale';
      } else if (change.change_reason === 'restock' || change.new_stock > change.previous_stock) {
        reason = 'restock';
      } else if (change.change_reason === 'return') {
        reason = 'return';
      } else if (change.change_reason === 'expiration') {
        reason = 'expiration';
      }
      
      return {
        productId: change.product_id,
        productName: product?.name || 'Produit inconnu',
        previousStock: change.previous_stock,
        currentStock: change.new_stock,
        reason,
        timestamp: new Date(change.created_at)
      };
    }) || [];
    
    return {
      orders: mappedOrders,
      customerInteractions: mappedInteractions,
      inventoryChanges: mappedInventoryChanges
    };
  }

  /**
   * Récupère les notifications pour le tableau de bord
   */
  private async getNotifications(sellerId: string): Promise<DashboardNotification[]> {
    // Récupérer les notifications existantes
    const { data: existingNotifications } = await supabase
      .from('seller_notifications')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('read', false)
      .order('created_at', { ascending: false });

    // Liste à retourner
    const notifications: DashboardNotification[] = [];
    
    // Transformer les notifications existantes
    if (existingNotifications) {
      for (const notif of existingNotifications) {
        notifications.push({
          id: notif.id,
          type: notif.type as NotificationType,
          title: notif.title,
          message: notif.message,
          timestamp: new Date(notif.created_at),
          priority: notif.priority as NotificationPriority,
          read: notif.read,
          action: notif.action_url ? {
            label: notif.action_label || 'Voir',
            url: notif.action_url
          } : undefined
        });
      }
    }
    
    // Générer de nouvelles notifications basées sur l'état actuel
    const urgentIssues = await determineUrgentIssues(sellerId);
    
    // Ajouter des notifications pour les problèmes urgents
    for (const issue of urgentIssues) {
      // Vérifier si cette notification existe déjà
      const exists = notifications.some(n => 
        n.title.includes(issue.title) && new Date().getTime() - n.timestamp.getTime() < 24 * 60 * 60 * 1000
      );
      
      if (!exists) {
        // Créer une nouvelle notification
        const newNotification: DashboardNotification = {
          id: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: issue.type as NotificationType,
          title: issue.title,
          message: issue.message,
          timestamp: new Date(),
          priority: issue.priority as NotificationPriority,
          read: false,
          action: issue.actionUrl ? {
            label: issue.actionLabel || 'Voir',
            url: issue.actionUrl
          } : undefined
        };
        
        // L'ajouter à la liste et à la base de données
        notifications.push(newNotification);
        
        // Enregistrer dans la base de données pour référence future
        await supabase
          .from('seller_notifications')
          .insert({
            seller_id: sellerId,
            type: newNotification.type,
            title: newNotification.title,
            message: newNotification.message,
            created_at: newNotification.timestamp.toISOString(),
            priority: newNotification.priority,
            read: false,
            action_label: newNotification.action?.label,
            action_url: newNotification.action?.url
          });
      }
    }
    
    // Trier par priorité puis par date
    return notifications.sort((a, b) => {
      // D'abord par priorité
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Ensuite par date (plus récent d'abord)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }

  /**
   * Génère des actions recommandées pour le vendeur
   */
  private async getRecommendedActions(sellerId: string): Promise<RecommendedAction[]> {
    try {
      // Récupérer les actions sauvegardées
      const { data: savedActions } = await supabase
        .from('seller_recommended_actions')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('completed', false);
      
      // Transformer les actions sauvegardées
      const mappedActions = savedActions?.map(action => ({
        id: action.id,
        title: action.title,
        description: action.description,
        priority: action.priority as NotificationPriority,
        impact: action.impact as 'low' | 'medium' | 'high',
        effort: action.effort as 'low' | 'medium' | 'high',
        link: action.link,
        completed: action.completed
      })) || [];
      
      // Générer de nouvelles actions basées sur les données actuelles
      const newActions = await generateRecommendedActions(sellerId);
      
      // Fusionner avec les actions existantes en évitant les doublons
      for (const action of newActions) {
        const exists = mappedActions.some(a => a.title === action.title);
        
        if (!exists) {
          // Créer une nouvelle action en base
          const { data: newAction } = await supabase
            .from('seller_recommended_actions')
            .insert({
              seller_id: sellerId,
              title: action.title,
              description: action.description,
              priority: action.priority,
              impact: action.impact,
              effort: action.effort,
              link: action.link,
              completed: false,
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (newAction) {
            mappedActions.push({
              id: newAction.id,
              title: newAction.title,
              description: newAction.description,
              priority: newAction.priority as NotificationPriority,
              impact: newAction.impact as 'low' | 'medium' | 'high',
              effort: newAction.effort as 'low' | 'medium' | 'high',
              link: newAction.link,
              completed: newAction.completed
            });
          }
        }
      }
      
      // Trier par priorité et impact
      return mappedActions.sort((a, b) => {
        // D'abord par priorité
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        
        // Ensuite par impact
        const impactOrder = { high: 0, medium: 1, low: 2 };
        return impactOrder[a.impact] - impactOrder[b.impact];
      });
    } catch (error) {
      this.logger.error('Erreur lors de la génération des actions recommandées:', error);
      return [];
    }
  }

  /**
   * Récupère un résumé de l'inventaire
   */
  private async getInventorySummary(sellerId: string): Promise<{
    lowStock: number;
    outOfStock: number;
    totalProducts: number;
    topSellers: {
      id: string;
      name: string;
      sold: number;
      remaining: number;
    }[];
  }> {
    try {
      // Récupérer tous les produits du vendeur
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock, low_stock_threshold')
        .eq('seller_id', sellerId);
      
      if (!products) return {
        lowStock: 0,
        outOfStock: 0,
        totalProducts: 0,
        topSellers: []
      };
      
      // Compter les produits à faible stock et en rupture
      const lowStock = products.filter(p => {
        const threshold = p.low_stock_threshold || 5; // Seuil par défaut
        return p.stock > 0 && p.stock <= threshold;
      }).length;
      
      const outOfStock = products.filter(p => p.stock <= 0).length;
      const totalProducts = products.length;
      
      // Récupérer les ventes récentes pour déterminer les produits les plus vendus
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          quantity,
          orders!inner(
            id,
            seller_id,
            created_at
          )
        `)
        .eq('orders.seller_id', sellerId)
        .gte('orders.created_at', thirtyDaysAgo.toISOString());
      
      // Calculer les ventes par produit
      const productSales = new Map<string, number>();
      
      orderItems?.forEach(item => {
        const productId = item.product_id;
        productSales.set(productId, (productSales.get(productId) || 0) + item.quantity);
      });
      
      // Trouver les produits les plus vendus
      const topSellingProductIds = Array.from(productSales.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);
      
      // Créer le tableau des meilleurs vendeurs
      const topSellers = topSellingProductIds.map(id => {
        const product = products.find(p => p.id === id);
        return {
          id,
          name: product?.name || 'Produit inconnu',
          sold: productSales.get(id) || 0,
          remaining: product?.stock || 0
        };
      });
      
      return {
        lowStock,
        outOfStock,
        totalProducts,
        topSellers
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du résumé de l\'inventaire:', error);
      return {
        lowStock: 0,
        outOfStock: 0,
        totalProducts: 0,
        topSellers: []
      };
    }
  }

  /**
   * Génère des prévisions de ventes simples
   */
  private async generateForecast(
    sellerId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<{
    dailySales: number;
    weeklySales: number;
    monthlySales: number;
    trend: 'up' | 'down' | 'stable';
  }> {
    try {
      // Récupérer l'historique des ventes pour les 90 derniers jours
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { data: salesHistory } = await supabase
        .from('orders')
        .select('id, created_at, total_amount')
        .eq('seller_id', sellerId)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: true });
      
      if (!salesHistory || salesHistory.length === 0) {
        return {
          dailySales: 0,
          weeklySales: 0,
          monthlySales: 0,
          trend: 'stable'
        };
      }
      
      // Regrouper les ventes par jour
      const dailySales = new Map<string, number>();
      
      salesHistory.forEach(order => {
        const date = new Date(order.created_at);
        const dateStr = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
        
        dailySales.set(dateStr, (dailySales.get(dateStr) || 0) + order.total_amount);
      });
      
      // Calculer les moyennes sur différentes périodes
      const today = new Date().toISOString().split('T')[0];
      const last7Days = Array.from(dailySales.entries())
        .filter(([date]) => {
          const dateDiff = (new Date(today).getTime() - new Date(date).getTime()) / (1000 * 3600 * 24);
          return dateDiff <= 7;
        })
        .map(([_, amount]) => amount);
      
      const last30Days = Array.from(dailySales.entries())
        .filter(([date]) => {
          const dateDiff = (new Date(today).getTime() - new Date(date).getTime()) / (1000 * 3600 * 24);
          return dateDiff <= 30;
        })
        .map(([_, amount]) => amount);
      
      const last90Days = Array.from(dailySales.values());
      
      // Calculer les moyennes
      const avgDaily7 = last7Days.reduce((sum, val) => sum + val, 0) / (last7Days.length || 1);
      const avgDaily30 = last30Days.reduce((sum, val) => sum + val, 0) / (last30Days.length || 1);
      const avgDaily90 = last90Days.reduce((sum, val) => sum + val, 0) / (last90Days.length || 1);
      
      // Prévisions: moyenne pondérée favorisant les données récentes
      const forecastDaily = (avgDaily7 * 0.5) + (avgDaily30 * 0.3) + (avgDaily90 * 0.2);
      const forecastWeekly = forecastDaily * 7;
      const forecastMonthly = forecastDaily * 30;
      
      // Déterminer la tendance
      let trend: 'up' | 'down' | 'stable' = 'stable';
      
      if (avgDaily7 > avgDaily30) {
        trend = 'up';
      } else if (avgDaily7 < avgDaily30) {
        trend = 'down';
      }
      
      // ... suite du code précédent
      return {
        dailySales: Math.round(forecastDaily),
        weeklySales: Math.round(forecastWeekly),
        monthlySales: Math.round(forecastMonthly),
        trend
      };
    } catch (error) {
      this.logger.error('Erreur lors de la génération des prévisions:', error);
      return {
        dailySales: 0,
        weeklySales: 0,
        monthlySales: 0,
        trend: 'stable'
      };
    }
  }

  /**
   * Détermine la période du dashboard
   */
  private getDashboardPeriod(
    period: 'day' | 'week' | 'month',
    referenceDate: Date
  ): { startDate: Date; endDate: Date; label: string } {
    let startDate: Date;
    let endDate: Date;
    let label: string;

    switch (period) {
      case 'day':
        startDate = getStartOfDay(referenceDate);
        endDate = getEndOfDay(referenceDate);
        label = `Aujourd'hui (${formatDate(referenceDate)})`;
        break;
      case 'week':
        startDate = getStartOfWeek(referenceDate);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate = getEndOfDay(endDate);
        label = `Semaine du ${formatDate(startDate)} au ${formatDate(endDate)}`;
        break;
      case 'month':
        startDate = getStartOfMonth(referenceDate);
        endDate = getEndOfMonth(referenceDate);
        // Nom du mois en français
        const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(referenceDate);
        label = `${monthName} ${referenceDate.getFullYear()}`;
        break;
      default:
        startDate = getStartOfDay(referenceDate);
        endDate = getEndOfDay(referenceDate);
        label = `Aujourd'hui (${formatDate(referenceDate)})`;
    }

    return { startDate, endDate, label };
  }

  /**
   * Marque une notification comme lue
   */
  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      // Si c'est une notification automatique, on ne fait rien
      if (notificationId.startsWith('auto_')) {
        return true;
      }
      
      const { error } = await supabase
        .from('seller_notifications')
        .update({ read: true })
        .eq('id', notificationId);
        
      return !error;
    } catch (error) {
      this.logger.error(`Erreur lors du marquage de la notification ${notificationId}:`, error);
      return false;
    }
  }
  
  /**
   * Marque une action recommandée comme complétée
   */
  async markActionAsCompleted(actionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('seller_recommended_actions')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', actionId);
        
      return !error;
    } catch (error) {
      this.logger.error(`Erreur lors du marquage de l'action ${actionId}:`, error);
      return false;
    }
  }
  
  /**
   * Récupère les préférences du dashboard pour un vendeur
   */
  async getDashboardPreferences(sellerId: string): Promise<{
    favoriteMetrics: string[];
    hiddenSections: string[];
    defaultDateRange: string;
    notificationSettings: Record<string, boolean>;
  }> {
    try {
      const { data, error } = await supabase
        .from('seller_preferences')
        .select('dashboard_preferences')
        .eq('seller_id', sellerId)
        .single();
      
      if (error || !data?.dashboard_preferences) {
        // Retourner les préférences par défaut
        return {
          favoriteMetrics: ['sales', 'orders', 'customers'],
          hiddenSections: [],
          defaultDateRange: 'day',
          notificationSettings: {
            email: true,
            whatsapp: true,
            inApp: true,
            salesAlerts: true,
            inventoryAlerts: true
          }
        };
      }
      
      return data.dashboard_preferences;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des préférences:`, error);
      // Retourner les préférences par défaut
      return {
        favoriteMetrics: ['sales', 'orders', 'customers'],
        hiddenSections: [],
        defaultDateRange: 'day',
        notificationSettings: {
          email: true,
          whatsapp: true,
          inApp: true,
          salesAlerts: true,
          inventoryAlerts: true
        }
      };
    }
  }
  
  /**
   * Sauvegarde les préférences du dashboard pour un vendeur
   */
  async saveDashboardPreferences(
    sellerId: string,
    preferences: {
      favoriteMetrics?: string[];
      hiddenSections?: string[];
      defaultDateRange?: string;
      notificationSettings?: Record<string, boolean>;
    }
  ): Promise<boolean> {
    try {
      // Récupérer les préférences existantes
      const { data: existing } = await supabase
        .from('seller_preferences')
        .select('dashboard_preferences')
        .eq('seller_id', sellerId)
        .single();
      
      let updatedPreferences;
      
      if (existing?.dashboard_preferences) {
        // Fusionner avec les préférences existantes
        updatedPreferences = {
          ...existing.dashboard_preferences,
          ...preferences
        };
        
        // Mettre à jour les sous-objets si fournis
        if (preferences.notificationSettings) {
          updatedPreferences.notificationSettings = {
            ...existing.dashboard_preferences.notificationSettings,
            ...preferences.notificationSettings
          };
        }
      } else {
        // Créer de nouvelles préférences
        updatedPreferences = {
          favoriteMetrics: preferences.favoriteMetrics || ['sales', 'orders', 'customers'],
          hiddenSections: preferences.hiddenSections || [],
          defaultDateRange: preferences.defaultDateRange || 'day',
          notificationSettings: preferences.notificationSettings || {
            email: true,
            whatsapp: true,
            inApp: true,
            salesAlerts: true,
            inventoryAlerts: true
          }
        };
      }
      
      // Mettre à jour ou insérer
      const { error } = await supabase
        .from('seller_preferences')
        .upsert({
          seller_id: sellerId,
          dashboard_preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        });
      
      return !error;
    } catch (error) {
      this.logger.error(`Erreur lors de la sauvegarde des préférences:`, error);
      return false;
    }
  }
}