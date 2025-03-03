import { supabase } from '../supabase/supabase.client';
import { 
  SellerProfile, 
  SellerRegistrationData, 
  SellerLoginData, 
  UserRole,
  BusinessType
} from '../../types/seller.types';
import { generateQRCode } from '../../utils/qrcode';

export class SellerService {
  private readonly SELLERS_TABLE = 'sellers';
  private readonly TOKENS_TABLE = 'seller_connection_tokens';

  async registerSeller(data: SellerRegistrationData): Promise<SellerProfile> {
    try {
      // Vérifier si le numéro WhatsApp existe déjà
      const { data: existing } = await supabase
        .from(this.SELLERS_TABLE)
        .select('whatsapp_number')
        .eq('whatsapp_number', data.whatsappNumber)
        .single();

      if (existing) {
        throw new Error('Ce numéro WhatsApp est déjà enregistré');
      }

      // Créer le profil vendeur
      const { data: seller, error } = await supabase
        .from(this.SELLERS_TABLE)
        .insert({
          full_name: data.fullName,
          brand_name: data.brandName,
          whatsapp_number: data.whatsappNumber,
          city: data.city,
          business_type: data.businessType.toLowerCase(),
          role: UserRole.SELLER,
          is_whatsapp_connected: false
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error('Erreur lors de l\'inscription');
      }

      return this.mapSellerProfile(seller);
    } catch (error) {
      console.error('Error in seller registration:', error);
      throw error;
    }
  }

  async loginSeller(data: SellerLoginData): Promise<SellerProfile> {
    try {
      const { data: seller, error } = await supabase
        .from(this.SELLERS_TABLE)
        .select('*')
        .eq('whatsapp_number', data.whatsappNumber)
        .eq('full_name', data.fullName)
        .single();

      if (error || !seller) {
        throw new Error('Nom ou numéro WhatsApp incorrect');
      }

      return this.mapSellerProfile(seller);
    } catch (error) {
      console.error('Error in seller login:', error);
      throw error;
    }
  }

  async getSellerByWhatsApp(whatsappNumber: string): Promise<SellerProfile | null> {
    try {
      const { data, error } = await supabase
        .from(this.SELLERS_TABLE)
        .select('*')
        .eq('whatsapp_number', whatsappNumber)
        .single();

      if (error || !data) return null;
      return this.mapSellerProfile(data);
    } catch (error) {
      console.error('Error getting seller by WhatsApp:', error);
      return null;
    }
  }

  async updateSellerProfile(sellerId: string, updates: Partial<SellerProfile>): Promise<SellerProfile> {
    try {
      const { data, error } = await supabase
        .from(this.SELLERS_TABLE)
        .update(this.mapProfileToDb(updates))
        .eq('id', sellerId)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error('Erreur lors de la mise à jour du profil');
      }

      return this.mapSellerProfile(data);
    } catch (error) {
      console.error('Error updating seller profile:', error);
      throw error;
    }
  }

  async generateConnectionQR(sellerId: string): Promise<string> {
    try {
      const token = `djula_${sellerId}_${Date.now()}`;
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Token expires in 5 minutes

      const { error } = await supabase
        .from(this.TOKENS_TABLE)
        .insert({
          seller_id: sellerId,
          token: token,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        console.error('Database error:', error);
        throw new Error('Erreur lors de la génération du QR code');
      }

      return await generateQRCode(token);
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  async verifyConnectionToken(sellerId: string, token: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(this.TOKENS_TABLE)
        .select('*')
        .eq('seller_id', sellerId)
        .eq('token', token)
        .is('used_at', null)
        .single();

      if (error || !data) return false;

      // Vérifier si le token n'est pas expiré
      if (new Date(data.expires_at) < new Date()) {
        return false;
      }

      // Marquer le token comme utilisé
      await supabase
        .from(this.TOKENS_TABLE)
        .update({ used_at: new Date().toISOString() })
        .eq('id', data.id);

      // Mettre à jour le statut de connexion WhatsApp du vendeur
      await supabase
        .from(this.SELLERS_TABLE)
        .update({ is_whatsapp_connected: true })
        .eq('id', sellerId);

      return true;
    } catch (error) {
      console.error('Error verifying connection token:', error);
      return false;
    }
  }

  public mapSellerProfile(dbData: any): SellerProfile {
    return {
      id: dbData.id,
      fullName: dbData.full_name,
      brandName: dbData.brand_name,
      whatsappNumber: dbData.whatsapp_number,
      city: dbData.city,
      businessType: dbData.business_type.toUpperCase() as BusinessType,
      role: dbData.role as UserRole,
      isWhatsappConnected: dbData.is_whatsapp_connected,
      profileImageUrl: dbData.profile_image_url,
      createdAt: new Date(dbData.created_at),
      updatedAt: new Date(dbData.updated_at)
    };
  }

  private mapProfileToDb(profile: Partial<SellerProfile>): any {
    const mapped: any = {};
    if (profile.fullName) mapped.full_name = profile.fullName;
    if (profile.brandName) mapped.brand_name = profile.brandName;
    if (profile.whatsappNumber) mapped.whatsapp_number = profile.whatsappNumber;
    if (profile.city) mapped.city = profile.city;
    if (profile.businessType) mapped.business_type = profile.businessType.toLowerCase();
    if (profile.profileImageUrl) mapped.profile_image_url = profile.profileImageUrl;
    if (profile.isWhatsappConnected !== undefined) mapped.is_whatsapp_connected = profile.isWhatsappConnected;
    return mapped;
  }
}
