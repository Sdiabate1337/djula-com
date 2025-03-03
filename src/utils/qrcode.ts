import QRCode from 'qrcode';

export async function generateQRCode(data: string): Promise<string> {
  try {
    // Générer le QR code en format base64
    const qrCodeImage = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });
    return qrCodeImage;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}
