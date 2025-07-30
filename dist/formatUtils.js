"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.formatDate = formatDate;
exports.maskSensitiveData = maskSensitiveData;
exports.formatAmount = formatAmount;
exports.formatPercentage = formatPercentage;
exports.getTimeDifference = getTimeDifference;
/**
 * Formats a number as currency in INR format
 * @param amount The amount to format
 * @returns Formatted currency string
 */
function formatCurrency(amount, currency = 'INR') {
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
function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}
function maskSensitiveData(data, type) {
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
function formatAmount(amount) {
    if (amount >= 10000000) { // 1 crore
        return `${(amount / 10000000).toFixed(2)} Cr`;
    }
    else if (amount >= 100000) { // 1 lakh
        return `${(amount / 100000).toFixed(2)} L`;
    }
    else {
        return formatCurrency(amount);
    }
}
function formatPercentage(value) {
    return `${value.toFixed(2)}%`;
}
function getTimeDifference(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffInMs = Math.abs(d2.getTime() - d1.getTime());
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (days > 365) {
        return `${Math.floor(days / 365)} years`;
    }
    else if (days > 30) {
        return `${Math.floor(days / 30)} months`;
    }
    else {
        return `${days} days`;
    }
}
