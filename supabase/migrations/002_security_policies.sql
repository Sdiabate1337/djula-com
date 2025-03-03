-- Activer RLS pour toutes les tables
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_connection_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Créer un rôle pour les vendeurs authentifiés
CREATE TYPE user_role AS ENUM ('seller', 'admin');
ALTER TABLE sellers ADD COLUMN role user_role DEFAULT 'seller';

-- Politique pour les vendeurs : ils ne peuvent voir et modifier que leurs propres données
CREATE POLICY "Vendeurs peuvent voir leurs propres données"
ON sellers FOR ALL
USING (auth.uid()::text = id::text);

-- Politique pour les produits
CREATE POLICY "Vendeurs peuvent gérer leurs produits"
ON products FOR ALL
USING (seller_id::text = auth.uid()::text);

-- Politique pour les conversations
CREATE POLICY "Vendeurs peuvent voir leurs conversations"
ON conversations FOR ALL
USING (seller_id::text = auth.uid()::text);

-- Politique pour les messages
CREATE POLICY "Vendeurs peuvent voir les messages de leurs conversations"
ON messages FOR ALL
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE seller_id::text = auth.uid()::text
  )
);

-- Politique pour les tokens de connexion
CREATE POLICY "Vendeurs peuvent voir leurs tokens"
ON seller_connection_tokens FOR ALL
USING (seller_id::text = auth.uid()::text);

-- Fonction helper pour la création de vendeur
CREATE OR REPLACE FUNCTION create_seller_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sellers (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'seller');
  RETURN NEW;
END;
$$ language plpgsql security definer;

-- Trigger pour créer automatiquement le profil vendeur lors de l'inscription
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE create_seller_profile();
