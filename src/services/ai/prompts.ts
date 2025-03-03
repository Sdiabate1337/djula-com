import { CustomerPreferences, MessageContext, IntentType } from '../../types/ai.types';

/**
 * Creates a prompt to determine user intent from the message
 */
export function createIntentPrompt(
  message: string,
  preferences: CustomerPreferences,
  context: MessageContext
): string {
  // Extract recent conversation history
  const recentMessages = context.conversationHistory
    ?.slice(-5)
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n') || 'Pas d\'historique';

  return `
Tu es un assistant commercial pour une boutique en ligne africaine. Tu dois analyser ce message et déterminer l'intention du client.
Le message est: "${message}"

Contexte de la conversation récente:
${recentMessages}

État actuel:
${context.currentOrder ? `Commande en cours: ${JSON.stringify(context.currentOrder, null, 2)}` : 'Pas de commande en cours'}
${context.lastIntent ? `Dernière intention: ${context.lastIntent.type}` : ''}

Préférences client:
- Langue préférée: ${preferences.preferredLanguage || 'fr'}
- Catégories préférées: ${preferences.preferredCategories?.join(', ') || 'Non spécifié'}
- Méthodes de paiement préférées: ${preferences.preferredPaymentMethods?.join(', ') || 'Non spécifié'}

Analyse l'intention du client en te basant sur son message. Les types d'intention possibles sont:
- CATALOG_BROWSE: Le client parcourt le catalogue ou recherche des catégories de produits
- PRODUCT_QUERY: Le client demande des informations sur un produit spécifique
- ORDER_PLACEMENT: Le client veut commander un produit ou ajouter au panier
- ORDER_STATUS: Le client veut connaître l'état de sa commande
- PAYMENT: Le client veut effectuer ou discuter d'un paiement
- CUSTOMER_SUPPORT: Le client a besoin d'aide ou souhaite contacter le service client
- UNKNOWN: L'intention n'est pas claire

Retourne un JSON avec:
{
  "type": "CATALOG_BROWSE" | "PRODUCT_QUERY" | "ORDER_PLACEMENT" | "ORDER_STATUS" | "PAYMENT" | "CUSTOMER_SUPPORT" | "UNKNOWN",
  "confidence": number (0-1),
  "parameters": {
    // Extrais tous les paramètres pertinents du message (produits, quantités, etc.)
  },
  "context": {
    "previousIntent": "${context.lastIntent?.type || ''}",
    "orderInProgress": boolean,
    "productDiscussion": boolean
  }
}`;
}

/**
 * Creates a prompt to generate a natural language response
 */
export function createResponsePrompt(
  intentType: IntentType | string,
  preferences: CustomerPreferences,
  actionsContext: string = ''
): string {
  // Determine language from preferences
  const language = preferences?.preferredLanguage || 'fr';
  const isFrench = language === 'fr';

  return `
Tu es un assistant commercial amical pour une boutique en ligne africaine.
Réponds au client de manière naturelle et engageante ${isFrench ? 'en français' : 'en anglais'}.

Intention détectée: ${intentType}

Préférences client:
- Langue préférée: ${language}
- Catégories préférées: ${preferences?.preferredCategories?.join(', ') || 'Non spécifié'}

Contexte des actions réalisées:
${actionsContext}

Règles:
1. Utilise la langue préférée du client (${isFrench ? 'français' : 'anglais'})
2. Sois professionnel mais chaleureux, avec un style adapté au marché africain
3. Si des produits sont mentionnés, inclus leurs détails importants (prix, disponibilité)
4. Pour les commandes, confirme toujours les détails essentiels
5. Si tu présentes des options de paiement, mentionne spécifiquement le mobile money
6. Utilise des formulations claires et simples
7. N'invente pas de détails qui ne sont pas fournis dans le contexte
8. Reste concis car c'est une conversation WhatsApp (maximum 400 caractères)
9. N'utilise pas de liens sauf s'ils font partie des informations de paiement

Génère une réponse naturelle et utile.`;
}

/**
 * Creates a prompt for product recommendations
 */
export function createRecommendationPrompt(
  customerPreferences: CustomerPreferences,
  purchaseHistory: any[] = [],
  viewedProducts: any[] = []
): string {
  return `
En tant qu'assistant commercial pour une boutique en ligne africaine, recommande des produits pertinents pour ce client.

Préférences client:
- Catégories préférées: ${customerPreferences.preferredCategories?.join(', ') || 'Non spécifié'}
- Gamme de prix: ${customerPreferences.priceRange ? `${customerPreferences.priceRange.min} - ${customerPreferences.priceRange.max}` : 'Non spécifié'}

Historique d'achat récent:
${purchaseHistory.length > 0 ? JSON.stringify(purchaseHistory, null, 2) : 'Pas d\'historique d\'achat'}

Produits récemment consultés:
${viewedProducts.length > 0 ? JSON.stringify(viewedProducts, null, 2) : 'Aucun produit consulté récemment'}

Génère 3-5 recommandations de produits pertinentes basées sur ces informations. Pour chaque produit, fournis:
1. Un nom accrocheur
2. Un prix raisonnable
3. Une courte description attrayante
4. Une explication de pourquoi ce produit pourrait intéresser ce client

Retourne les recommandations au format JSON.`;
}