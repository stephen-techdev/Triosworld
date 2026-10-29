/**
 * PDF payment receipt.
 *
 * Generated in the browser with jsPDF from a payload that the `trios-pay` edge
 * function refuses to return unless the order is genuinely `paid` — so a
 * receipt can never be produced for an unverified order.
 *
 * The bill is laid out at 80 mm wide (the usual ATM/thermal-paper size) but
 * keeps the same sections as the original A4 receipt: status, order details,
 * billing address, item lines, totals and footer.
 *
 * Note on the currency symbol: jsPDF's built-in fonts use WinAnsi encoding,
 * which has no rupee glyph (U+20B9) and would render it as noise. We print
 * "Rs." instead, which is unambiguous and prints correctly everywhere.
 */
import { jsPDF } from 'jspdf';
import type { ReceiptPayload } from '@/lib/payments';

const INK: [number, number, number] = [23, 23, 23];
const LIME: [number, number, number] = [183, 255, 67];
const MUTED: [number, number, number] = [120, 120, 120];
const LINE: [number, number, number] = [222, 220, 214];
const STATUS_IDLE: [number, number, number] = [240, 240, 236];

/** 80 mm thermal roll; height is one bill slip, not an A4 sheet. */
const PAGE_W = 80;
const PAGE_H = 200;
const MARGIN = 5;
const CONTENT_W = PAGE_W - MARGIN * 2;

function rs(n: number): string {
  const value = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
  return `Rs. ${value}`;
}

