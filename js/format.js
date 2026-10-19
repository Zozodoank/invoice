/**
 * js/format.js — date & number formatting (single source, WIB/Asia-Jakarta aware).
 * Replaces the fragile `new Date().toISOString().split('T')[0]` (UTC) pattern.
 */

const Format = (() => {
  const TZ = 'Asia/Jakarta';

  /** Today's calendar date in Asia/Jakarta as YYYY-MM-DD (safe for <input type=date>). */
  function todayLocal() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }

  /** Any Date -> YYYY-MM-DD interpreted in Asia/Jakarta (avoids UTC off-by-one). */
  function toISODate(date) {
    const d = (date instanceof Date) ? date : parseDate(date) || new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  }

  /** Add months with end-of-month clamping (31 Jan + 1m => 28/29 Feb). */
  function addMonths(dateStr, months) {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(d.getTime())) return dateStr;
    const targetDay = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(targetDay, lastDay));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Parse a YYYY-MM-DD (or full ISO) into a Date at local WIB midnight. */
  function parseDate(value) {
    if (!value) return null;
    const s = String(value);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+07:00`);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Render a date as dd/mm/yyyy (document display). */
  function formatDateId(value) {
    const d = parseDate(value);
    if (!d) return value ? String(value) : '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(d).replace(/\//g, '/');
    } catch {
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
  }

  /** Long Indonesian date, e.g. "05 Maret 2026". */
  function formatDateIdLong(value) {
    const d = parseDate(value);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric'
      }).format(d);
    } catch {
      return formatDateId(value);
    }
  }

  /** Filesystem/URL-safe slug for PDF filenames (#50). */
  function slug(input) {
    return String(input || '')
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'dokumen';
  }

  return { TZ, todayLocal, toISODate, addMonths, parseDate, formatDateId, formatDateIdLong, slug };
})();

if (typeof window !== 'undefined') {
  window.Format = Format;
  window.todayLocal = Format.todayLocal;
  window.toISODate = Format.toISODate;
  window.formatDateId = Format.formatDateId;
}
