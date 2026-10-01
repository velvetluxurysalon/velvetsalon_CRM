import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Browser } from 'puppeteer-core';
import type { IBill } from '../models/bill.model.js';

type StaffNameResolver = (staffId: string) => string;

// Cache the base64-encoded logo so we only read+encode it once per process,
// same rationale as the shared browser instance below.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let logoDataUri: string | null = null;
function getLogoDataUri(): string {
  if (logoDataUri) return logoDataUri;
  // Adjust this relative path if invoicePdf.service.ts lives somewhere else
  // relative to apps/web/public/assets/logo.webp
  const logoPath = path.resolve(__dirname, '../../../web/public/assets/logo.webp');
  const buf = readFileSync(logoPath);
  logoDataUri = `data:image/webp;base64,${buf.toString('base64')}`;
  return logoDataUri;
}

// Mirrors the styling of the client's invoice modal (BillingPage.tsx),
// rendered server-side so headless Chromium can turn it into a PDF.
// Redesigned for a premium corporate look: white + espresso brown + matte
// gold, hairline dividers instead of boxed/framed sections.
function buildInvoiceHtml(bill: IBill, resolveStaffName: StaffNameResolver): string {
  const fmtCur = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- IBill types these as required, but legacy bills can have them unset at runtime
  const dateStr = new Date(bill.date ?? bill.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const rows = bill.items.map(item => `
    <tr>
      <td>${item.serviceName}</td>
      <td class="muted">${resolveStaffName(item.staffId)}</td>
      <td class="num">${fmtCur(item.price)}</td>
    </tr>`).join('');

 /* eslint-disable @typescript-eslint/no-unnecessary-condition -- customer.name is a populated optional field; can be missing/unpopulated at runtime */
  const custName =
    (bill as unknown as { customer?: { name?: string } }).customer?.name
    ?? bill.customerName ?? 'Walk-in Customer';
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8" /><title>Invoice ${bill.billNumber}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Jost',sans-serif;color:#4a3a28;background:#fff;-webkit-font-smoothing:antialiased}
      .inv-wrap{position:relative;padding:40px 46px;overflow:hidden}

      /* Static watermark — PDFs are a frozen snapshot from Puppeteer, so
         real CSS animation never renders here. This faint rotated logo
         gives the page some visual depth without needing motion. */
      .inv-watermark{position:absolute;top:52%;left:50%;width:380px;transform:translate(-50%,-50%) rotate(-9deg);opacity:.045;pointer-events:none;z-index:0}
      .inv-content{position:relative;z-index:1}

      /* ---------- Header ---------- */
      .inv-hd{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:1px solid #d9c48f}
      .inv-brand{display:flex;align-items:center;gap:14px}
      .inv-logo{width:65px;height:65px;object-fit:contain}
      .inv-salon{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:30px;letter-spacing:.04em;color:#2b1d12;line-height:1}
      .inv-tagline{font-size:9.5px;font-weight:500;letter-spacing:.28em;text-transform:uppercase;color:#a9812f;margin-top:5px}
      .inv-meta{text-align:right;padding-top:4px}
      .inv-meta-row{display:flex;justify-content:flex-end;gap:16px;font-size:11px;padding:2.5px 0}
      .inv-meta-lbl{color:#8a7560;letter-spacing:.05em}
      .inv-meta-val{color:#2b1d12;font-weight:600;min-width:120px;text-align:right}

      /* ---------- Billed To ---------- */
      .inv-bill{display:flex;justify-content:space-between;align-items:flex-end;padding:22px 0;border-bottom:1px solid #ece3d1}
      .inv-bill-lbl{font-size:9.5px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:#a9812f;margin-bottom:7px}
      .inv-bill-name{font-size:16px;font-weight:500;color:#2b1d12}
      .inv-bill-phone{font-size:12px;color:#8a7560;margin-top:3px}
      .inv-bill-status{font-size:9.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#8a7560;text-align:right}
      .inv-bill-status .dot{color:#a9812f;margin:0 6px}
      .inv-bill-status.paid{color:#5c7a3a}

      /* ---------- Line items table ---------- */
      .inv-tbl{width:100%;border-collapse:collapse;margin-top:26px}
      .inv-tbl th{font-size:9.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#a9812f;padding:0 0 10px;border-bottom:1px solid #d9c48f;text-align:left}
      .inv-tbl th.num,.inv-tbl td.num{text-align:right}
      .inv-tbl td{padding:13px 0;font-size:13px;color:#2b1d12;border-bottom:1px solid #f0e9d8}
      .inv-tbl td.muted{color:#8a7560;font-size:12.5px}
      .inv-tbl tr:last-child td{border-bottom:none}

      /* ---------- Totals ---------- */
      .inv-totals{width:280px;margin-left:auto;margin-top:6px}
      .inv-tr{display:flex;justify-content:space-between;font-size:12.5px;color:#6b5740;padding:5px 0}
      .inv-tr.save{color:#5c7a3a}
      .inv-grand{display:flex;justify-content:space-between;align-items:baseline;padding-top:14px;margin-top:8px;border-top:1px solid #d9c48f}
      .inv-grand-lbl{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#8a7560}
      .inv-grand-val{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:27px;color:#2b1d12}

      .inv-pay{text-align:right;margin-top:14px;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#5c7a3a}
      .inv-pay.pending{color:#a9812f}
      .inv-notes{margin-top:20px;font-size:11.5px;color:#8a7560;font-style:italic;border-top:1px solid #f0e9d8;padding-top:14px}

      /* ---------- Footer ---------- */
      .inv-footer{text-align:center;margin-top:46px;padding-top:20px;border-top:1px solid #d9c48f}
      .inv-footer-main{font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:#2b1d12}
      .inv-footer-sub{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#a9812f;margin-top:6px}
      .inv-footer-contact{font-size:10px;color:#8a7560;letter-spacing:.02em;margin-top:14px;line-height:1.6}
    </style>
  </head><body>
    <div class="inv-wrap">
      <img src="${getLogoDataUri()}" alt="" class="inv-watermark" />
      <div class="inv-content">
      <div class="inv-hd">
        <div class="inv-brand">
          <img src="${getLogoDataUri()}" alt="Velvet logo" class="inv-logo" />
          <div>
            <div class="inv-salon">VELVET</div>
            <div class="inv-tagline">Premium Unisex Salon</div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-meta-row"><span class="inv-meta-lbl">Invoice No.</span><span class="inv-meta-val">${bill.billNumber}</span></div>
          <div class="inv-meta-row"><span class="inv-meta-lbl">Invoice Date</span><span class="inv-meta-val">${dateStr}</span></div>
        </div>
      </div>

      <div class="inv-bill">
        <div>
          <div class="inv-bill-lbl">Billed To</div>
          <div class="inv-bill-name">${custName}</div>
          <div class="inv-bill-phone">${bill.phone}</div>
        </div>
        <div class="inv-bill-status ${bill.status === 'paid' ? 'paid' : ''}">${bill.status === 'paid' ? 'Paid' : 'Payment Pending'}</div>
      </div>

      <table class="inv-tbl">
        <thead><tr><th>Service</th><th>Staff</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="inv-totals">
        <div class="inv-tr"><span>Subtotal</span><span>${fmtCur(bill.subtotal)}</span></div>
        ${bill.membershipDiscount > 0 ? `<div class="inv-tr save"><span>Membership Discount</span><span>−${fmtCur(bill.membershipDiscount)}</span></div>` : ''}
        ${bill.discountAmount > 0 ? `<div class="inv-tr save"><span>Discount</span><span>−${fmtCur(bill.discountAmount)}</span></div>` : ''}
        ${bill.couponDiscount > 0 ? `<div class="inv-tr save"><span>Coupon${bill.couponCode ? ` (${bill.couponCode})` : ''}</span><span>−${fmtCur(bill.couponDiscount)}</span></div>` : ''}
        ${bill.loyaltyRedeemed > 0 ? `<div class="inv-tr save"><span>Loyalty Redeemed</span><span>−${fmtCur(bill.loyaltyRedeemed)}</span></div>` : ''}
        <div class="inv-grand">
          <span class="inv-grand-lbl">Total</span>
          <span class="inv-grand-val">${fmtCur(bill.total)}</span>
        </div>
        <div class="inv-pay ${bill.status === 'paid' ? '' : 'pending'}">${bill.status === 'paid' ? `Paid via ${bill.paymentMethod.toUpperCase()}` : 'Payment Pending'}</div>
        ${bill.notes ? `<div class="inv-notes">Note: ${bill.notes}</div>` : ''}
      </div>

      <div class="inv-footer">
        <div class="inv-footer-main">Thank you for visiting Velvet</div>
        <div class="inv-footer-sub">We look forward to seeing you again</div>
        <div class="inv-footer-contact">
          Opposite to ICICI Bank, KK Nagar, Kalingarayanpalayam, Bhavani, Erode Dt, Tamil Nadu
        </div>
        <div class="inv-footer-contact">
          +91 93456 78646 &nbsp;·&nbsp; Velvetluxurysalon@gmail.com &nbsp;·&nbsp; www.velvetluxurysalon.com
        </div>
      </div>
      </div>
    </div>
  </body></html>`;
}

// Reuse one headless browser instance across requests — launching Chromium
// per-PDF adds ~1-2s of avoidable startup latency.
//
// Locally (Windows/Mac dev), use full `puppeteer` — it manages its own
// Chrome binary (installed via `npx puppeteer browsers install chrome`).
// In serverless environments (Lambda/Vercel), use `puppeteer-core` +
// `@sparticuz/chromium`, which only ships a Linux-compatible binary.
let browserPromise: Promise<Browser> | null = null;

// Local (non-Linux) dev: use an already-installed Chrome / Edge.
// Override with CHROME_PATH in apps/api/.env if yours is elsewhere.
const LOCAL_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const puppeteerCore = await import('puppeteer-core');

    if (process.platform === 'linux') {
      // Production / serverless Linux -> bundled Chromium
      const chromium = (await import('@sparticuz/chromium')).default;
      browserPromise = puppeteerCore.launch({
        headless: true,
        args: chromium.args,
        executablePath: await chromium.executablePath(),
      });
    } else {
      // Local Windows / Mac -> installed Chrome or Edge
      const executablePath =
        process.env.CHROME_PATH ?? LOCAL_CHROME_PATHS.find((p) => existsSync(p));
      if (!executablePath) {
        throw new Error(
          'Chrome/Edge not found. Install Chrome or set CHROME_PATH in apps/api/.env',
        );
      }
      browserPromise = puppeteerCore.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    // If launch fails, don't cache the rejected promise forever
    void browserPromise.catch(() => {
      browserPromise = null;
    });
  }

  return browserPromise;
}

export async function generateInvoicePdf(
  bill: IBill,
  resolveStaffName: StaffNameResolver,
): Promise<Buffer> {
  const html = buildInvoiceHtml(bill, resolveStaffName);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' as 'load' | 'domcontentloaded' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}