function dateIn(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Trim a single-line value so it cannot cross into the amount column. */
function fit(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && doc.getTextWidth(`${value}...`) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [hundred ? `${ONES[hundred]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

/** Indian numbering system: crore / lakh / thousand. */
function amountInWords(amount: number): string {
  let n = Math.round(amount);
  if (n <= 0) return 'Zero Rupees Only';

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;

  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));

  return `${parts.join(' ')} Rupees Only`;
}

function newSlip(doc: jsPDF): void {
  doc.addPage([PAGE_W, PAGE_H], 'portrait');
}

export function buildReceipt(payload: ReceiptPayload): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H] });
  let y = 0;

  // ---------------- header band ----------------
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TRIO', MARGIN, 9.5);

  const trioW = doc.getTextWidth('TRIO');
  doc.setTextColor(...LIME);
  doc.text('S', MARGIN + trioW, 9.5);

  doc.setTextColor(255, 255, 255);
  doc.text('WORLD', MARGIN + trioW + doc.getTextWidth('S'), 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(190, 190, 190);
  doc.text('Three vibes, one world.', MARGIN, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYMENT RECEIPT', PAGE_W - MARGIN, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(190, 190, 190);
  doc.text('www.triosworld.in  |  +91 63838 83727', PAGE_W - MARGIN, 15, { align: 'right' });
  doc.text('santhoshsandy8883@gmail.com', PAGE_W - MARGIN, 19, { align: 'right' });

  // ---------------- status strip ----------------
  const paid = payload.payment_status === 'paid' && !payload.is_demo;
  doc.setFillColor(...(paid ? LIME : STATUS_IDLE));
  doc.rect(MARGIN, 34, CONTENT_W, 8, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(
    payload.is_demo ? 'DEMO PAYMENT - NOT A REAL TRANSACTION' : 'PAID',
    MARGIN + 2,
    39.2,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(rs(payload.amount_paid ?? payload.total), PAGE_W - MARGIN - 2, 39.2, { align: 'right' });

  y = 48;

  // ---------------- order + payment details ----------------
  const labelX = MARGIN;
  const valueX = MARGIN + 23;
  const valueMax = CONTENT_W - 23 - 1;

  const detailRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), labelX, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...INK);
    doc.text(fit(doc, value, valueMax), valueX, y);
    y += 4.5;
  };

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y - 2.5, PAGE_W - MARGIN, y - 2.5);

  detailRow('Order ID', payload.order_number);
  detailRow('Order date', dateIn(payload.order_date));
  detailRow('Payment', payload.payment_method?.toUpperCase() ?? 'UPI');
  detailRow('Paid on', dateIn(payload.paid_at));
  detailRow('Status', payload.payment_status.toUpperCase());
  detailRow('Provider', payload.payment_provider ?? '—');
  detailRow('Txn ref', payload.payment_id ?? '—');
  detailRow('Gateway ref', payload.payment_reference ?? '—');

  y += 3;

  // ---------------- bill to ----------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text('BILLED TO', MARGIN, y);
  y += 4.5;

  const c = payload.customer ?? {};
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(fit(doc, c.fullName ?? 'Customer', CONTENT_W), MARGIN, y);
  y += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  if (c.mobile) { doc.text(`+91 ${c.mobile}`, MARGIN, y); y += 3.5; }
  if (c.email) { doc.text(fit(doc, c.email, CONTENT_W), MARGIN, y); y += 3.5; }

  const addressLines = [
    c.address ?? '',
    [c.city, c.state, c.pincode].filter(Boolean).join(', '),
  ].filter(Boolean);
  for (const line of addressLines.flatMap(l => doc.splitTextToSize(l, CONTENT_W) as string[])) {
    doc.text(line, MARGIN, y);
    y += 3.5;
  }

  y += 4;

  // ---------------- items table ----------------
  const cols = {
    idx: MARGIN + 1,
    item: MARGIN + 5,
    qty: MARGIN + 54,
    amount: PAGE_W - MARGIN - 1,
  };
  const itemNameWidth = 44;

  const tableHeader = () => {
    doc.setFillColor(...INK);
    doc.rect(MARGIN, y, CONTENT_W, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.text('#', cols.idx, y + 4.4);
    doc.text('ITEM / SELECTION', cols.item, y + 4.4);
    doc.text('QTY', cols.qty, y + 4.4, { align: 'right' });
    doc.text('AMOUNT', cols.amount, y + 4.4, { align: 'right' });
    y += 6.5;
  };

  tableHeader();

  doc.setFont('helvetica', 'normal');
  payload.items.forEach((item, i) => {
    const nameLines = doc.splitTextToSize(String(item.name), itemNameWidth) as string[];
    const selection = `${item.color}  |  Size ${item.size}`;
    const selectionLines = doc.splitTextToSize(selection, itemNameWidth) as string[];
    const rowH = Math.max(10, 4 + nameLines.length * 3.4 + selectionLines.length * 3 + 3.2);

    if (y + rowH > PAGE_H - 20) {
      newSlip(doc);
      y = 10;
      tableHeader();
    }

    doc.setFontSize(6.5);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'normal');
    doc.text(String(i + 1), cols.idx, y + 4);
    doc.setFont('helvetica', 'bold');
    nameLines.forEach((line, li) => doc.text(line, cols.item, y + 4 + li * 3.4));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...MUTED);
    const selectionY = y + 4 + nameLines.length * 3.4;
    selectionLines.forEach((line, li) => doc.text(line, cols.item, selectionY + li * 3));
    doc.text(`@ ${rs(item.unitPrice)} each`, cols.item, selectionY + selectionLines.length * 3);

    doc.setFontSize(6.2);
    doc.setTextColor(...INK);
    doc.text(String(item.qty), cols.qty, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(rs(item.lineTotal), cols.amount, y + 4, { align: 'right' });

    y += rowH;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, y - 1.5, PAGE_W - MARGIN, y - 1.5);
  });

  y += 3;

  // ---------------- totals ----------------
  const totalsX = PAGE_W - MARGIN - 1;
  const totalsLabelX = MARGIN + 30;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 7.5 : 6.5);
    doc.setTextColor(...(bold ? INK : MUTED));
    doc.text(label, totalsLabelX, y);
    doc.setTextColor(...INK);
    doc.text(value, totalsX, y, { align: 'right' });
    y += bold ? 5.5 : 4.3;
  };

  totalRow('Subtotal', rs(payload.subtotal));
  if (payload.shipping > 0) totalRow('Shipping', rs(payload.shipping));
  totalRow('Total paid', rs(payload.amount_paid ?? payload.total), true);

  y += 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...MUTED);
  const taxLine = `Includes GST of ${rs(payload.tax_included)} (CGST/SGST) - prices are inclusive of tax`;
  for (const line of doc.splitTextToSize(taxLine, CONTENT_W - 30) as string[]) {
    doc.text(line, totalsLabelX, y);
    y += 2.8;
  }
  y += 1;
  doc.setFont('helvetica', 'italic');
  for (const line of doc.splitTextToSize(amountInWords(payload.amount_paid ?? payload.total), CONTENT_W - 30) as string[]) {
    doc.text(line, totalsLabelX, y);
    y += 2.8;
  }

  // ---------------- footer ----------------
  if (y > PAGE_H - 17) {
    newSlip(doc);
    y = 10;
  }
  y += 3;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...MUTED);
  doc.text('Computer-generated receipt. No signature required.', MARGIN, y);
  y += 3.2;
  doc.text('Support: WhatsApp +91 63838 83727', MARGIN, y);
  if (payload.is_demo) {
    y += 3.2;
    doc.setTextColor(160, 60, 60);
    doc.text('DEMO MODE: no payment gateway is configured; no money was collected.', MARGIN, y);
  }

  return doc;
}

/** Build and download the receipt as `TriosWorld-Receipt-<order>.pdf`. */
export function downloadReceipt(payload: ReceiptPayload) {
  buildReceipt(payload).save(`TriosWorld-Receipt-${payload.order_number}.pdf`);
}
