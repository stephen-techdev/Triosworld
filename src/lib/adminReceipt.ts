/**
 * Admin order receipt.
 *
 * Generated in the operator's browser from the order the admin dashboard has
 * already loaded. It is never uploaded, so there is no server-side copy of a
 * customer's address to expire or leak — the PDF exists only as the file the
 * operator downloads.
 *
 * The layout deliberately mirrors the customer payment receipt, but it is an
 * order record rather than a payment proof: it prints the real payment and
 * fulfilment status, and it prints "Rs." because jsPDF's built-in fonts do not
 * contain the rupee glyph.
 */
import { jsPDF } from 'jspdf';
import type { AdminOrder } from '@/lib/admin';

const INK: [number, number, number] = [23, 23, 23];
const LIME: [number, number, number] = [183, 255, 67];
const MUTED: [number, number, number] = [120, 120, 120];
const LINE: [number, number, number] = [222, 220, 214];
const PENDING: [number, number, number] = [255, 236, 179];
const REFUNDED: [number, number, number] = [230, 235, 245];
const FAILED: [number, number, number] = [255, 224, 224];
const NEUTRAL: [number, number, number] = [235, 235, 235];

const PAGE_W = 210;
const PAGE_H = 297;
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

/** Trim a value to the column width so a long gateway ref cannot overlap. */
function fit(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && doc.getTextWidth(`${value}...`) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

function paymentLabel(order: AdminOrder): string {
  if (order.status === 'cancelled') return 'CANCELLED';
  const status = (order.payment_status || 'pending').toUpperCase();
  if (status === 'PAID') return 'PAID';
  if (status === 'PENDING') return 'PAYMENT PENDING';
  if (status === 'FAILED') return 'PAYMENT FAILED';
  if (status === 'REFUNDED') return 'REFUNDED';
  if (status === 'EXPIRED') return 'EXPIRED';
  return status;
}

function statusFill(order: AdminOrder): [number, number, number] {
  if (order.status === 'cancelled') return FAILED;
  switch ((order.payment_status || '').toLowerCase()) {
    case 'paid': return LIME;
    case 'pending': return PENDING;
    case 'failed': return FAILED;
    case 'refunded': return REFUNDED;
    case 'expired': return NEUTRAL;
    default: return NEUTRAL;
  }
}

function isDemo(order: AdminOrder): boolean {
  return (order.payment_provider ?? '').toLowerCase() === 'demo';
}

function build(order: AdminOrder): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const address = order.shipping_address ?? {};
  const demo = isDemo(order);
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
  doc.text('ORDER RECEIPT', PAGE_W - MARGIN, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 190, 190);
  doc.text('www.triosworld.in  |  +91 63838 83727', PAGE_W - MARGIN, 21, { align: 'right' });

  // ---------------- status strip ----------------
  y = 40;
  doc.setFillColor(...statusFill(order));
  doc.rect(MARGIN, y, CONTENT_W, 10, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(paymentLabel(order), MARGIN + 3, y + 6.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(rs(order.total), PAGE_W - MARGIN - 3, y + 6.6, { align: 'right' });

  if (demo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 60, 60);
    doc.text('DEMO PAYMENT — NO MONEY WAS COLLECTED', MARGIN, y + 15);
    y += 21;
  } else {
    y += 19;
  }

  // ---------------- order + payment details ----------------
  const colRight = MARGIN + CONTENT_W / 2 + 4;
  const labelW = 27;
  const valueMax = 55;

  const detailRow = (label: string, value: string, x: number, rowY: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(fit(doc, value, valueMax), x + labelW, rowY);
  };

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y - 6, PAGE_W - MARGIN, y - 6);

  detailRow('Order ID', order.order_number, MARGIN, y);
  detailRow('Order date', dateIn(order.created_at), colRight, y);
  y += 7;

  detailRow('Fulfilment', (order.status || 'placed').toUpperCase(), MARGIN, y);
  detailRow('Payment', (order.payment_method || 'UPI').toUpperCase(), colRight, y);
  y += 7;

  detailRow('Payment status', (order.payment_status || 'pending').toUpperCase(), MARGIN, y);
  detailRow('Provider', order.payment_provider ?? '—', colRight, y);
  y += 7;

  detailRow('Paid on', dateIn(order.paid_at), MARGIN, y);
  detailRow('Amount paid', order.amount_paid != null ? rs(order.amount_paid) : '—', colRight, y);
  y += 9;

  const txn = order.payment_id ?? order.payment_reference;
  if (txn) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('TXN REF', MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(txn, CONTENT_W - labelW) as string[];
    lines.forEach((line) => {
      doc.text(line, MARGIN + labelW, y);
      y += 4;
    });
    y += 3;
  }

  // ---------------- delivery address ----------------
  doc.setDrawColor(...LINE);
  doc.line(MARGIN, y - 1, PAGE_W - MARGIN, y - 1);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('DELIVER TO', MARGIN, y);
  y += 5.5;

  const name = address.fullName ?? order.customer_name ?? 'Customer';
  const rawMobile = address.mobile ?? order.customer_mobile ?? '';
  const mobile = rawMobile.replace(/\D/g, '').slice(-10);
  const mobileLabel = mobile.length === 10 ? `+91 ${mobile}` : rawMobile;
  const email = address.email ?? order.customer_email ?? '';

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(name, MARGIN, y);
  y += 4.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (mobileLabel) {
    doc.text(mobileLabel, MARGIN, y);
    y += 4.2;
  }
  if (email) {
    doc.text(email, MARGIN, y);
    y += 4.2;
  }

  const addressLines = [
    address.address ?? '',
    [address.city, address.state, address.pincode].filter(Boolean).join(', '),
  ].filter(Boolean);

  if (addressLines.length) {
    for (const line of addressLines.flatMap((l) => doc.splitTextToSize(l, CONTENT_W) as string[])) {
      doc.text(line, MARGIN, y);
      y += 4.2;
    }
  } else {
    doc.setTextColor(...MUTED);
    doc.text('Address not recorded', MARGIN, y);
    y += 4.2;
  }

  y += 7;

  // ---------------- items table ----------------
  const cols = {
    idx: MARGIN + 2,
    item: MARGIN + 10,
    qty: MARGIN + 118,
    unit: MARGIN + 143,
    amount: PAGE_W - MARGIN - 2,
  };

  const tableHeader = () => {
    doc.setFillColor(...INK);
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('#', cols.idx, y + 5.3);
    doc.text('ITEM / SELECTION', cols.item, y + 5.3);
    doc.text('QTY', cols.qty, y + 5.3, { align: 'right' });
    doc.text('UNIT', cols.unit, y + 5.3, { align: 'right' });
    doc.text('AMOUNT', cols.amount, y + 5.3, { align: 'right' });
    y += 8;
  };

  tableHeader();

  const items = order.items ?? [];
  if (!items.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('No item lines recorded for this order.', cols.item, y + 6);
    y += 14;
  }

  items.forEach((item, i) => {
    const nameLines = doc.splitTextToSize(item.name || 'Item', 88) as string[];
    const selection = fit(
      doc,
      `Colour: ${item.color || '—'}   |   Size: ${item.size || '—'}`,
      88,
    );
    const rowH = Math.max(12, 5 + nameLines.length * 4.2 + 4.5 + 2);

    if (y + rowH > 250) {
      doc.addPage();
      y = 22;
      tableHeader();
    }

    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(String(i + 1), cols.idx, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    nameLines.forEach((line, li) => doc.text(line, cols.item, y + 5 + li * 4.2));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...MUTED);
    doc.text(selection, cols.item, y + 5 + nameLines.length * 4.2 + 1.5);

    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(String(item.qty), cols.qty, y + 5, { align: 'right' });
    doc.text(rs(item.unitPrice), cols.unit, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(rs(item.lineTotal), cols.amount, y + 5, { align: 'right' });

    y += rowH;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, y - 3, PAGE_W - MARGIN, y - 3);
  });

  y += 4;

  if (y > 220) {
    doc.addPage();
    y = 24;
  }

  // ---------------- totals ----------------
  const totalsX = PAGE_W - MARGIN - 2;
  const totalsLabelX = PAGE_W - MARGIN - 62;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10.5 : 9);
    doc.setTextColor(...(bold ? INK : MUTED));
    doc.text(label, totalsLabelX, y);
    doc.setTextColor(...INK);
    doc.text(value, totalsX, y, { align: 'right' });
    y += bold ? 7 : 5.4;
  };

  totalRow('Subtotal', rs(order.subtotal));
  totalRow('Shipping', order.shipping > 0 ? rs(order.shipping) : 'Free');
  if (order.discount > 0) totalRow('Discount', `-${rs(order.discount)}`);
  totalRow('Order total', rs(order.total), true);

  const paid = Number(order.amount_paid ?? 0);
  if (order.payment_status === 'paid') {
    totalRow('Amount paid', rs(paid > 0 ? paid : order.total));
    if (paid > 0 && paid < order.total) {
      totalRow('Balance due', rs(order.total - paid));
    }
  } else if (order.payment_status === 'refunded') {
    totalRow('Refunded', rs(paid > 0 ? paid : order.total));
  } else if (paid > 0) {
    totalRow('Amount received', rs(paid));
    totalRow('Balance due', rs(Math.max(0, order.total - paid)));
  } else {
    totalRow('Amount due', rs(order.total));
  }

  // ---------------- footer ----------------
  const footerY = PAGE_H - 25;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY - 8, PAGE_W - MARGIN, footerY - 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('This is a computer-generated order receipt and does not require a signature.', MARGIN, footerY);
  doc.text('Support: WhatsApp +91 63838 83727  |  www.triosworld.in', MARGIN, footerY + 4);
  doc.text('Generated on demand from the TriosWorld admin dashboard. No copy is stored on the server.', MARGIN, footerY + 8);
  if (demo) {
    doc.setTextColor(160, 60, 60);
    doc.text('DEMO PAYMENT — no money was collected.', MARGIN, footerY + 12);
  }

  return doc;
}

/** Build and download the PDF as `TriosWorld-Order-<order>.pdf`. */
export function downloadAdminReceipt(order: AdminOrder): void {
  const doc = build(order);
  const safeNumber = order.order_number.replace(/[^\w-]+/g, '-');
  doc.save(`TriosWorld-Order-${safeNumber}.pdf`);
}
