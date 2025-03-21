import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface GeneralSettings {
  currency: string;
  language: string;
  timezone: string;
  showOutOfStock: boolean;
  autoApproveReviews: boolean;
  defaultSortOrder: string;
}

interface NotificationSettings {
  newOrder: boolean;
  lowStock: boolean;
  customerMessages: boolean;
  productReviews: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  marketingUpdates: boolean;
}

interface AdvancedSettings {
  enableAPIAccess: boolean;
  apiKey: string;
  maintenanceMode: boolean;
  debugMode: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  notifications: NotificationSettings;
  advanced: AdvancedSettings;
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<boolean>;
  isLoading: boolean;
}

const defaultSettings: AppSettings = {
  general: {
    currency: 'XOF',
    language: 'fr',
    timezone: 'Africa/Abidjan',
    showOutOfStock: true,
    autoApproveReviews: false,
    defaultSortOrder: 'newest'
  },
  notifications: {
    newOrder: true,
    lowStock: true,
    customerMessages: true,
    productReviews: true,
    dailySummary: false,
    weeklySummary: true,
    marketingUpdates: true
  },
  advanced: {
    enableAPIAccess: false,
    apiKey: '',
    maintenanceMode: false,
    debugMode: false
  }
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: async () => false,
  isLoading: true
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les paramètres au démarrage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/settings');
        
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Mettre à jour les paramètres
  const updateSettings = async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    try {
      // Fusionner les nouvelles valeurs avec les existantes
      const updatedSettings = {
        ...settings,
        general: { ...settings.general, ...(newSettings.general || {}) },
        notifications: { ...settings.notifications, ...(newSettings.notifications || {}) },
        advanced: { ...settings.advanced, ...(newSettings.advanced || {}) }
      };

      // Appel API pour sauvegarder
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        setSettings(updatedSettings);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres:', error);
      return false;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};