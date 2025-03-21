import { useState, useEffect } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/src/components/dashboard/DashboardLayout';
import useAuth from '@/src/hooks/useAuth';
import { useSettings } from '@/src/contexts/SettingsContext';

export default function SettingsPage() {
  const { user, loading } = useAuth('SELLER');
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Paramètres locaux pour le formulaire
  const [generalSettings, setGeneralSettings] = useState(settings.general);
  const [notificationSettings, setNotificationSettings] = useState(settings.notifications);
  const [advancedSettings, setAdvancedSettings] = useState(settings.advanced);

  // Mettre à jour les états locaux quand les paramètres globaux changent
  useEffect(() => {
    if (!settingsLoading) {
      setGeneralSettings(settings.general);
      setNotificationSettings(settings.notifications);
      setAdvancedSettings(settings.advanced);
    }
  }, [settings, settingsLoading]);

  const handleGeneralSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setGeneralSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNotificationSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    
    setNotificationSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleAdvancedSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked, type, value } = e.target;
    
    setAdvancedSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateNewApiKey = () => {
    const newApiKey = `djula_${Math.random().toString(36).substring(2, 15)}`;
    setAdvancedSettings(prev => ({
      ...prev,
      apiKey: newApiKey
    }));
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      // Utiliser la fonction updateSettings du contexte global
      const success = await updateSettings({
        general: generalSettings,
        notifications: notificationSettings,
        advanced: advancedSettings
      });
      
      if (success) {
        setSuccessMessage('Paramètres enregistrés avec succès');
        
        // Cacher le message de succès après 3 secondes
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        setErrorMessage('Une erreur est survenue lors de l\'enregistrement des paramètres');
      }
    } catch (error) {
      setErrorMessage('Une erreur est survenue lors de l\'enregistrement des paramètres');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || settingsLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Paramètres | Djula Commerce</title>
      </Head>

      <DashboardLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurez les paramètres de votre boutique
          </p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {errorMessage}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Onglets de navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'general'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-cog mr-2"></i>
                Général
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'notifications'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-bell mr-2"></i>
                Notifications
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'advanced'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-code mr-2"></i>
                Avancé
              </button>
            </nav>
          </div>

          <div className="p-6">
            <form onSubmit={saveSettings}>
              {/* Paramètres généraux */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres généraux</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                          Devise
                        </label>
                        <select
                          id="currency"
                          name="currency"
                          value={generalSettings.currency}
                          onChange={handleGeneralSettingsChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="XOF">Franc CFA (FCFA)</option>
                          <option value="EUR">Euro (€)</option>
                          <option value="USD">Dollar américain ($)</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                          Langue
                        </label>
                        <select
                          id="language"
                          name="language"
                          value={generalSettings.language}
                          onChange={handleGeneralSettingsChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="fr">Français</option>
                          <option value="en">Anglais</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                          Fuseau horaire
                        </label>
                        <select
                          id="timezone"
                          name="timezone"
                          value={generalSettings.timezone}
                          onChange={handleGeneralSettingsChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="Africa/Abidjan">Abidjan (GMT+0)</option>
                          <option value="Africa/Lagos">Lagos (GMT+1)</option>
                          <option value="Europe/Paris">Paris (GMT+1)</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="defaultSortOrder" className="block text-sm font-medium text-gray-700 mb-1">
                          Tri par défaut des produits
                        </label>
                        <select
                          id="defaultSortOrder"
                          name="defaultSortOrder"
                          value={generalSettings.defaultSortOrder}
                          onChange={handleGeneralSettingsChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="newest">Plus récent</option>
                          <option value="oldest">Plus ancien</option>
                          <option value="price_asc">Prix croissant</option>
                          <option value="price_desc">Prix décroissant</option>
                          <option value="popularity">Popularité</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="showOutOfStock"
                          name="showOutOfStock"
                          checked={generalSettings.showOutOfStock}
                          onChange={handleGeneralSettingsChange}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showOutOfStock" className="ml-2 block text-sm text-gray-700">
                          Afficher les produits en rupture de stock
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="autoApproveReviews"
                          name="autoApproveReviews"
                          checked={generalSettings.autoApproveReviews}
                          onChange={handleGeneralSettingsChange}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label htmlFor="autoApproveReviews" className="ml-2 block text-sm text-gray-700">
                          Approuver automatiquement les avis clients
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Paramètres de notification */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres de notification</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Configurez quand et comment vous souhaitez être notifié.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Nouvelle commande</h4>
                          <p className="text-xs text-gray-500">Recevoir une notification pour chaque nouvelle commande</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="newOrder"
                            checked={notificationSettings.newOrder}
                            onChange={handleNotificationSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Stock bas</h4>
                          <p className="text-xs text-gray-500">Être averti quand un produit est presque en rupture de stock</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="lowStock"
                            checked={notificationSettings.lowStock}
                            onChange={handleNotificationSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Messages clients</h4>
                          <p className="text-xs text-gray-500">Être notifié lorsqu'un client vous envoie un message</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="customerMessages"
                            checked={notificationSettings.customerMessages}
                            onChange={handleNotificationSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Avis produits</h4>
                          <p className="text-xs text-gray-500">Être notifié lorsqu'un client laisse un avis sur un produit</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="productReviews"
                            checked={notificationSettings.productReviews}
                            onChange={handleNotificationSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Résumé quotidien</h4>
                          <p className="text-xs text-gray-500">Recevoir un résumé quotidien de votre activité</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="dailySummary"
                            checked={notificationSettings.dailySummary}
                            onChange={handleNotificationSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Résumé hebdomadaire</h4>
                          <p className="text-xs text-gray-500">Recevoir un résumé hebdomadaire de votre activité</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="weeklySummary"
                            checked={notificationSettings.weeklySummary}
                            onChange={handleNotificationSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Mises à jour marketing</h4>
                          <p className="text-xs text-gray-500">Recevoir des conseils et astuces pour améliorer vos ventes</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="marketingUpdates"
                            checked={notificationSettings.marketingUpdates}
                            onChange={handleNotificationSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Paramètres avancés */}
              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Paramètres avancés</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Ces paramètres sont destinés aux utilisateurs avancés. Modifiez-les avec précaution.
                    </p>

                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <i className="fas fa-exclamation-triangle text-yellow-600"></i>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">Attention</h3>
                          <div className="text-sm text-yellow-700">
                            <p>
                              Certains paramètres dans cette section peuvent affecter le fonctionnement de votre boutique. 
                              Modifiez-les uniquement si vous savez ce que vous faites.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Activer l'accès API</h4>
                          <p className="text-xs text-gray-500">Permettre aux applications tierces d'accéder à votre boutique via l'API</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="enableAPIAccess"
                            checked={advancedSettings.enableAPIAccess}
                            onChange={handleAdvancedSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      {advancedSettings.enableAPIAccess && (
                        <div className="ml-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Clé API
                          </label>
                          <div className="flex">
                            <input
                              type="text"
                              value={advancedSettings.apiKey}
                              readOnly
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-50 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={generateNewApiKey}
                              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-r-lg border border-gray-300 border-l-0"
                            >
                              Regénérer
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Cette clé donne accès à votre boutique. Gardez-la secrète et ne la partagez jamais.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Mode maintenance</h4>
                          <p className="text-xs text-gray-500">Afficher une page de maintenance aux visiteurs pendant que vous effectuez des modifications</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="maintenanceMode"
                            checked={advancedSettings.maintenanceMode}
                            onChange={handleAdvancedSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Mode debug</h4>
                          <p className="text-xs text-gray-500">Activer les messages d'erreur détaillés et la journalisation avancée</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="debugMode"
                            checked={advancedSettings.debugMode}
                            onChange={handleAdvancedSettingsChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSaving ? 'Enregistrement...' : (
                    <span>
                      <i className="fas fa-save mr-2"></i>
                      Enregistrer les paramètres
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
