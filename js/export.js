/**
 * Export and Sharing Utilities (PDF, Print, WhatsApp, Email, QR Code)
 */

const ExportManager = {
  /**
   * Generate QR Code into invoice preview element
   */
  generateQrCode(containerId, payload) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    if (!payload) return;

    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
          text: payload,
          width: 72,
          height: 72,
          colorDark: "#1e293b",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    } catch (e) {
      console.error('Failed to generate QR code:', e);
    }
  },

  /**
   * Print Invoice Directly
   */
  printInvoice() {
    window.print();
  },

  /**
   * Download Invoice as PDF using html2pdf
   */
  async downloadPdf(invoice, elementId = 'invoice-paper-preview') {
    const element = document.getElementById(elementId);
    if (!element) {
      alert('Invoice element not found.');
      return;
    }

    const filename = `Invoice_${invoice.number || '001'}_${(invoice.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    // Save previous transform to prevent mobile zoom scaling artifacts
    const prevTransform = element.style.transform;
    element.style.transform = 'none';

    // Check if html2pdf is available
    if (typeof html2pdf !== 'undefined') {
      const isReceipt = invoice.template === 'receipt';
      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { 
          unit: 'mm', 
          format: isReceipt ? [80, 200] : 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      try {
        await html2pdf().set(opt).from(element).save();
        return true;
      } catch (err) {
        console.error('html2pdf generation error, falling back to window.print():', err);
        window.print();
        return false;
      } finally {
        element.style.transform = prevTransform;
      }
    } else {
      element.style.transform = prevTransform;
      window.print();
      return true;
    }
  },

  /**
   * Generate WhatsApp share text and open link
   */
  shareViaWhatsApp(invoice, totals) {
    const curr = invoice.currency || 'IDR';
    const lang = invoice.language || 'id';
    const dec = invoice.useDecimals;
    const hasWatermark = typeof window.AuthManager !== 'undefined' ? window.AuthManager.shouldShowWatermark() : true;
    
    let text = '';
    if (hasWatermark) {
      text += `⚠️ *[CONTOH INVOICE / SAMPLE]* ⚠️\n`;
      text += `_(Dibuat via InvoiceCraft - Belum Login / Berlangganan Aktif)_\n\n`;
    }

    text += `*FAKTUR PENJUALAN / INVOICE*\n`;
    text += `--------------------------------\n`;
    text += `*No. Invoice:* ${invoice.number || '-'}\n`;
    text += `*Tanggal:* ${invoice.date || '-'}\n`;
    if (invoice.showDueDate !== false && invoice.dueDate) {
      text += `*Jatuh Tempo:* ${invoice.dueDate}\n`;
    }
    if (invoice.showStatus !== false) {
      const statusLabel = (invoice.status || 'PENDING').toUpperCase();
      text += `*Status:* ${statusLabel}\n`;
    }
    text += `*Kepada:* ${invoice.clientName || '-'}\n\n`;

    text += `*Rincian Item:*\n`;
    (invoice.items || []).forEach((item, idx) => {
      text += `${idx + 1}. ${item.name} (${item.quantity} ${item.unit || ''}) = ${formatCurrency(calculateItemTotal(item), curr, dec)}\n`;
    });

    text += `\n*Total Tagihan:* ${formatCurrency(totals.grandTotal, curr, dec)}\n`;
    if (totals.downPayment > 0) {
      text += `*Uang Muka (DP):* -${formatCurrency(totals.downPayment, curr, dec)}\n`;
      text += `*Sisa Pembayaran:* ${formatCurrency(totals.balanceDue, curr, dec)}\n`;
    }

    if (invoice.bankAccounts && invoice.bankAccounts.length > 0) {
      text += `\n*Pembayaran dapat ditransfer ke:*\n`;
      invoice.bankAccounts.forEach(bank => {
        text += `- *${bank.bankName}:* ${bank.accountNumber} (a.n. ${bank.accountHolder})\n`;
      });
    }

    if (invoice.notes) {
      text += `\n*Catatan:* ${invoice.notes}\n`;
    }

    if (hasWatermark) {
      text += `\n📌 *Catatan:* Dokumen ini adalah *CONTOH INVOICE* (Watermark aktif).\n`;
    }

    text += `\nTerima kasih! 🙏\n_${invoice.senderName || 'Kami'}_`;

    // Clean phone number (e.g. 0812... -> 62812...)
    let phone = (invoice.clientPhone || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    const waUrl = phone 
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  },

  /**
   * Share via Email (mailto link)
   */
  shareViaEmail(invoice, totals) {
    const curr = invoice.currency || 'IDR';
    const email = invoice.clientEmail || '';
    const dec = invoice.useDecimals;
    const hasWatermark = typeof window.AuthManager !== 'undefined' ? window.AuthManager.shouldShowWatermark() : true;
    const prefix = hasWatermark ? '[CONTOH INVOICE] ' : '';
    const subject = `${prefix}Invoice ${invoice.number || ''} - ${invoice.senderName || 'Penagihan'}`;
    
    let body = '';
    if (hasWatermark) {
      body += `⚠️ [DOKUMEN CONTOH INVOICE / WATERMARK AKTIF]\n`;
      body += `(Dibuat via InvoiceCraft - Belum Login / Berlangganan Aktif)\n\n`;
    }

    body += `Halo ${invoice.clientName || 'Bapak/Ibu'},\n\n`;
    body += `Berikut adalah rincian tagihan untuk Invoice No: ${invoice.number || '-'}.\n\n`;
    body += `Total Tagihan: ${formatCurrency(totals.grandTotal, curr, dec)}\n`;
    body += `Sisa Pembayaran: ${formatCurrency(totals.balanceDue, curr, dec)}\n`;
    if (invoice.showDueDate !== false && invoice.dueDate) {
      body += `Tanggal Jatuh Tempo: ${invoice.dueDate}\n\n`;
    } else {
      body += `\n`;
    }

    if (invoice.bankAccounts && invoice.bankAccounts.length > 0) {
      body += `Detail Pembayaran Transfer:\n`;
      invoice.bankAccounts.forEach(bank => {
        body += `- ${bank.bankName}: ${bank.accountNumber} (a.n. ${bank.accountHolder})\n`;
      });
      body += `\n`;
    }

    if (hasWatermark) {
      body += `Catatan: Faktur ini merupakan CONTOH INVOICE.\n\n`;
    }

    body += `Terima kasih atas kerja samanya.\n\nSalam,\n${invoice.senderName || ''}`;

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }
};
