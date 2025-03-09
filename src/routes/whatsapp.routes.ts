import { Router } from 'express';
import { WhatsAppService } from '../services/whatsapp/whatsapp.service';

export default function(whatsappService: WhatsAppService) {
  const router = Router();

  // Webhook verification endpoint
  router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Vérification du webhook échouée');
    }
  });

  // Webhook for receiving messages
  router.post('/', async (req, res) => {
    try {
      const data = req.body;
      
      if (
        data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
      ) {
        const message = data.entry[0].changes[0].value.messages[0];
        const customerId = data.entry[0].changes[0].value.contacts[0].wa_id;
        
        // Send immediate response to avoid WhatsApp timeout
        res.status(200).send('OK');
        
        // Process message in background
        whatsappService.handleMessage(message, customerId)
          .catch(error => console.error('Erreur de traitement du message:', error));
      } else {
        res.status(200).send('OK');
      }
    } catch (error) {
      console.error('Erreur webhook WhatsApp:', error);
      res.status(200).send('Error handled');
    }
  });

  return router;
}