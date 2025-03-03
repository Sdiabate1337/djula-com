import { supabase } from '../supabase/supabase.client';
import { 
  RegionalInsight, 
  PaymentMethodInsight,
  SalesTimeInsight,
  WhatsAppInsight,
  RecommendedAction
} from '../../types/dashboard.types';
import {
  getStartOfDay,    
  getEndOfDay,
  subtractDays,
  subtractMonths,
  formatDateToUTC,
  formatDateTime,
  formatDate
} from '../../utils/date.utils';

export class InsightsService {
  /**
   * Récupère les insights régionaux pour un vendeur
   */
  async getRegionalInsights(
    sellerId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<RegionalInsight[]> {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          customer_id,
          shipping_address,
          items:order_items(product_id, quantity, price)
        `)
        .eq('seller_id', sellerId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Type intermédiaire avec Set pour suivre les clients uniques
      interface RegionData {
        region: string;
        sales: number;
        orders: number;
        customers: Set<string>;
        topProducts: {
          id: string;
          name: string;
          sales: number;
        }[];
      }

      // Agregation par région
      const regionMap = new Map<string, RegionData>();

      // Récupérer les informations des clients pour obtenir leur région
      const customerIds = [...new Set(orders.map(o => o.customer_id))];
      const { data: customers } = await supabase
        .from('customers')
        .select('id, region, city')
        .in('id', customerIds);

      const customerMap = new Map();
      customers?.forEach(c => customerMap.set(c.id, c));

      // Récupérer les produits pour les top produits par région
      const productIds = [...new Set(orders.flatMap(o => o.items.map(item => item.product_id)))];
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);

      const productMap = new Map();
      products?.forEach(p => productMap.set(p.id, p));

      // Analyser les commandes par région
      for (const order of orders) {
        // Déterminer la région (depuis l'adresse ou le client)
        let region = 'Inconnue';
        
        if (order.shipping_address?.city) {
          region = order.shipping_address.city;
        } else if (customerMap.has(order.customer_id)) {
          region = customerMap.get(order.customer_id).city || 
                  customerMap.get(order.customer_id).region || 'Inconnue';
        }

        // Initialiser la région si elle n'existe pas
        if (!regionMap.has(region)) {
          regionMap.set(region, {
            region: region,
            sales: 0,
            orders: 0,
            customers: new Set(),
            topProducts: []
          });
        }

        const regionData = regionMap.get(region)!;
        regionData.sales += order.total_amount;
        regionData.orders += 1;
        regionData.customers.add(order.customer_id);

        // Tracker les produits vendus
        const productSales = new Map<string, number>();
        for (const item of order.items) {
          const productId = item.product_id;
          productSales.set(
            productId, 
            (productSales.get(productId) || 0) + item.price * item.quantity
          );
        }

        // Mettre à jour les top produits
        for (const [productId, sales] of productSales.entries()) {
          const product = productMap.get(productId);
          if (!product) continue;

          // Vérifier si le produit est déjà dans les tops
          const existingIndex = regionData.topProducts.findIndex(p => p.id === productId);
          
          if (existingIndex >= 0) {
            regionData.topProducts[existingIndex].sales += sales;
          } else {
            regionData.topProducts.push({
              id: productId,
              name: product.name,
              sales: sales
            });
          }
        }
      }

      // Finaliser les données et convertir les Sets en nombres
      const result: RegionalInsight[] = [];
      for (const [region, data] of regionMap.entries()) {
        // Trier les top produits
        data.topProducts.sort((a, b) => b.sales - a.sales);
        
        result.push({
          region: data.region,
          sales: data.sales,
          orders: data.orders,
          customers: data.customers.size,
          topProducts: data.topProducts.slice(0, 5) // Garder les 5 meilleurs (une seule fois)
        });
      }

      // Trier par ventes
      return result.sort((a, b) => b.sales - a.sales);
    } catch (error) {
      console.error('Erreur lors de la récupération des insights régionaux:', error);
      return [];
    }
  }

  /**
   * Récupère les insights sur les méthodes de paiement
   */
  async getPaymentMethodInsights(
    sellerId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<PaymentMethodInsight[]> {
    try {
      // Périodes pour la comparaison
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      const previousEndDate = new Date(endDate);
      previousEndDate.setDate(previousEndDate.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      
      // Récupérer les transactions de paiement actuelles
      const { data: currentTransactions, error } = await supabase
        .from('payment_transactions')
        .select(`
          id, 
          amount, 
          method,
          status,
          order_id
        `)
        .eq('status', 'COMPLETED')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Récupérer les ordres pour filtrer par vendeur
      const orderIds = currentTransactions.map(t => t.order_id);
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('seller_id', sellerId)
        .in('id', orderIds);

      const validOrderIds = new Set(orders?.map(o => o.id) || []);
      const filteredTransactions = currentTransactions.filter(t => validOrderIds.has(t.order_id));

      // Récupérer les transactions précédentes pour comparaison
      const { data: previousTransactions } = await supabase
        .from('payment_transactions')
        .select(`
          id, 
          amount, 
          method,
          status,
          order_id
        `)
        .eq('status', 'COMPLETED')
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString());

      // Filtrer les transactions précédentes par vendeur également
      const prevOrderIds = previousTransactions?.map(t => t.order_id) || [];
      const { data: prevOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('seller_id', sellerId)
        .in('id', prevOrderIds);

      const validPrevOrderIds = new Set(prevOrders?.map(o => o.id) || []);
      const filteredPrevTransactions = previousTransactions?.filter(t => validPrevOrderIds.has(t.order_id)) || [];

      // Agréger par méthode de paiement
      const methodMap = new Map<string, PaymentMethodInsight>();
      const prevMethodMap = new Map<string, { count: number, amount: number }>();

      // Agréger les données précédentes
      for (const transaction of filteredPrevTransactions) {
        const methodName = transaction.method.name;
        const methodType = transaction.method.type;
        
        if (!prevMethodMap.has(methodName)) {
          prevMethodMap.set(methodName, { count: 0, amount: 0 });
        }
        
        prevMethodMap.get(methodName)!.count += 1;
        prevMethodMap.get(methodName)!.amount += transaction.amount;
      }

      // Calculer le total actuel
      let totalCount = 0;
      let totalAmount = 0;
      
      // Agréger les données actuelles
      for (const transaction of filteredTransactions) {
        const methodName = transaction.method.name;
        const methodType = transaction.method.type;
        
        totalCount += 1;
        totalAmount += transaction.amount;
        
        if (!methodMap.has(methodName)) {
          methodMap.set(methodName, {
            method: methodName,
            type: methodType,
            count: 0,
            amount: 0,
            percentage: 0,
            trend: 'stable',
            change: 0,
            metadata: {}
          });
        }
        
        const methodData = methodMap.get(methodName)!;
        methodData.count += 1;
        methodData.amount += transaction.amount;
      }

      // Finaliser les calculs et déterminer les tendances
      const results: PaymentMethodInsight[] = [];
      
      for (const [methodName, data] of methodMap.entries()) {
        const percentage = totalCount > 0 ? (data.count / totalCount) * 100 : 0;
        data.percentage = Math.round(percentage * 10) / 10; // arrondi à 1 décimale
        
        // Calculer la tendance
        const prevData = prevMethodMap.get(methodName);
        if (prevData) {
          const prevPercentage = filteredPrevTransactions.length > 0 ? 
            (prevData.count / filteredPrevTransactions.length) * 100 : 0;
          const change = percentage - prevPercentage;
          data.change = Math.round(change * 10) / 10;
          
          if (change > 2) data.trend = 'up';
          else if (change < -2) data.trend = 'down';
          else data.trend = 'stable';
        }
        
        results.push(data);
      }

      // Trier par popularité
      return results.sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Erreur lors de la récupération des insights sur les méthodes de paiement:', error);
      return [];
    }
  }

  /**
   * Récupère les insights sur les heures de vente
   */
  async getSalesTimingInsights(
    sellerId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<SalesTimeInsight[]> {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, 
          created_at,
          total_amount
        `)
        .eq('seller_id', sellerId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Initialiser la matrice de temps (jour de la semaine x heure)
      const timingMatrix: {[key: string]: SalesTimeInsight} = {};
      
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`;
          timingMatrix[key] = {
            hourOfDay: hour,
            dayOfWeek: day,
            volume: 'low',
            ordersCount: 0,
            salesAmount: 0
          };
        }
      }

      // Remplir avec les données réelles
      for (const order of orders) {
        const orderDate = new Date(order.created_at);
        const dayOfWeek = orderDate.getUTCDay(); // 0 = Dimanche, 1 = Lundi, etc.
        const hourOfDay = orderDate.getUTCHours();
        
        const key = `${dayOfWeek}-${hourOfDay}`;
        if (timingMatrix[key]) {
          timingMatrix[key].ordersCount += 1;
          timingMatrix[key].salesAmount += order.total_amount;
        }
      }

      // Convertir en tableau et trier
      const insights: SalesTimeInsight[] = Object.values(timingMatrix);
      
      // Déterminer le volume en fonction des quantiles
      if (insights.length > 0) {
        // Calculer les seuils pour le volume
        const sortedCounts = insights
          .filter(i => i.ordersCount > 0)  // Ne considérer que les périodes avec commandes
          .map(i => i.ordersCount)
          .sort((a, b) => a - b);
        
        const q1Idx = Math.floor(sortedCounts.length * 0.25);
        const q2Idx = Math.floor(sortedCounts.length * 0.5);
        const q3Idx = Math.floor(sortedCounts.length * 0.75);
        
        const q1 = sortedCounts[q1Idx] || 0;
        const q2 = sortedCounts[q2Idx] || 0;
        const q3 = sortedCounts[q3Idx] || 0;
        
        // Attribuer le niveau de volume
        for (const insight of insights) {
          if (insight.ordersCount === 0) {
            insight.volume = 'low';
          } else if (insight.ordersCount <= q1) {
            insight.volume = 'low';
          } else if (insight.ordersCount <= q2) {
            insight.volume = 'medium';
          } else if (insight.ordersCount <= q3) {
            insight.volume = 'high';
          } else {
            insight.volume = 'very_high';
          }
        }
      }

      // Trier par nombre de commandes
      return insights.sort((a, b) => b.ordersCount - a.ordersCount);
    } catch (error) {
      console.error('Erreur lors de la récupération des insights sur les heures de vente:', error);
      return [];
    }
  }

  /**
   * Récupère les insights WhatsApp
   */
  async getWhatsAppInsights(
    sellerId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<WhatsAppInsight> {
    try {
      // Messages WhatsApp
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select(`
          id,
          message_type,
          content,
          customer_id,
          created_at,
          is_from_customer,
          conversation_id,
          status,
          intent,
          metadata
        `)
        .eq('seller_id', sellerId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Récupérer les conversations
      const { data: conversations } = await supabase
        .from('whatsapp_conversations')
        .select(`
          id,
          customer_id,
          started_at,
          ended_at,
          status,
          intent,
          converted_to_sale,
          order_id
        `)
        .eq('seller_id', sellerId)
        .or(`ended_at.gte.${startDate.toISOString()},ended_at.is.null`)
        .gte('started_at', subtractDays(startDate, 7).toISOString())
        .lte('started_at', endDate.toISOString());

      // Analyser les conversations
      const completed = conversations?.filter(c => c.status === 'completed') || [];
      const active = conversations?.filter(c => c.status === 'active') || [];
      const abandoned = conversations?.filter(c => c.status === 'abandoned') || [];
      
      const totalConversations = conversations?.length || 0;
      
      // Calculer le temps de réponse moyen
      let totalResponseTime = 0;
      let responsesCount = 0;

      const customerMessages = messages?.filter(m => m.is_from_customer) || [];
      const sellerMessages = messages?.filter(m => !m.is_from_customer) || [];

      // Grouper les messages par conversation
      const conversationMessages = new Map<string, {customer: any[], seller: any[]}>();
      
      for (const msg of customerMessages) {
        if (!conversationMessages.has(msg.conversation_id)) {
          conversationMessages.set(msg.conversation_id, {customer: [], seller: []});
        }
        conversationMessages.get(msg.conversation_id)!.customer.push(msg);
      }
      
      for (const msg of sellerMessages) {
        if (!conversationMessages.has(msg.conversation_id)) {
          conversationMessages.set(msg.conversation_id, {customer: [], seller: []});
        }
        conversationMessages.get(msg.conversation_id)!.seller.push(msg);
      }

      // Calculer les temps de réponse
      for (const [convId, msgs] of conversationMessages.entries()) {
        const customerMsgs = msgs.customer.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const sellerMsgs = msgs.seller.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        for (const customerMsg of customerMsgs) {
          // Trouver la première réponse du vendeur après ce message
          const customerTime = new Date(customerMsg.created_at).getTime();
          const nextSellerMsg = sellerMsgs.find(m => new Date(m.created_at).getTime() > customerTime);
          
          if (nextSellerMsg) {
            const responseTime = (new Date(nextSellerMsg.created_at).getTime() - customerTime) / 1000 / 60; // en minutes
            if (responseTime < 60) { // ignorer les réponses très tardives (> 1h)
              totalResponseTime += responseTime;
              responsesCount++;
            }
          }
        }
      }

      // Calculer le taux de conversion
      const convertedCount = conversations?.filter(c => c.converted_to_sale)?.length || 0;
      const conversionRate = totalConversations > 0 ? (convertedCount / totalConversations) * 100 : 0;
      
      // Analyser les mots-clés
      const keywords = new Map<string, number>();
      const messageContents = customerMessages
        .filter(m => m.content && typeof m.content === 'string')
        .map(m => m.content);
      
      // Extraire les mots-clés des messages
      const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'et', 'pour', 'en', 'ce', 'de', 'du', 'je', 'tu', 'il', 'elle']);
      for (const content of messageContents) {
        const words = content.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
          .split(/\s+/);
        
        for (const word of words) {
          if (word.length > 2 && !stopWords.has(word)) {
            keywords.set(word, (keywords.get(word) || 0) + 1);
          }
        }
      }
      
      // Créer la liste des mots-clés les plus fréquents
      const topKeywords = Array.from(keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count }));
      
      // Agréger les conversations par intention
      const intentMap = new Map<string, { count: number; converted: number }>();
      for (const conv of conversations || []) {
        const intent = conv.intent || 'unknown';
        if (!intentMap.has(intent)) {
          intentMap.set(intent, { count: 0, converted: 0 });
        }
        
        const intentData = intentMap.get(intent)!;
        intentData.count += 1;
        if (conv.converted_to_sale) {
          intentData.converted += 1;
        }
      }
      
      // Créer la liste des conversations par intention
      const conversationsByIntent = Array.from(intentMap.entries())
        .map(([intent, data]) => ({
          intent,
          count: data.count,
          conversion: data.count > 0 ? (data.converted / data.count) * 100 : 0
        }));
      
      // Calculer le temps de réponse moyen
      const averageResponseTime = responsesCount > 0 ? totalResponseTime / responsesCount : 0;
      
      // Retourner l'objet conforme à l'interface WhatsAppInsight
      return {
        totalConversations,
        activeConversations: active.length,
        completedConversations: completed.length,
        abandonedConversations: abandoned.length,
        averageResponseTime,
        conversionRate,
        topKeywords,
        conversationsByIntent
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des insights WhatsApp:', error);
      
      // En cas d'erreur, retourner un objet par défaut
      return {
        totalConversations: 0,
        activeConversations: 0,
        completedConversations: 0,
        abandonedConversations: 0,
        averageResponseTime: 0,
        conversionRate: 0,
        topKeywords: [],
        conversationsByIntent: []
      };
    }
  }
}