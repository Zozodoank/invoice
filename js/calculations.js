/**
 * Invoice Calculations and Number Formatting Module
 */

const CURRENCIES = {
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID', fractionDigits: 0, unitWord: 'Rupiah' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US', fractionDigits: 2, unitWord: 'Dollars' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE', fractionDigits: 2, unitWord: 'Euros' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB', fractionDigits: 2, unitWord: 'Pounds' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', fractionDigits: 2, unitWord: 'Dollars' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', fractionDigits: 0, unitWord: 'Yen' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', fractionDigits: 2, unitWord: 'Ringgit' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', fractionDigits: 2, unitWord: 'Dollars' }
};

/**
 * Format number into selected currency string
 */
function formatCurrency(amount, currencyCode = 'IDR', useDecimals = null) {
  const num = Number(amount) || 0;
  let curr = currencyCode;
  let dec = useDecimals;

  // Support passing invoice object or options as second argument
  if (typeof currencyCode === 'object' && currencyCode !== null) {
    curr = currencyCode.currency || 'IDR';
    dec = currencyCode.useDecimals !== undefined ? currencyCode.useDecimals : useDecimals;
  }

  const config = CURRENCIES[curr] || CURRENCIES.IDR;
  let fractionDigits = config.fractionDigits;

  if (typeof dec === 'boolean') {
    fractionDigits = dec ? 2 : 0;
  } else if (typeof dec === 'number') {
    fractionDigits = dec;
  }

  const formatted = num.toLocaleString(config.locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
  
  return `${config.symbol} ${formatted}`;
}

/**
 * Format plain number with thousand separators
 */
function formatNumber(amount, currencyCode = 'IDR', useDecimals = null) {
  const num = Number(amount) || 0;
  let curr = currencyCode;
  let dec = useDecimals;

  if (typeof currencyCode === 'object' && currencyCode !== null) {
    curr = currencyCode.currency || 'IDR';
    dec = currencyCode.useDecimals !== undefined ? currencyCode.useDecimals : useDecimals;
  }

  const config = CURRENCIES[curr] || CURRENCIES.IDR;
  let fractionDigits = config.fractionDigits;

  if (typeof dec === 'boolean') {
    fractionDigits = dec ? 2 : 0;
  } else if (typeof dec === 'number') {
    fractionDigits = dec;
  }

  return num.toLocaleString(config.locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

/**
 * Calculate single item line total
 */
function calculateItemTotal(item) {
  const qty = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.price) || 0);
  let baseTotal = qty * price;
  
  // Item discount
  let discount = 0;
  if (item.discountType === 'percent') {
    discount = baseTotal * ((Number(item.discountValue) || 0) / 100);
  } else {
    discount = Number(item.discountValue) || 0;
  }
  
  let totalAfterDiscount = Math.max(0, baseTotal - discount);
  
  // Item tax (if applicable)
  let itemTax = 0;
  if (item.taxRate && Number(item.taxRate) > 0) {
    itemTax = totalAfterDiscount * (Number(item.taxRate) / 100);
  }
  
  return totalAfterDiscount + itemTax;
}

/**
 * Calculate all invoice totals
 */
function calculateInvoiceTotals(invoice) {
  const items = invoice.items || [];
  
  let subtotal = 0;
  let itemsRawTotal = 0;
  
  items.forEach(item => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    itemsRawTotal += (qty * price);
    subtotal += calculateItemTotal(item);
  });
  
  // Global Discount (with enable/disable support)
  let globalDiscount = 0;
  const isDiscountEnabled = invoice.enableDiscount !== false;
  if (isDiscountEnabled) {
    if (invoice.discountType === 'percent') {
      globalDiscount = subtotal * ((Number(invoice.discountValue) || 0) / 100);
    } else {
      globalDiscount = Number(invoice.discountValue) || 0;
    }
    globalDiscount = Math.min(subtotal, Math.max(0, globalDiscount));
  }
  
  const taxableAmount = Math.max(0, subtotal - globalDiscount);
  
  // Tax calculation (with enable/disable support)
  let taxAmount = 0;
  const isTaxEnabled = invoice.enableTax !== false;
  const taxRate = isTaxEnabled ? (Number(invoice.taxRate) || 0) : 0;
  if (isTaxEnabled && taxRate > 0) {
    taxAmount = taxableAmount * (taxRate / 100);
  }
  
  // Shipping & Additional fees
  const shippingFee = Math.max(0, Number(invoice.shippingFee) || 0);
  
  // Grand Total
  const grandTotal = taxableAmount + taxAmount + shippingFee;
  
  // Down Payment / Amount Paid
  const downPayment = Math.max(0, Number(invoice.downPayment) || 0);
  
  // Balance Due
  const balanceDue = Math.max(0, grandTotal - downPayment);
  
  return {
    subtotal,
    itemsRawTotal,
    globalDiscount,
    taxableAmount,
    taxRate,
    taxAmount,
    shippingFee,
    grandTotal,
    downPayment,
    balanceDue
  };
}

