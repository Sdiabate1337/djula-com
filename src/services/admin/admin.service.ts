import { supabase } from '../supabase/supabase.client';
import * as bcrypt from 'bcrypt';

export enum AdminRole {
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export interface AdminProfile {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  createdAt: Date;
  updatedAt?: Date;
}

export interface AdminCreationData {
  email: string;
  password: string;
  fullName: string;
  role: AdminRole;
}

export class AdminService {
  private readonly ADMINS_TABLE = 'admins';

  async createAdmin(data: AdminCreationData): Promise<AdminProfile> {
    try {
      // Vérifier si l'email existe déjà
      const { data: existing } = await supabase
        .from(this.ADMINS_TABLE)
        .select('email')
        .eq('email', data.email.toLowerCase())
        .single();

      if (existing) {
        throw new Error('Cet email est déjà utilisé');
      }

      // Hacher le mot de passe
      const passwordHash = await bcrypt.hash(data.password, 10);

      // Créer l'admin
      const { data: admin, error } = await supabase
        .from(this.ADMINS_TABLE)
        .insert({
          email: data.email.toLowerCase(),
          password_hash: passwordHash,
          full_name: data.fullName,
          role: data.role
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error('Erreur lors de la création de l\'administrateur');
      }

      return this.mapAdminProfile(admin);
    } catch (error) {
      console.error('Error in admin creation:', error);
      throw error;
    }
  }

  async loginAdmin(email: string, password: string): Promise<AdminProfile> {
    try {
      // Récupérer l'admin par email
      const { data: admin, error } = await supabase
        .from(this.ADMINS_TABLE)
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !admin) {
        throw new Error('Email ou mot de passe incorrect');
      }

      // Vérifier le mot de passe
      const passwordValid = await bcrypt.compare(password, admin.password_hash);
      if (!passwordValid) {
        throw new Error('Email ou mot de passe incorrect');
      }

      return this.mapAdminProfile(admin);
    } catch (error) {
      console.error('Error in admin login:', error);
      throw error;
    }
  }

  async getAdminById(adminId: string): Promise<AdminProfile | null> {
    try {
      const { data, error } = await supabase
        .from(this.ADMINS_TABLE)
        .select('*')
        .eq('id', adminId)
        .single();

      if (error || !data) return null;
      return this.mapAdminProfile(data);
    } catch (error) {
      console.error('Error getting admin by ID:', error);
      return null;
    }
  }

  private mapAdminProfile(dbData: any): AdminProfile {
    return {
      id: dbData.id,
      email: dbData.email,
      fullName: dbData.full_name,
      role: dbData.role as AdminRole,
      createdAt: new Date(dbData.created_at),
      updatedAt: dbData.updated_at ? new Date(dbData.updated_at) : undefined
    };
  }
}