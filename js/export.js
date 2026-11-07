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
   * Kredit Per Aksi: Memeriksa dan memotong 1 kredit per aksi cetak atau unduh PDF.
   * Jika kredit habis, membuka modal pembayaran QRIS dinamis seharga Rp 1.000.
   */
  async executeWithCredit(options = {}) {
    const { type = 'invoice', docId = '', action = 'print', execute } = options;
    const toast = (msg, kind) => {
      if (typeof window.showToast === 'function') window.showToast(msg, kind);
      else if (window.app && window.app.showToast) window.app.showToast(msg, kind);
      else alert(msg);
    };

    // 1. Cek sesi login
    const u = (typeof window.AuthManager !== 'undefined' && window.AuthManager.getUser)
      ? window.AuthManager.getUser() : null;
    if (!u) {
      toast('Silakan login terlebih dahulu untuk mencetak atau mengunduh PDF.', 'warn');
      const authBtn = document.getElementById('btn-google-login') || document.getElementById('login-btn');
      if (authBtn) authBtn.click();
      return false;
    }

    // 2. Superadmin bebas kredit (unlimited)
    if (u.isSuperadmin) {
      return await this._runAuthorized(execute);
    }

    // 3. Cek kredit lokal user
    const credits = (window.AuthManager && window.AuthManager.getCredits)
      ? window.AuthManager.getCredits() : (u.printCredits || 0);

    if (credits <= 0) {
      toast('Kredit cetak/unduh Anda habis. Silakan bayar Rp 1.000 via QRIS dinamis.', 'info');
      if (window.QrisPay) {
        window.QrisPay.open('credit', docId || 'credit', {
          onClean: async () => {
            toast('Pembayaran berhasil! Memproses ' + (action === 'pdf' ? 'unduh PDF...' : 'cetak...'), 'success');
            await this.executeWithCredit({ type, docId, action, execute });
          }
        });
      }
      return false;
    }

    // 4. Ada kredit -> panggil server untuk mengonsumsi 1 kredit secara atomik
    try {
      if (window.Api && window.Api.consumeAction) {
        const res = await window.Api.consumeAction({ action, type, id: docId });
        if (!res || !res.ok) {
          if (res && res.error === 'insufficient_credits') {
            if (window.AuthManager && window.AuthManager.setCredits) window.AuthManager.setCredits(0);
            toast('Kredit Anda tidak mencukupi. Silakan bayar Rp 1.000 via QRIS.', 'warn');
            if (window.QrisPay) {
              window.QrisPay.open('credit', docId || 'credit', {
                onClean: async () => {
                  await this.executeWithCredit({ type, docId, action, execute });
                }
              });
            }
            return false;
          }
          toast((res && res.message) || 'Gagal memverifikasi kredit.', 'error');
          return false;
        }

        toast(`1 Kredit terpakai (${action === 'pdf' ? 'unduh PDF' : 'cetak'}). Sisa: ${res.remainingCredits}`, 'info');
        return await this._runAuthorized(execute, res.remainingCredits);
      }

      // Jalankan aksi cetak/PDF dengan watermark disembunyikan dan print diizinkan
      return await this._runAuthorized(execute);
    } catch (e) {
      toast(e.message || 'Gagal memproses aksi.', 'error');
      return false;
    }
  },

  async _runAuthorized(execute, nextCredits) {
    document.body.classList.add('printing-authorized');
    // Cari dan sembunyikan sementara overlay watermark agar hasil cetak / PDF bersih
    const overlays = document.querySelectorAll('.invoice-watermark-overlay');
    overlays.forEach(el => el.style.setProperty('display', 'none', 'important'));

    try {
      if (typeof execute === 'function') {
        await execute();
      }
      return true;
    } finally {
      // Jeda singkat agar proses print preview browser atau snapshot html2pdf selesai membaca DOM,
      // lalu sinkronkan sisa kredit (bila 0, watermark otomatis muncul kembali pada dokumen & tombol kembali ke status belum bayar).
      setTimeout(() => {
        document.body.classList.remove('printing-authorized');
        overlays.forEach(el => el.style.removeProperty('display'));
        if (typeof nextCredits === 'number' && window.AuthManager && window.AuthManager.setCredits) {
          window.AuthManager.setCredits(nextCredits);
        }
      }, 600);
    }
  },

  /**
   * Print Invoice Directly (dilindungi kredit per aksi)
   */
  printInvoice(options = {}) {
    const type = options.type || (window.app && window.app.invoice ? 'invoice' : (window.kwitansiApp ? 'kwitansi' : 'surat-jalan'));
    const docId = options.docId || (window.app && window.app.invoice && window.app.invoice.id)
      || (window.kwitansiApp && window.kwitansiApp.kwitansi && window.kwitansiApp.kwitansi.id)
      || (window.suratJalanApp && window.suratJalanApp.suratJalan && window.suratJalanApp.suratJalan.id)
      || '';

    return this.executeWithCredit({
      type,
      docId,
      action: 'print',
      execute: () => {
        window.print();
      }
    });
  },

  /**
   * Download Invoice as PDF using html2pdf (dilindungi kredit per aksi)
   */
  async downloadPdf(invoice, elementId = 'invoice-paper-preview', options = {}) {
    const type = options.type || 'invoice';
    const docId = options.docId || (invoice && invoice.id) || '';

    return this.executeWithCredit({
      type,
      docId,
      action: 'pdf',
      execute: async () => {
        await this._doDownloadPdf(invoice, elementId);
      }
    });
  },

  async _doDownloadPdf(invoice, elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
      alert('Dokumen tidak ditemukan.');
      return;
    }

    const slug = (window.Format ? window.Format.slug : (s) => String(s || '').replace(/[^a-zA-Z0-9]/g, '_'));
    const filename = `Invoice_${slug(invoice && invoice.number) || '001'}_${slug(invoice && invoice.clientName) || 'Client'}.pdf`;
    
    // Save previous transform to prevent mobile zoom scaling artifacts
    const prevTransform = element.style.transform;
    element.style.transform = 'none';

    // Check if html2pdf is available
    if (typeof html2pdf !== 'undefined') {
      const isReceipt = invoice && invoice.template === 'receipt';
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
      const sMap = { paid: 'LUNAS', pending: 'MENUNGGU PEMBAYARAN', overdue: 'JATUH TEMPO', draft: 'DRAFT', cancelled: 'DIBATALKAN' };
      const statusLabel = invoice.status ? (sMap[invoice.status.toLowerCase()] || 'TIDAK DIKETAHUI') : 'MENUNGGU';
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

    window.open(waUrl, '_blank', 'noopener,noreferrer');
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

if (typeof window !== 'undefined') {
  window.ExportManager = ExportManager;
  // Intercept Ctrl+P / Cmd+P agar tidak membypass sistem kredit per aksi
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      ExportManager.printInvoice();
    }
  });
}