/**
 * Convert number to Indonesian Words ("Terbilang")
 */
function numberToIndonesianWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'Nol';
  
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  
  function convert(num) {
    if (num < 12) {
      return satuan[num];
    } else if (num < 20) {
      return convert(num - 10) + ' Belas';
    } else if (num < 100) {
      return convert(Math.floor(num / 10)) + ' Puluh' + (num % 10 !== 0 ? ' ' + convert(num % 10) : '');
    } else if (num < 200) {
      return 'Seratus' + (num - 100 !== 0 ? ' ' + convert(num - 100) : '');
    } else if (num < 1000) {
      return convert(Math.floor(num / 100)) + ' Ratus' + (num % 100 !== 0 ? ' ' + convert(num % 100) : '');
    } else if (num < 2000) {
      return 'Seribu' + (num - 1000 !== 0 ? ' ' + convert(num - 1000) : '');
    } else if (num < 1000000) {
      return convert(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 !== 0 ? ' ' + convert(num % 1000) : '');
    } else if (num < 1000000000) {
      return convert(Math.floor(num / 1000000)) + ' Juta' + (num % 1000000 !== 0 ? ' ' + convert(num % 1000000) : '');
    } else if (num < 1000000000000) {
      return convert(Math.floor(num / 1000000000)) + ' Miliar' + (num % 1000000000 !== 0 ? ' ' + convert(num % 1000000000) : '');
    } else if (num < 1000000000000000) {
      return convert(Math.floor(num / 1000000000000)) + ' Triliun' + (num % 1000000000000 !== 0 ? ' ' + convert(num % 1000000000000) : '');
    }
    return '';
  }
  
  return convert(n).trim();
}

/**
 * Convert number to English Words
 */
function numberToEnglishWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convert(num) {
    if (num < 20) {
      return ones[num];
    } else if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    } else if (num < 1000) {
      return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + convert(num % 100) : '');
    } else if (num < 1000000) {
      return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + convert(num % 1000) : '');
    } else if (num < 1000000000) {
      return convert(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 !== 0 ? ' ' + convert(num % 1000000) : '');
    } else if (num < 1000000000000) {
      return convert(Math.floor(num / 1000000000)) + ' Billion' + (num % 1000000000 !== 0 ? ' ' + convert(num % 1000000000) : '');
    }
    return '';
  }
  
  return convert(n).trim();
}

/**
 * Get Spelled-out words with currency name based on invoice language
 */
function getSpelledOutAmount(amount, currencyCode = 'IDR', lang = 'id') {
  const config = CURRENCIES[currencyCode] || CURRENCIES.IDR;
  if (lang === 'id') {
    const words = numberToIndonesianWords(amount);
    return `${words} ${config.unitWord || 'Rupiah'}`.trim();
  } else {
    const words = numberToEnglishWords(amount);
    return `${words} ${config.unitWord || 'Dollars'}`.trim();
  }
}
