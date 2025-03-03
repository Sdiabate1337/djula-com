export enum BusinessType {
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
  SERVICES = 'services',
  FOOD = 'food',
  FASHION = 'fashion',
  OTHER = 'other'
}

export enum UserRole {
  SELLER = 'seller',
  ADMIN = 'admin'
}

export interface SellerProfile {
  id: string;
  fullName: string;
  brandName: string;
  whatsappNumber: string;
  city: string;
  businessType: BusinessType;
  role: UserRole;
  isWhatsappConnected: boolean;
  profileImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerRegistrationData {
  fullName: string;
  brandName: string;
  whatsappNumber: string;
  city: string;
  businessType: BusinessType;
}

export interface SellerLoginData {
  fullName: string;
  whatsappNumber: string;
}
