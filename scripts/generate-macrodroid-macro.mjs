/**
 * scripts/generate-macrodroid-macro.mjs
 * Membuat file .macro MacroDroid SIAP IMPORT (format asli, sama seperti contoh
 * Voiceover/qris_megakomindo_verifier.macro) untuk konfirmasi QRIS dinamis InvoiceCraft.
 *
 *   node scripts/generate-macrodroid-macro.mjs [BASE_URL] [dirKeluar]
 *
 * Kunci diambil dari PAYMENT_WEBHOOK_SECRET di .dev.vars (gitignored) dan ditanam di
 * header `x-macrodroid-key` + body JSON. Hasil memuat SECRET -> default ke
 * .wrangler/tmp/macro-out/ (gitignore + .pageignore). Jangan taruh di dist/.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDotVars } from './dotvars.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.argv[2] || 'https://invoiceku.biz.id').replace(/\/+$/, '');
const KEY = readDotVars(ROOT).PAYMENT_WEBHOOK_SECRET;
if (!KEY) { console.error('PAYMENT_WEBHOOK_SECRET tidak ada di .dev.vars'); process.exit(1); }

const DIST = path.join(ROOT, 'dist');
const outDir = path.resolve(ROOT, process.argv[3] || path.join('.wrangler', 'tmp', 'macro-out'));
if (outDir === DIST || outDir.startsWith(DIST + path.sep)) {
  console.error('Ditolak: output di dalam dist/ akan ter-serve publik.'); process.exit(1);
}

const lv = (name) => ({
  dictionary: { entries: [], isArray: false, variableType: 4, type: 'Dictionary' },
  isActionBlockWorkingVar: true, isLocalVar: true, isSecure: false,
  m_booleanValue: false, m_decimalValue: 0.0, m_intValue: 0, m_name: name,
  m_stringValue: '', m_type: 2, supportsInput: false, supportsOutput: true
});

const body = JSON.stringify({
  key: KEY,
  notification_text: '{not_title} {notification} {not_text_big}'
});

const macro = {
  globalVariables: [],
  macro: {
    aiGenerated: 0, breakpoints: [], disabledTimestamp: 0, exportedActionBlocks: [],
    exportedSharedScenes: [], forceEvenIfNotEnabledTimestamp: 0, isActionBlock: false,
    isExtra: false, isFavourite: true, lastEditedTimestamp: Date.now(),
    localVariables: [lv('invoice_webhook_response'), lv('invoice_webhook_status')],
    localVarsAlphabetical: true, loggingLevel: 0, m_GUID: -7000000000000000101,
    m_actionList: [
      {
        requestConfig: {
          allFilesAccessPath: '', allowAnyCertificate: false, basicAuthEnabled: false,
          basicAuthPassword: '', basicAuthUsername: '', blockNextAction: false,
          clientCertEnabled: false, clientCertKeyStoreDisplayName: '', clientCertKeyStoreUri: '',
          clientCertPassword: '', contentBodyDynamicFileName: '', contentBodyFileDisplayName: '',
          contentBodyFileUri: '', contentBodyFolderDisplayName: '', contentBodyFolderUri: '',
          contentBodySource: 0, contentBodyText: body, contentType: 'application/json',
          followRedirects: true,
          headerParams: [
            { paramName: 'Content-Type', paramValue: 'application/json' },
            { paramName: 'x-macrodroid-key', paramValue: KEY }
          ],
          localFileUri: '', maxTotalDurationSeconds: 3600, prettifyJson: false,
          proxyEnabled: false, proxyHost: '', proxyPort: 8080, proxyType: 0, queryParams: [],
          requestTimeOutSeconds: 30, requestType: 1,
          responseVariableName: 'invoice_webhook_response',
          returnCodeVariableName: 'invoice_webhook_status',
          saveResponseAllFilesAccessPath: '', saveResponseFileName: '',
          saveResponseFolderPathDisplayName: '', saveResponseFolderPathUri: '',
          saveResponseType: 1, saveResponseUseAllFilesAccess: false,
          saveReturnCodeToVariable: true, saveReturnHeadersToVariable: false,
          urlToOpen: `${BASE_URL}/api/payments/confirm`,
          useAllFilesAccess: false, useLocalFileUri: false, useStaticContentBodyFile: true
        },
        disableLogging: false, m_SIGUID: -7000000000000000111, m_classType: 'HttpRequestAction',
        m_comment: '', m_constraintList: [], m_isDisabled: false, m_isOrCondition: false
      },
      {
        cancelPrevious: false, m_backgroundColor: -14606047, m_displayIcon: false, m_duration: 0,
        m_horizontalPosition: 0, m_imageName: 'launcher_no_border',
        m_imagePackageName: 'com.arlosoft.macrodroid', m_imageResourceName: 'launcher_no_border',
        m_messageText: 'Invoice QRIS: {lv=invoice_webhook_status} {lv=invoice_webhook_response}',
        m_position: 0, m_textColor: -1, m_tintIcon: false, maintainSpaces: false, textAlignment: 0,
        useTextOnly: true, disableLogging: false, m_SIGUID: -7000000000000000112,
        m_classType: 'ToastAction', m_comment: '', m_constraintList: [], m_isDisabled: false,
        m_isOrCondition: false
      }
    ],
    m_category: 'Pembayaran', m_completed: true, m_constraintList: [],
    m_description: `Relay notifikasi dana masuk InterActive QRIS ke ${BASE_URL}/api/payments/confirm ` +
      '(QRIS dinamis InvoiceCraft: Rp 1.000 + kode unik 2/3 digit). URL, kunci, dan body sudah terisi. ' +
      'Ganti aplikasi pada trigger bila sumber notifikasi bukan InterActive QRIS.',
    m_descriptionOpen: false, m_enabled: true, m_excludeLog: false, m_headingColor: -855310,
    m_isOrCondition: false, m_name: 'QRIS MEGAKOMINDO -> InvoiceCraft Webhook',
    m_triggerList: [
      {
        enableRegex: false, ignoreCase: true, m_applicationNameList: ['InterActive QRIS'],
        m_exactMatch: false, m_excludeApps: false, m_excludes: false, m_ignoreOngoing: false,
        m_option: 0, m_packageNameList: ['com.interactive.qrisid'], m_soundOption: 0,
        m_supressMultiples: true, m_textContent: '', matchOptionMessage: 0, matchOptionTitle: 0,
        separateTitleAndMessage: false, disableLogging: false, m_SIGUID: -7000000000000000113,
        m_classType: 'NotificationTrigger', m_comment: '', m_constraintList: [],
        m_isDisabled: false, m_isOrCondition: false
      }
    ]
  },
  macroExportVersion: 1
};

mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'qris_invoice_dinamis.macro');
writeFileSync(file, JSON.stringify(macro));
console.log('Ditulis:', file);
console.log('URL     :', `${BASE_URL}/api/payments/confirm`);
console.log('JANGAN bagikan/commit file ini: memuat kunci pembayaran.');

