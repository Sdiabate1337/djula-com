import { createClient } from '@supabase/supabase-js';
import { CustomerPreferences, DEFAULT_PREFERENCES } from '../../types/ai.types';

export interface Customer {
  id: string;
  phoneNumber: string;
  whatsappId: string;
  whatsappName: string;
  preferences: CustomerPreferences;
  metadata: {
    lastInteraction?: Date;
    totalInteractions?: number;
    lastOrderId?: string;
    language?: string;
    tags?: string[];
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  issue: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export class CustomerService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }

  async createOrUpdateCustomer(data: {
    phoneNumber: string;
    whatsappId: string;
    whatsappName: string;
    preferences?: Partial<CustomerPreferences>;
  }): Promise<Customer> {
    // Try to find existing customer by WhatsApp ID or phone number
    const existingCustomer = await this.findCustomer({
      whatsappId: data.whatsappId,
      phoneNumber: data.phoneNumber
    });

    if (existingCustomer) {
      // Update existing customer
      return this.updateCustomer(existingCustomer.id, {
        whatsappName: data.whatsappName,
        preferences: data.preferences,
        metadata: {
          ...existingCustomer.metadata,
          lastInteraction: new Date(),
          totalInteractions: (existingCustomer.metadata.totalInteractions || 0) + 1
        }
      });
    }

    // Create new customer
    const { data: customer, error } = await this.supabase
      .from('customers')
      .insert({
        phone_number: data.phoneNumber,
        whatsapp_id: data.whatsappId,
        whatsapp_name: data.whatsappName,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...data.preferences
        },
        metadata: {
          lastInteraction: new Date(),
          totalInteractions: 1,
          language: 'fr',
          tags: []
        },
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCustomerFromDB(customer);
  }

  async findCustomer(query: {
    id?: string;
    whatsappId?: string;
    phoneNumber?: string;
  }): Promise<Customer | null> {
    let dbQuery = this.supabase
      .from('customers')
      .select();

    if (query.id) {
      dbQuery = dbQuery.eq('id', query.id);
    } else if (query.whatsappId) {
      dbQuery = dbQuery.eq('whatsapp_id', query.whatsappId);
    } else if (query.phoneNumber) {
      dbQuery = dbQuery.eq('phone_number', query.phoneNumber);
    } else {
      throw new Error('At least one search parameter is required');
    }

    const { data: customer, error } = await dbQuery.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return customer ? this.mapCustomerFromDB(customer) : null;
  }

  async updateCustomer(
    customerId: string,
    data: Partial<{
      whatsappName: string;
      preferences: Partial<CustomerPreferences>;
      metadata: Partial<Customer['metadata']>;
    }>
  ): Promise<Customer> {
    const updates: any = {
      updated_at: new Date()
    };

    if (data.whatsappName) {
      updates.whatsapp_name = data.whatsappName;
    }

    if (data.preferences) {
      const customer = await this.findCustomer({ id: customerId });
      updates.preferences = {
        ...(customer?.preferences || DEFAULT_PREFERENCES),
        ...data.preferences
      };
    }

    if (data.metadata) {
      const customer = await this.findCustomer({ id: customerId });
      updates.metadata = {
        ...(customer?.metadata || {}),
        ...data.metadata
      };
    }

    const { data: updatedCustomer, error } = await this.supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return this.mapCustomerFromDB(updatedCustomer);
  }

  async updateCustomerPreferences(
    customerId: string,
    preferences: Partial<CustomerPreferences>
  ): Promise<Customer> {
    return this.updateCustomer(customerId, { preferences });
  }

  async getCustomerPreferences(customerId: string): Promise<CustomerPreferences> {
    const customer = await this.findCustomer({ id: customerId });
    return customer?.preferences || DEFAULT_PREFERENCES;
  }

  async createSupportTicket(data: {
    customerId: string;
    issue: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<SupportTicket> {
    const { data: ticket, error } = await this.supabase
      .from('support_tickets')
      .insert({
        customer_id: data.customerId,
        issue: data.issue,
        status: 'OPEN',
        priority: data.priority || 'MEDIUM',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTicketFromDB(ticket);
  }

  private mapCustomerFromDB(data: any): Customer {
    return {
      id: data.id,
      phoneNumber: data.phone_number,
      whatsappId: data.whatsapp_id,
      whatsappName: data.whatsapp_name,
      preferences: data.preferences,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapTicketFromDB(data: any): SupportTicket {
    return {
      id: data.id,
      customerId: data.customer_id,
      issue: data.issue,
      status: data.status,
      priority: data.priority,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined
    };
  }
}
