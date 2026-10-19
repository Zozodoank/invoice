/**
 * js/db-mapping.js — CANONICAL field contract between the frontend, the Functions
 * API, and the D1 columns. The SAME pairs live on the server
 * (functions/_shared/docstore.js); keep them in sync.
 *
 * Rule of thumb (plan Phase 2.2): a field the UI renders === a field the API
 * sends/receives === a DB column. camelCase is the frontend/API name;
 * the string value is the snake_case DB column.
 *
 * Fields NOT listed here are transient UI-only state and are never persisted.
 * Server-owned (read-only to the client): hasWatermark, totals, id, timestamps.
 */

const DBMap = {
  INVOICE: {
    number: 'invoice_number',
    referenceNumber: 'reference_number',
    title: 'title',
    date: 'invoice_date',
    dueDate: 'due_date',
    showDueDate: 'show_due_date',
    paymentTerms: 'payment_terms',
    showPaymentTerms: 'show_payment_terms',
    status: 'status',
    showStatus: 'show_status',
    useDecimals: 'use_decimals',
    template: 'template',
    accentColor: 'accent_color',
    currency: 'currency',
    language: 'language',
    logo: 'logo_url',
    signature: 'signature_url',
    senderName: 'sender_name',
    senderEmail: 'sender_email',
    senderPhone: 'sender_phone',
    senderAddress: 'sender_address',
    senderTaxId: 'sender_tax_id',
    senderWebsite: 'sender_website',
    clientName: 'client_name',
    clientEmail: 'client_email',
    clientPhone: 'client_phone',
    clientAddress: 'client_address',
    clientTaxId: 'client_tax_id',
    discountType: 'discount_type',
    discountValue: 'discount_value',
    enableDiscount: 'enable_discount',
    taxRate: 'tax_rate',
    enableTax: 'enable_tax',
    shippingFee: 'shipping_fee',
    downPayment: 'down_payment',
    notes: 'notes',
    terms: 'terms',
    signerName: 'signer_name',
    signerTitle: 'signer_title',
    qrPayload: 'qr_payload',
    showQrCode: 'show_qr_code'
  },

  // Items shared shape (invoice + kwitansi line items).
  LINE_ITEM: {
    name: 'name',
    description: 'description',
    quantity: 'quantity',
    unit: 'unit',
    price: 'price',
    discountType: 'discount_type',
    discountValue: 'discount_value',
    taxRate: 'tax_rate',
    total: 'total_amount'
  },

  KWITANSI: {
    number: 'receipt_number',
    date: 'receipt_date',
    showRefNumber: 'show_reference_number',
    referenceNumber: 'reference_number',
    clientName: 'client_name',
    clientAddress: 'client_address',
    paymentFor: 'payment_for',
    amount: 'amount',
    currency: 'currency',
    useDecimals: 'use_decimals',
    method: 'method',
    enableDiscount: 'enable_discount',
    discountType: 'discount_type',
    discountValue: 'discount_value',
    enableTax: 'enable_tax',
    taxRate: 'tax_rate',
    meteraiFee: 'meterai_fee',
    stampColor: 'stamp_color',
    showTerbilang: 'show_terbilangan',
    showSignature: 'show_signature',
    showQrCode: 'show_qr_code',
    qrPayload: 'qr_payload',
    template: 'template',
    accentColor: 'accent_color',
    logo: 'logo_url',
    signature: 'signature_url',
    signerName: 'signer_name',
    signerTitle: 'signer_title',
    senderName: 'sender_name',
    notes: 'notes',
    status: 'status'
  },

  SURAT_JALAN: {
    number: 'delivery_number',
    date: 'delivery_date',
    referenceNumber: 'reference_number',
    recipientName: 'recipient_name',
    recipientAddress: 'recipient_address',
    recipientPic: 'recipient_pic',
    recipientPhone: 'recipient_phone',
    senderName: 'sender_name',
    senderAddress: 'sender_address',
    senderPic: 'sender_pic',
    driverName: 'driver_name',
    driverSignerName: 'driver_signer_name',
    warehouseOfficerName: 'warehouse_officer_name',
    vehicle: 'vehicle',
    poNumber: 'po_number',
    sealNumber: 'seal_number',
    deliveryInstructions: 'delivery_instructions',
    notes: 'notes',
    status: 'status',
    template: 'template',
    accentColor: 'accent_color',
    paperSize: 'paper_size',
    logo: 'logo_url',
    signature: 'signature_url',
    showSkuColumn: 'show_sku_column',
    showItemCondition: 'show_item_condition',
    showSealNumber: 'show_seal_number',
    showPoNumber: 'show_po_number',
    showSignatures: 'show_signatures'
  },

  SURAT_JALAN_ITEM: {
    sku: 'sku',
    name: 'name',
    description: 'description',
    quantity: 'quantity',
    unit: 'unit',
    condition: 'condition'
  }
};

if (typeof window !== 'undefined') window.DBMap = DBMap;
if (typeof module !== 'undefined' && module.exports) module.exports = DBMap;
