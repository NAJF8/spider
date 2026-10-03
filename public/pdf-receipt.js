const RECEIPT_BACKGROUND = 'assets/spider-receipt-background.jpg';
const RECEIPT_FONT = 'assets/fonts/Amiri-Regular.ttf';
const RECEIPT_PART_ORDER = ['cpu', 'motherboard', 'ram', 'storage', 'gpu', 'psu', 'cooling', 'case'];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_LEFT = 16;
const CONTENT_RIGHT = 16;
const CONTENT_TOP = 58;
const CONTENT_BOTTOM = 276;
const HEADER_SAFE_BOTTOM = 54;
const FOOTER_SAFE_TOP = 276;
const CONTENT_WIDTH = PAGE_WIDTH - CONTENT_LEFT - CONTENT_RIGHT;

const receiptText = (language, ar, en) => language === 'en' ? en : ar;
const numberFormatter = new Intl.NumberFormat('en-IQ', { maximumFractionDigits: 0 });
const receiptMoney = (value, language) => `${numberFormatter.format(Number(value || 0))} ${language === 'en' ? 'IQD' : 'د.ع'}`;
const receiptDate = (timestamp, language) => {
  const date = new Date(Number(timestamp) || Date.now());
  return {
    date: date.toLocaleDateString(language === 'en' ? 'en-IQ' : 'ar-IQ'),
    time: date.toLocaleTimeString(language === 'en' ? 'en-IQ' : 'ar-IQ', { hour: '2-digit', minute: '2-digit' })
  };
};

function receiptItems(order) {
  const items = Array.isArray(order?.items) ? order.items.map((item) => ({
    ...item,
    quantity: Number(item.quantity ?? item.qty ?? 1),
    unitPrice: Number(item.unit_price ?? item.unitPrice ?? item.price ?? 0),
    total: Number(item.line_total ?? item.lineTotal ?? item.total ?? (Number(item.unit_price ?? item.unitPrice ?? item.price ?? 0) * Number(item.quantity ?? item.qty ?? 1)))
  })) : [];
  if (!items.some((item) => item.source === 'builder')) return items;
  return items.sort((a, b) => {
    const aKey = RECEIPT_PART_ORDER.indexOf(String(a.partId || a.builderPart || a.part || '').toLowerCase());
    const bKey = RECEIPT_PART_ORDER.indexOf(String(b.partId || b.builderPart || b.part || '').toLowerCase());
    return (aKey < 0 ? 99 : aKey) - (bKey < 0 ? 99 : bKey);
  });
}

let fontPromise;
function pdfErrorDetails(error) {
  return { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack };
}

function logPdfFailure(stage, error) {
  console.error('PDF_STAGE_FAILED', { stage, ...pdfErrorDetails(error) });
}

async function loadArabicFont() {
  if (!fontPromise) {
    fontPromise = fetch(RECEIPT_FONT).then((response) => {
      if (!response.ok) throw new Error(`RECEIPT_FONT_${response.status}`);
      return response.arrayBuffer();
    }).then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return btoa(binary);
    }).catch((error) => { fontPromise = null; throw error; });
  }
  return fontPromise;
}

function applyArabicFont(doc, fontBase64) {
  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri', 'normal');
}

