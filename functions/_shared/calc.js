// functions/_shared/calc.js
// Authoritative invoice/totals calculation on the server.
// Mirrors the corrected client logic (js/calculations.js) so stored values
// always equal what the user saw, and can never be tampered with client-side.

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** Item subtotal, tax-EXCLUSIVE (base - item discount). */
export function itemNet(item) {
  const qty = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.price) || 0);
  const base = qty * price;
  let disc = 0;
  if (item.discountType === 'percent') disc = base * ((Number(item.discountValue) || 0) / 100);
  else disc = Number(item.discountValue) || 0;
  return round2(Math.max(0, base - disc));
}

export function itemTax(item, net) {
  const rate = Number(item.taxRate) || 0;
  return rate > 0 ? round2(net * (rate / 100)) : 0;
}

/**
 * Compute document totals. `enableDiscount`/`enableTax` default to FALSE
 * (undefined => disabled), consistent with the receipt module.
 */
export function computeTotals(doc) {
  const items = Array.isArray(doc.items) ? doc.items : [];
  let subtotal = 0;      // tax-exclusive
  let itemTaxTotal = 0;

  for (const it of items) {
    const net = itemNet(it);
    subtotal += net;
    itemTaxTotal += itemTax(it, net);
  }
  subtotal = round2(subtotal);
  itemTaxTotal = round2(itemTaxTotal);

  let globalDiscount = 0;
  if (doc.enableDiscount === true) {
    if (doc.discountType === 'percent') globalDiscount = subtotal * ((Number(doc.discountValue) || 0) / 100);
    else globalDiscount = Number(doc.discountValue) || 0;
    globalDiscount = Math.min(subtotal, Math.max(0, globalDiscount));
  }

  const taxableAmount = Math.max(0, subtotal - globalDiscount);

  let globalTax = 0;
  const taxRate = doc.enableTax === true ? (Number(doc.taxRate) || 0) : 0;
  if (doc.enableTax === true && taxRate > 0) globalTax = taxableAmount * (taxRate / 100);

  const taxAmount = round2(itemTaxTotal + globalTax);
  const shippingFee = Math.max(0, Number(doc.shippingFee) || 0);
  const grandTotal = round2(taxableAmount + taxAmount + shippingFee);
  const downPayment = Math.max(0, Number(doc.downPayment) || 0);
  const balanceDue = round2(grandTotal - downPayment); // may be negative => overpayment

  return {
    subtotal, itemTaxTotal, globalDiscount: round2(globalDiscount),
    taxableAmount: round2(taxableAmount), taxRate, taxAmount,
    shippingFee, grandTotal, downPayment, balanceDue
  };
}
