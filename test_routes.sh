#!/bin/bash

# Couleurs pour le terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
BLUE='\033[0;34m'

# URL de base de l'API
BASE_URL="http://localhost:3000/api"

echo "🚀 Test des routes Djula API"
echo "============================="

# Fonction pour afficher les réponses
display_response() {
    if [[ "$1" == *"error"* ]]; then
        echo -e "${RED}Erreur:${NC}"
    fi
    echo "$1" | jq '.' || echo "$1"
    echo ""
}

# 1. Test d'inscription d'un nouveau vendeur
echo -e "\n${BLUE}1. Test d'inscription d'un nouveau vendeur${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/sellers/register" \
    -H "Content-Type: application/json" \
    -d '{
        "fullName": "John Doe",
        "brandName": "JD Fashion",
        "whatsappNumber": "+212714460467",
        "city": "Abidjan",
        "businessType": "FASHION"
    }')
display_response "$REGISTER_RESPONSE"
SELLER_ID=$(echo $REGISTER_RESPONSE | jq -r '.id')

# 2. Test de connexion
echo -e "${BLUE}2. Test de connexion${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/sellers/login" \
    -H "Content-Type: application/json" \
    -d '{
        "fullName": "John Doe",
        "whatsappNumber": "+212714460467"
    }')
display_response "$LOGIN_RESPONSE"

# 3. Recherche par numéro WhatsApp
echo -e "${BLUE}3. Recherche par numéro WhatsApp${NC}"
SEARCH_RESPONSE=$(curl -s -X GET "${BASE_URL}/sellers/by-whatsapp/+212714460468")
display_response "$SEARCH_RESPONSE"

# 4. Mise à jour du profil
echo -e "${BLUE}4. Mise à jour du profil${NC}"
if [ ! -z "$SELLER_ID" ]; then
    UPDATE_RESPONSE=$(curl -s -X PUT "${BASE_URL}/sellers/${SELLER_ID}" \
        -H "Content-Type: application/json" \
        -d '{
            "brandName": "JD Fashion Updated",
            "city": "Casablanca"
        }')
    display_response "$UPDATE_RESPONSE"
else
    echo -e "${RED}Impossible de mettre à jour le profil: ID vendeur non disponible${NC}"
fi

# 5. Génération du QR Code
echo -e "${BLUE}5. Génération du QR Code${NC}"
if [ ! -z "$SELLER_ID" ]; then
    QR_RESPONSE=$(curl -s -X GET "${BASE_URL}/sellers/${SELLER_ID}/connect/qr")
    display_response "$QR_RESPONSE"
else
    echo -e "${RED}Impossible de générer le QR code: ID vendeur non disponible${NC}"
fi

# 6. Test de vérification du token
echo -e "${BLUE}6. Test de vérification du token${NC}"
if [ ! -z "$SELLER_ID" ]; then
    echo -e "${BLUE}6.1 Test avec un token invalide${NC}"
    INVALID_TOKEN="INVALID_TOKEN"
    VERIFY_RESPONSE=$(curl -s -X POST "${BASE_URL}/sellers/${SELLER_ID}/connect/verify" \
        -H "Content-Type: application/json" \
        -d "{\"token\": \"${INVALID_TOKEN}\"}")
    echo "Token invalide: $VERIFY_RESPONSE"

    echo -e "\n${BLUE}6.2 Test avec un token valide${NC}"
    VALID_TOKEN="TEST_TOKEN_123"
    VERIFY_RESPONSE=$(curl -s -X POST "${BASE_URL}/sellers/${SELLER_ID}/connect/verify" \
        -H "Content-Type: application/json" \
        -d "{\"token\": \"${VALID_TOKEN}\"}")
    echo "Token valide: $VERIFY_RESPONSE"
else
    echo -e "${RED}Impossible de vérifier le token: ID vendeur non disponible${NC}"
fi