async function imageData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`RECEIPT_BACKGROUND_${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function drawBackground(doc, background) {
  const imageRatio = 902 / 1280;
  const pageRatio = PAGE_WIDTH / PAGE_HEIGHT;
  const width = pageRatio < imageRatio ? PAGE_WIDTH : PAGE_HEIGHT * imageRatio;
  const height = width / imageRatio;
  doc.addImage(background, 'JPEG', (PAGE_WIDTH - width) / 2, (PAGE_HEIGHT - height) / 2, width, height, undefined, 'FAST');
}

function arabicText(doc, value, language) {
  const text = String(value ?? '');
  return language === 'en' || typeof doc.processArabic !== 'function' ? text : doc.processArabic(text);
}

function wrapText(doc, value, width, language) {
  return doc.splitTextToSize(arabicText(doc, value, language), width);
}

function drawTextBlock(doc, value, { x, y, width, language, fontSize = 10, align = 'right', lineHeight = 1.35, color = [32, 37, 34] }) {
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = wrapText(doc, value, width, language);
  doc.text(lines, x, y, { align, baseline: 'top', maxWidth: width });
  return y + Math.max(1, lines.length) * fontSize * 0.3528 * lineHeight;
}

function drawSectionTitle(doc, value, language, y) {
  doc.setDrawColor(219, 235, 158);
  doc.setLineWidth(0.5);
  doc.line(CONTENT_LEFT, y + 5, PAGE_WIDTH - CONTENT_RIGHT, y + 5);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(22, 142, 112);
  doc.text(arabicText(doc, value, language), PAGE_WIDTH / 2, y, { align: 'center', baseline: 'top' });
  return y + 10;
}

function drawInfoRow(doc, label, value, language, y) {
  const labelWidth = 35;
  const valueWidth = CONTENT_WIDTH - labelWidth - 5;
  const valueX = language === 'en' ? CONTENT_LEFT + labelWidth + 5 : PAGE_WIDTH - CONTENT_RIGHT;
  const labelX = language === 'en' ? CONTENT_LEFT : PAGE_WIDTH - CONTENT_RIGHT;
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(23, 139, 112);
  doc.text(arabicText(doc, label, language), labelX, y, { align: language === 'en' ? 'left' : 'right', baseline: 'top' });
  const valueY = drawTextBlock(doc, value || '-', { x: valueX, y: y + 3.5, width: valueWidth, language, fontSize: 9.2, align: language === 'en' ? 'left' : 'right', lineHeight: 1.2 });
  return Math.max(y + 9, valueY + 1.5);
}

function drawInfoPair(doc, left, right, language, y) {
  const gap = 7;
  const width = (CONTENT_WIDTH - gap) / 2;
  const draw = (entry, x, align) => {
    const [label, value] = entry;
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(23, 139, 112);
    doc.text(arabicText(doc, label, language), x, y, { align, baseline: 'top' });
    return drawTextBlock(doc, value || '-', { x: align === 'right' ? x : x, y: y + 3.5, width, language, fontSize: 9.2, align, lineHeight: 1.2 });
  };
  const leftX = language === 'en' ? CONTENT_LEFT : PAGE_WIDTH - CONTENT_RIGHT;
  const rightX = language === 'en' ? CONTENT_LEFT + width + gap : CONTENT_LEFT + width;
  const leftEnd = draw(left, leftX, language === 'en' ? 'left' : 'right');
  const rightEnd = draw(right, rightX, language === 'en' ? 'left' : 'right');
  return Math.max(y + 9, leftEnd, rightEnd) + 1.5;
}

function drawHeader(doc, order, language) {
  const { date, time } = receiptDate(order.timestamp, language);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(22, 142, 112);
  doc.text(arabicText(doc, receiptText(language, 'تفاصيل الطلب', 'Order details'), language), PAGE_WIDTH / 2, HEADER_SAFE_BOTTOM + 7, { align: 'center', baseline: 'top' });
  const meta = [
    [receiptText(language, 'رقم الطلب', 'Order number'), order.orderNumber || order.orderId || '-'],
    [receiptText(language, 'التاريخ', 'Date'), date],
    [receiptText(language, 'الوقت', 'Time'), time]
  ];
  const cellWidth = CONTENT_WIDTH / 3;
  meta.forEach(([label, value], index) => {
    const x = language === 'en' ? CONTENT_LEFT + index * cellWidth + cellWidth / 2 : PAGE_WIDTH - CONTENT_RIGHT - index * cellWidth - cellWidth / 2;
    doc.setFontSize(9);
    doc.setTextColor(23, 139, 112);
    doc.text(arabicText(doc, label, language), x, HEADER_SAFE_BOTTOM + 18, { align: 'center', baseline: 'top' });
    doc.setFontSize(10);
    doc.setTextColor(32, 37, 34);
    doc.text(arabicText(doc, value, language), x, HEADER_SAFE_BOTTOM + 24, { align: 'center', baseline: 'top' });
  });
}

function drawCustomerBlock(doc, order, language, items) {
  let y = drawSectionTitle(doc, receiptText(language, 'بيانات الزبون', 'Customer details'), language, 92);
  const isPickup = String(order.deliveryMethod || '').toLowerCase() === 'pickup';
  const address = isPickup ? '' : [order.governorate, order.district, order.subdistrict, order.neighborhood, order.addressDetails || order.address].filter(Boolean).join(' - ');
  y = drawInfoPair(doc,
    [receiptText(language, 'اسم الزبون', 'Customer name'), order.customerName],
    [receiptText(language, 'رقم الهاتف', 'Phone'), order.customerPhone], language, y);
  y = drawInfoPair(doc,
    [receiptText(language, 'طريقة الاستلام', 'Fulfilment'), isPickup ? receiptText(language, 'استلام من المتجر', 'Store pickup') : receiptText(language, 'توصيل', 'Delivery')],
    [receiptText(language, 'نوع الطلب', 'Order type'), items.some((item) => item.source === 'builder') ? receiptText(language, 'تجميعة كمبيوتر', 'Build Your PC') : receiptText(language, 'طلب عادي', 'Regular order')], language, y);
  if (!isPickup) y = drawInfoRow(doc, receiptText(language, 'العنوان', 'Address'), address, language, y);
  if (order.notes) y = drawInfoRow(doc, receiptText(language, 'الملاحظات', 'Notes'), order.notes, language, y);
  return y + 2;
}

function drawTotals(doc, order, language, y, background) {
  const subtotal = Number(order.subtotal ?? order.subtotalBeforeDiscount ?? 0);
  const discount = Number(order.discount ?? order.builderDiscount ?? 0);
  const delivery = Number(order.deliveryFee ?? 0);
  const finalTotal = Number(order.finalTotal ?? order.grandTotal ?? order.total ?? (subtotal - discount + delivery));
  const rows = [[receiptText(language, 'المجموع قبل الخصم', 'Subtotal before discount'), receiptMoney(subtotal, language)]];
  if (discount > 0) rows.push([receiptText(language, 'الخصم', 'Discount'), receiptMoney(discount, language)]);
  if (delivery > 0) rows.push([receiptText(language, 'التوصيل', 'Delivery'), receiptMoney(delivery, language)]);
  rows.push([receiptText(language, 'السعر النهائي', 'Final total'), receiptMoney(finalTotal, language)]);
  const height = rows.length * 9 + 8;
  if (y + height > FOOTER_SAFE_TOP) {
    doc.addPage();
    drawBackground(doc, background);
    return drawTotals(doc, order, language, CONTENT_TOP + 6, background);
  }
  const boxWidth = 110;
  const boxX = language === 'en' ? PAGE_WIDTH - CONTENT_RIGHT - boxWidth : CONTENT_LEFT;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 227, 209);
  doc.roundedRect(boxX, y, boxWidth, height, 3, 3, 'FD');
  rows.forEach(([label, value], index) => {
    const rowY = y + 6 + index * 9;
    const isFinal = index === rows.length - 1;
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(isFinal ? 14 : 10);
    doc.setTextColor(22, 142, 112);
    doc.text(arabicText(doc, label, language), language === 'en' ? boxX + 5 : boxX + boxWidth - 5, rowY, { align: language === 'en' ? 'left' : 'right', baseline: 'top' });
    doc.setTextColor(32, 37, 34);
    doc.text(arabicText(doc, value, language), language === 'en' ? boxX + boxWidth - 5 : boxX + 5, rowY, { align: language === 'en' ? 'right' : 'left', baseline: 'top' });
    if (isFinal) { doc.setDrawColor(22, 142, 112); doc.line(boxX + 5, rowY - 2, boxX + boxWidth - 5, rowY - 2); }
  });
}

function tableRows(items, language) {
  const rows = items.map((item, index) => [String(index + 1), item.name || item.product_name || '', String(item.quantity), receiptMoney(item.unitPrice, language), receiptMoney(item.total, language)]);
  return language === 'en' ? rows : rows.map((row) => row.reverse());
}

function drawTable(doc, items, language, startY, order, background) {
  const isEnglish = language === 'en';
  const columns = isEnglish ? ['#', 'Product', 'Qty', 'Unit price', 'Total'] : ['الإجمالي', 'سعر الوحدة', 'الكمية', 'المنتج', 'ت'];
  const tableOptions = {
    startY,
    head: [columns.map((value) => arabicText(doc, value, language))],
    body: tableRows(items, language).map((row) => row.map((value) => arabicText(doc, value, language))),
    theme: 'grid',
    margin: { left: CONTENT_LEFT, right: CONTENT_RIGHT, top: CONTENT_TOP + 20, bottom: PAGE_HEIGHT - FOOTER_SAFE_TOP + 8 },
    tableWidth: CONTENT_WIDTH,
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { font: 'Amiri', fontStyle: 'normal', fontSize: 8.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle', halign: isEnglish ? 'left' : 'right', textColor: [32, 37, 34], lineColor: [216, 223, 213], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 142, 112], textColor: [255, 255, 255], fontStyle: 'normal', halign: 'center' },
    alternateRowStyles: { fillColor: [243, 247, 233] },
    columnStyles: isEnglish
      ? { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 75, halign: 'left' }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 38.5, halign: 'center' }, 4: { cellWidth: 38.5, halign: 'center' } }
      : { 0: { cellWidth: 38.5, halign: 'center' }, 1: { cellWidth: 38.5, halign: 'center' }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 75, halign: 'right' }, 4: { cellWidth: 10, halign: 'center' } },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) {
        drawBackground(doc, background);
        doc.setFont('Amiri', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(22, 142, 112);
        doc.text(arabicText(doc, receiptText(language, 'متابعة المنتجات', 'Items continued'), language), language === 'en' ? CONTENT_LEFT : PAGE_WIDTH - CONTENT_RIGHT, CONTENT_TOP + 4, { align: language === 'en' ? 'left' : 'right', baseline: 'top' });
      }
    }
  };
  if (typeof doc.autoTable === 'function') doc.autoTable(tableOptions);
  else if (typeof window.jspdfAutoTable === 'function') window.jspdfAutoTable(doc, tableOptions);
  else throw new Error('AUTOTABLE_UNAVAILABLE');
  return doc.lastAutoTable.finalY;
}

export async function generateOrderReceiptPdf(order, language = 'ar', options = {}) {
  let stage = 'validate order snapshot';
  try {
    if (!order || !Array.isArray(order.items)) throw new Error('ORDER_SNAPSHOT_MISSING');
    const items = receiptItems(order);
    stage = 'load jsPDF';
    const JsPDF = window.jspdf?.jsPDF;
    if (typeof JsPDF !== 'function') throw new Error('JSPDF_UNAVAILABLE');
    stage = 'load font';
    const fontBase64 = await loadArabicFont();
    stage = 'load background';
    const background = await imageData(RECEIPT_BACKGROUND);
    stage = 'create document';
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
    applyArabicFont(doc, fontBase64);
    drawBackground(doc, background);
    stage = 'draw customer section';
    drawHeader(doc, order, language);
    const customerEndY = drawCustomerBlock(doc, order, language, items);
    stage = 'draw AutoTable';
    const tableEndY = drawTable(doc, items, language, customerEndY, order, background);
    stage = 'draw totals';
    drawTotals(doc, order, language, tableEndY + 8, background);
    stage = 'output blob';
    const orderKey = String(order.orderNumber || order.orderId || Date.now()).replace(/[^A-Za-z0-9_-]/g, '-');
    const filename = `SPIDER-ORDER-${orderKey}.pdf`;
    const blob = doc.output('blob');
    if (options.asFile) return new File([blob], filename, { type: 'application/pdf' });
    if (options.download !== false) doc.save(filename);
    return filename;
  } catch (error) {
    logPdfFailure(stage, error);
    throw error;
  }
}
