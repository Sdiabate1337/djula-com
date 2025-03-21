/**
 * Formate un montant en devise (FCFA par défaut)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF', // FCFA
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * Formate une date selon le format local français
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

/**
 * Formate une date avec heure selon le format local français
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * Convertit un timestamp en format "il y a X temps"
 */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  let interval = Math.floor(seconds / 31536000); // années
  if (interval >= 1) {
    return `il y a ${interval} an${interval > 1 ? 's' : ''}`;
  }
  
  interval = Math.floor(seconds / 2592000); // mois
  if (interval >= 1) {
    return `il y a ${interval} mois`;
  }
  
  interval = Math.floor(seconds / 86400); // jours
  if (interval >= 1) {
    return `il y a ${interval} jour${interval > 1 ? 's' : ''}`;
  }
  
  interval = Math.floor(seconds / 3600); // heures
  if (interval >= 1) {
    return `il y a ${interval} heure${interval > 1 ? 's' : ''}`;
  }
  
  interval = Math.floor(seconds / 60); // minutes
  if (interval >= 1) {
    return `il y a ${interval} minute${interval > 1 ? 's' : ''}`;
  }
  
  return `il y a ${Math.floor(seconds)} seconde${Math.floor(seconds) > 1 ? 's' : ''}`;
}