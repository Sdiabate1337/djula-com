import QRCode from 'qrcode';

export async function generateQRCode(data: string): Promise<string> {
  try {
    // Générer le code QR en format base64
    return await QRCode.toDataURL(data);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Erreur lors de la génération du code QR');
  }
}
