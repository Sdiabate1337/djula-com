export const formatDateToUTC = (date: Date): string => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  
  export const parseUTCDate = (dateStr: string): Date => {
    // Format: YYYY-MM-DD HH:MM:SS
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  };
  
  export const getStartOfDay = (date: Date): Date => {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  };
  
  export const getEndOfDay = (date: Date): Date => {
    const result = new Date(date);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  };
  
  export const getStartOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getUTCDay();
    const diff = result.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    result.setUTCDate(diff);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  };
  
  export const getStartOfMonth = (date: Date): Date => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  };
  
  export const getEndOfMonth = (date: Date): Date => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  };
  
  export const subtractDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() - days);
    return result;
  };
  
  export const subtractMonths = (date: Date, months: number): Date => {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() - months);
    return result;
  };
  
  export const formatDate = (date: Date, locale: string = 'fr-FR'): string => {
    return new Intl.DateTimeFormat(locale).format(date);
  };
  
  export const formatDateTime = (date: Date, locale: string = 'fr-FR'): string => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  export const getRelativeDateLabel = (date: Date, comparisonDate: Date): string => {
    const diffTime = Math.abs(date.getTime() - comparisonDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
    return `Il y a ${Math.floor(diffDays / 365)} ans`;
  };