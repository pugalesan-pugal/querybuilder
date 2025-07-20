/**
 * Formats a number as currency in INR format
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Formats a date string into a readable format
 * @param dateString The date string to format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function maskSensitiveData(data: string, type: 'card' | 'account' | 'phone' | 'email'): string {
  switch (type) {
    case 'card':
      return data.replace(/\d(?=\d{4})/g, 'X');
    case 'account':
      return 'XXXX' + data.slice(-4);
    case 'phone':
      return data.replace(/\d(?=\d{4})/g, 'X');
    case 'email':
      const [username, domain] = data.split('@');
      return `${username[0]}${username[1]}****@${domain}`;
    default:
      return data;
  }
}

export function formatAmount(amount: number): string {
  if (amount >= 10000000) { // 1 crore
    return `${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) { // 1 lakh
    return `${(amount / 100000).toFixed(2)} L`;
  } else {
    return formatCurrency(amount);
  }
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function getTimeDifference(date1: string, date2: string): string {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffInMs = Math.abs(d2.getTime() - d1.getTime());
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (days > 365) {
    return `${Math.floor(days / 365)} years`;
  } else if (days > 30) {
    return `${Math.floor(days / 30)} months`;
  } else {
    return `${days} days`;
  }
} 