/**
 * PDF payment receipt.
 *
 * Generated in the browser with jsPDF from a payload that the `trios-pay` edge
 * function refuses to return unless the order is genuinely `paid` — so a
 * receipt can never be produced for an unverified order.
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

const PAGE_W = 210;
const MARGIN = 14;
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

export function buildReceipt(payload: ReceiptPayload): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;

  // ---------------- header band ----------------
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('TRIO', MARGIN, 17);

  const trioW = doc.getTextWidth('TRIO');
  doc.setTextColor(...LIME);
  doc.text('S', MARGIN + trioW, 17);

  doc.setTextColor(255, 255, 255);
  doc.text('WORLD', MARGIN + trioW + doc.getTextWidth('S'), 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 190, 190);
  doc.text('Three vibes, one world.', MARGIN, 24);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', PAGE_W - MARGIN, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 190, 190);
  doc.text('www.triosworld.in  |  +91 63838 83727', PAGE_W - MARGIN, 21, { align: 'right' });

  y = 44;

  // ---------------- status strip ----------------
  const paid = payload.payment_status === 'paid' && !payload.is_demo;
  doc.setFillColor(...(paid ? LIME : STATUS_IDLE));
  doc.rect(MARGIN, y, CONTENT_W, 10, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(payload.is_demo ? 'DEMO PAYMENT - NOT A REAL TRANSACTION' : 'PAID', MARGIN + 3, y + 6.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(rs(payload.amount_paid ?? payload.total), PAGE_W - MARGIN - 3, y + 6.6, { align: 'right' });

  y += 18;

  // ---------------- order + payment details ----------------
  const colRight = MARGIN + CONTENT_W / 2 + 4;
  const labelW = 30;

  const detailRow = (label: string, value: string, x: number, rowY: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(value, x + labelW, rowY);
  };

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y - 6, PAGE_W - MARGIN, y - 6);

  detailRow('Order ID', payload.order_number, MARGIN, y);
  detailRow('Order date', dateIn(payload.order_date), colRight, y);
  y += 7;
  detailRow('Payment', payload.payment_method?.toUpperCase() ?? 'UPI', MARGIN, y);
  detailRow('Paid on', dateIn(payload.paid_at), colRight, y);
  y += 7;
  detailRow('Status', payload.payment_status.toUpperCase(), MARGIN, y);
  detailRow('Provider', payload.payment_provider ?? '—', colRight, y);
  y += 7;
  detailRow('Txn ref', payload.payment_id ?? '—', MARGIN, y);
  detailRow('Gateway ref', payload.payment_reference ?? '—', colRight, y);

  y += 12;

  // ---------------- bill to ----------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('BILLED TO', MARGIN, y);
  y += 5.5;

  const c = payload.customer ?? {};
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(c.fullName ?? 'Customer', MARGIN, y);
  y += 4.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (c.mobile) { doc.text(`+91 ${c.mobile}`, MARGIN, y); y += 4.2; }
  if (c.email) { doc.text(c.email, MARGIN, y); y += 4.2; }

  const addressLines = [
    c.address ?? '',
    [c.city, c.state, c.pincode].filter(Boolean).join(', '),
  ].filter(Boolean);
  for (const line of addressLines.flatMap(l => doc.splitTextToSize(l, CONTENT_W) as string[])) {
    doc.text(line, MARGIN, y);
    y += 4.2;
  }

  y += 7;

  // ---------------- items table ----------------
  const cols = {
    idx: MARGIN,
    item: MARGIN + 8,
    qty: MARGIN + 118,
    unit: MARGIN + 138,
    amount: PAGE_W - MARGIN,
  };

  const tableHeader = () => {
    doc.setFillColor(...INK);
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('#', cols.idx + 1, y + 5.4);
    doc.text('ITEM', cols.item, y + 5.4);
    doc.text('QTY', cols.qty, y + 5.4, { align: 'right' });
    doc.text('UNIT', cols.unit, y + 5.4, { align: 'right' });
    doc.text('AMOUNT', cols.amount, y + 5.4, { align: 'right' });
    y += 8;
  };

  tableHeader();

  doc.setFont('helvetica', 'normal');
  payload.items.forEach((item, i) => {
    if (y > 240) {
      doc.addPage();
      y = 24;
      tableHeader();
    }

    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'normal');
    doc.text(String(i + 1), cols.idx + 1, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.name), cols.item, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${item.color}  |  Size ${item.size}`, cols.item, y + 9.2);

    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(String(item.qty), cols.qty, y + 5, { align: 'right' });
    doc.text(rs(item.unitPrice), cols.unit, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(rs(item.lineTotal), cols.amount, y + 5, { align: 'right' });

    y += 12;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, y - 3, PAGE_W - MARGIN, y - 3);
  });

  y += 4;

  // ---------------- totals ----------------
  const totalsX = PAGE_W - MARGIN - 4;
  const totalsLabelX = PAGE_W - MARGIN - 62;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(...(bold ? INK : MUTED));
    doc.text(label, totalsLabelX, y);
    doc.setTextColor(...INK);
    doc.text(value, totalsX, y, { align: 'right' });
    y += bold ? 7 : 5.4;
  };

  totalRow('Subtotal', rs(payload.subtotal));
  if (payload.shipping > 0) totalRow('Shipping', rs(payload.shipping));
  totalRow('Total paid', rs(payload.amount_paid ?? payload.total), true);

  y += 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `Includes GST of ${rs(payload.tax_included)} (CGST/SGST) - prices are inclusive of tax`,
    totalsLabelX,
    y,
  );
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.text(amountInWords(payload.amount_paid ?? payload.total), totalsLabelX, y);

  // ---------------- footer ----------------
  const footerY = 272;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY - 8, PAGE_W - MARGIN, footerY - 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    'This is a computer-generated receipt and does not require a signature.',
    MARGIN,
    footerY,
  );
  doc.text(
    'Support: WhatsApp +91 63838 83727',
    MARGIN,
    footerY + 4,
  );
  if (payload.is_demo) {
    doc.setTextColor(160, 60, 60);
    doc.text(
      'DEMO MODE: no payment gateway is configured, so no money was collected.',
      MARGIN,
      footerY + 8,
    );
  }

  return doc;
}

/** Build and download the receipt as `TriosWorld-Receipt-<order>.pdf`. */
export function downloadReceipt(payload: ReceiptPayload) {
  buildReceipt(payload).save(`TriosWorld-Receipt-${payload.order_number}.pdf`);
}
