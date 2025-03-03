import type { 
  Intent, 
  CustomerPreferences, 
  MessageContext,
  ConversationState 
} from '../../types/ai.types.js';
import { ProductService } from '../product/product.service.js';
import { ConversationService } from '../context/conversation.service.js';
import { createIntentPrompt, createResponsePrompt } from './prompts.js';
import OpenAI from 'openai';

export class IntentHandler {
  private openai: OpenAI;
  private productService: ProductService;
  private conversationService: ConversationService;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OpenAI API key');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.productService = new ProductService();
    this.conversationService = new ConversationService();
  }

  async handleIntent(
    message: string,
    customerId: string,
    state: ConversationState
  ): Promise<string> {
    try {
      // Get customer preferences and context
      const preferences = await this.conversationService.getCustomerPreferences(customerId);
      const context = await this.conversationService.getConversationContext(customerId);

      // Generate intent prompt
      const intentPrompt = createIntentPrompt(message, preferences, context, state);
      
      // Get intent from OpenAI
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: intentPrompt }],
        temperature: 0.7,
        max_tokens: 150
      });

      const intent = completion.choices[0]?.message?.content || '';

      // Get relevant products if needed
      let productContext = '';
      if (intent.toLowerCase().includes('product') || intent.toLowerCase().includes('catalogue')) {
        const productQuery = await this.extractProductQuery(message);
        const products = await this.productService.searchProducts({
          term: productQuery.term,
          category: productQuery.category,
          priceRange: productQuery.minPrice && productQuery.maxPrice ? {
            min: productQuery.minPrice,
            max: productQuery.maxPrice
          } : undefined,
          limit: 5
        });
        productContext = `Available products:\n${JSON.stringify(products, null, 2)}`;
      }

      // Generate response based on intent
      const responsePrompt = createResponsePrompt(intent, preferences, productContext);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: responsePrompt }],
        temperature: 0.7,
        max_tokens: 250
      });

      // Update conversation context
      await this.conversationService.updateConversationContext(customerId, message, intent);

      return response.choices[0]?.message?.content || "Je m'excuse, je n'ai pas compris. Pouvez-vous reformuler?";
    } catch (error) {
      console.error('Error in intent handling:', error);
      throw error;
    }
  }

  private async extractProductQuery(message: string): Promise<{
    term?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `Extract product search parameters from: "${message}". Return JSON with fields: term, category, minPrice, maxPrice`
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      const result = completion.choices[0]?.message?.content;
      return result ? JSON.parse(result) : {};
    } catch (error) {
      console.error('Error extracting product query:', error);
      return {};
    }
  }
}
