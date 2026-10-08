const RECEIPT_BACKGROUND = 'assets/spider-receipt-background.jpg';
// Before the jsPDF rebuild this receipt used Cairo in the browser.
const RECEIPT_FONT = 'assets/fonts/Cairo-Regular.ttf';
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
const INFO_LABEL_VALUE_GAP = 4;

const receiptText = (language, ar, en) => language === 'en' ? en : ar;
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
function formatIQD(value, language) {
  return `${numberFormatter.format(Number(value || 0))} ${language === 'en' ? 'IQD' : 'د.ع'}`;
}
function formatIQDParts(value, language) {
  const formatted = typeof value === 'string' && value.includes(' ')
    ? value
    : formatIQD(value, language);
  const separator = formatted.lastIndexOf(' ');
  return { number: formatted.slice(0, separator), currency: formatted.slice(separator + 1) };
}
function renderCurrencyLetter(letter, fontSize, fontStyle, color) {
  const pixelsPerMm = 96 / 25.4;
  const fontPixels = fontSize * pixelsPerMm;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const canvasFontStyle = fontStyle === 'bold' ? 'bold ' : '';
  context.font = `${canvasFontStyle}${fontPixels}px Cairo, Arial, sans-serif`;
  context.direction = 'ltr';
  const width = Math.max(2, Math.ceil(context.measureText(letter).width + 2));
  canvas.width = width;
  canvas.height = Math.ceil(fontPixels * 1.35);
  context.font = `${canvasFontStyle}${fontPixels}px Cairo, Arial, sans-serif`;
  context.fillStyle = `rgb(${color.join(',')})`;
  context.textBaseline = 'top';
  context.direction = 'ltr';
  context.fillText(letter, 1, 0);
  return { data: canvas.toDataURL('image/png'), width: width / pixelsPerMm };
}
function drawIQD(doc, amount, x, y, { fontSize = 8.5, align = 'left', gap = 2, color = [32, 37, 34], language = 'ar', fontStyle = 'normal' } = {}) {
  const parts = formatIQDParts(amount, language);
  doc.setFont('Cairo', fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const currencyFontSize = Math.max(6, Math.min(9, fontSize >= 14 ? fontSize - 5 : fontSize - 2));
  const currencyGap = 0.8;
  const numberWidth = doc.getTextWidth(parts.number);
  const currencyLetters = language === 'en' ? [...parts.currency] : ['د', 'ع'];
  const renderedLetters = currencyLetters.map((letter) => renderCurrencyLetter(letter, currencyFontSize, fontStyle, color));
  const currencyWidth = renderedLetters.reduce((sum, value) => sum + value.width, 0) + currencyGap;
  const width = numberWidth + gap + currencyWidth;
  const startX = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  doc.setFontSize(fontSize);
  doc.text(parts.number, startX, y, { align: 'left', baseline: 'top' });
  let letterX = startX + numberWidth + gap;
  renderedLetters.forEach((letter, index) => {
    doc.addImage(letter.data, 'PNG', letterX, y - 0.1, letter.width, currencyFontSize * 0.5, undefined, 'FAST');
    letterX += letter.width + (index < renderedLetters.length - 1 ? currencyGap : 0);
  });
}
function formatDeliveryMethod(value, language) {
  return String(value || '').toLowerCase() === 'pickup'
    ? receiptText(language, 'استلام من المتجر', 'Store Pickup')
    : receiptText(language, 'توصيل', 'Delivery');
}
const receiptDate = (timestamp, language) => {
  const date = new Date(Number(timestamp) || Date.now());
  const pad = (value) => String(value).padStart(2, '0');
  const hours = date.getHours();
  const hour12 = hours % 12 || 12;
  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(hour12)}:${pad(date.getMinutes())} ${language === 'en' ? (hours >= 12 ? 'PM' : 'AM') : (hours >= 12 ? 'م' : 'ص')}`
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
  doc.addFileToVFS('Cairo-Regular.ttf', fontBase64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'bold');
  doc.setFont('Cairo', 'normal');
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
  doc.setFont('Cairo', 'normal');
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
  doc.setFont('Cairo', 'normal');
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
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(23, 139, 112);
  doc.text(arabicText(doc, label, language), labelX, y, { align: language === 'en' ? 'left' : 'right', baseline: 'top' });
  const valueY = drawTextBlock(doc, value || '-', { x: valueX, y: y + INFO_LABEL_VALUE_GAP, width: valueWidth, language, fontSize: 9.2, align: language === 'en' ? 'left' : 'right', lineHeight: 1.2 });
  return Math.max(y + 9.5, valueY + 1);
}

function drawInfoPair(doc, left, right, language, y) {
  const gap = 7;
  const width = (CONTENT_WIDTH - gap) / 2;
  const draw = (entry, x, align) => {
    const [label, value] = entry;
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(23, 139, 112);
    doc.text(arabicText(doc, label, language), x, y, { align, baseline: 'top' });
    return drawTextBlock(doc, value || '-', { x: align === 'right' ? x : x, y: y + INFO_LABEL_VALUE_GAP, width, language, fontSize: 9.2, align, lineHeight: 1.2 });
  };
  const leftX = language === 'en' ? CONTENT_LEFT : PAGE_WIDTH - CONTENT_RIGHT;
  const rightX = language === 'en' ? CONTENT_LEFT + width + gap : CONTENT_LEFT + width;
  const leftEnd = draw(left, leftX, language === 'en' ? 'left' : 'right');
  const rightEnd = draw(right, rightX, language === 'en' ? 'left' : 'right');
  return Math.max(y + 9.5, leftEnd, rightEnd) + 1;
}

function drawHeader(doc, order, language) {
  const { date, time } = receiptDate(order.timestamp, language);
  doc.setFont('Cairo', 'normal');
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
    doc.setFontSize(9.2);
    doc.setTextColor(32, 37, 34);
    doc.text(arabicText(doc, value, language), x, HEADER_SAFE_BOTTOM + 24, { align: 'center', baseline: 'top', maxWidth: cellWidth - 8 });
  });
}

function drawCustomerBlock(doc, order, language, items) {
  let y = drawSectionTitle(doc, receiptText(language, 'بيانات الزبون', 'Customer details'), language, 92);
  const deliveryMethod = String(order.deliveryMethod || order.fulfilment || order.fulfillment || 'delivery').toLowerCase();
  const isPickup = deliveryMethod === 'pickup';
  const address = isPickup ? '' : [order.governorate, order.district, order.subdistrict, order.neighborhood, order.addressDetails || order.address].filter(Boolean).join(' - ');
  y = drawInfoPair(doc,
    [receiptText(language, 'اسم الزبون', 'Customer name'), order.customerName],
    [receiptText(language, 'رقم الهاتف', 'Phone'), order.customerPhone], language, y);
  y = drawInfoPair(doc,
    [receiptText(language, 'طريقة الاستلام', 'Fulfilment'), formatDeliveryMethod(deliveryMethod, language)],
    [receiptText(language, 'نوع الطلب', 'Order type'), items.some((item) => item.source === 'builder') ? receiptText(language, 'تجميعة كمبيوتر', 'Build Your PC') : receiptText(language, 'طلب عادي', 'Regular order')], language, y);
  if (!isPickup) y = drawInfoRow(doc, receiptText(language, 'العنوان', 'Address'), address, language, y);
  if (order.notes) y = drawInfoRow(doc, receiptText(language, 'الملاحظات', 'Notes'), order.notes, language, y);
  return y + 2;
}

function drawTotals(doc, order, language, y, background) {
  const subtotal = Number(order.subtotal ?? order.subtotalBeforeDiscount ?? 0);
  const invoiceDiscount = Number(order.builderInvoiceDiscount ?? 0);
  const delivery = Number(order.deliveryFee ?? 0);
  const finalTotal = Number(order.finalTotal ?? order.grandTotal ?? order.total ?? (subtotal - discount + delivery));
  const rows = [[receiptText(language, 'المجموع قبل الخصم', 'Subtotal before discount'), formatIQD(subtotal, language)]];
  if (invoiceDiscount > 0) rows.push([receiptText(language, 'خصم التجميعة', 'Build invoice discount'), formatIQD(invoiceDiscount, language)]);
  if (delivery > 0) rows.push([receiptText(language, 'التوصيل', 'Delivery'), formatIQD(delivery, language)]);
  rows.push([receiptText(language, 'السعر النهائي', 'Final total'), formatIQD(finalTotal, language)]);
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
    doc.setFont('Cairo', isFinal ? 'bold' : 'normal');
    doc.setFontSize(isFinal ? 14 : 10);
    doc.setTextColor(22, 142, 112);
    doc.text(arabicText(doc, label, language), language === 'en' ? boxX + 5 : boxX + boxWidth - 5, rowY, { align: language === 'en' ? 'left' : 'right', baseline: 'top' });
    doc.setTextColor(32, 37, 34);
    const valueX = language === 'en' ? boxX + boxWidth - 5 : boxX + 6;
    if (language === 'en') {
      doc.text(value, valueX, rowY, { align: 'right', baseline: 'top' });
    } else {
      drawIQD(doc, value, valueX, rowY, { fontSize: isFinal ? 14 : 10, fontStyle: isFinal ? 'bold' : 'normal', language });
    }
    if (isFinal) { doc.setDrawColor(22, 142, 112); doc.line(boxX + 5, rowY - 2, boxX + boxWidth - 5, rowY - 2); }
  });
}

function tableRows(items, language) {
  const rows = items.map((item, index) => [String(index + 1), item.name || item.product_name || '', String(item.quantity), formatIQD(item.unitPrice, language), formatIQD(item.total, language)]);
  return language === 'en' ? rows : rows.map((row) => row.reverse());
}

function drawTable(doc, items, language, startY, order, background) {
  const isEnglish = language === 'en';
  const columns = isEnglish ? ['#', 'Product', 'Qty', 'Unit price', 'Total'] : ['الإجمالي', 'سعر الوحدة', 'الكمية', 'المنتج', 'ت'];
  const tableOptions = {
    startY,
    head: [columns.map((value) => arabicText(doc, value, language))],
    body: tableRows(items, language).map((row) => row.map((value, index) => {
      const isCurrencyColumn = isEnglish ? index === 3 || index === 4 : index === 0 || index === 1;
      return isCurrencyColumn ? value : arabicText(doc, value, language);
    })),
    theme: 'grid',
    margin: { left: CONTENT_LEFT, right: CONTENT_RIGHT, top: CONTENT_TOP + 20, bottom: PAGE_HEIGHT - FOOTER_SAFE_TOP + 8 },
    tableWidth: CONTENT_WIDTH,
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { font: 'Cairo', fontStyle: 'normal', fontSize: 8.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle', halign: isEnglish ? 'left' : 'right', textColor: [32, 37, 34], lineColor: [216, 223, 213], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 142, 112], textColor: [255, 255, 255], fontStyle: 'normal', halign: 'center' },
    alternateRowStyles: { fillColor: [243, 247, 233] },
    columnStyles: isEnglish
      ? { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 75, halign: 'left' }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 38.5, halign: 'center' }, 4: { cellWidth: 38.5, halign: 'center' } }
      : { 0: { cellWidth: 38.5, halign: 'center' }, 1: { cellWidth: 38.5, halign: 'center' }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 75, halign: 'right' }, 4: { cellWidth: 10, halign: 'center' } },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) {
        drawBackground(doc, background);
        doc.setFont('Cairo', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(22, 142, 112);
        doc.text(arabicText(doc, receiptText(language, 'متابعة المنتجات', 'Items continued'), language), language === 'en' ? CONTENT_LEFT : PAGE_WIDTH - CONTENT_RIGHT, CONTENT_TOP + 4, { align: language === 'en' ? 'left' : 'right', baseline: 'top' });
      }
    }
  };
  tableOptions.willDrawCell = ({ cell, row, column }) => {
    const isCurrencyColumn = isEnglish ? column.index === 3 || column.index === 4 : column.index === 0 || column.index === 1;
    if (isCurrencyColumn && row.section === 'body') cell.text = [];
  };
  tableOptions.didDrawCell = ({ cell, row, column }) => {
    const isCurrencyColumn = isEnglish ? column.index === 3 || column.index === 4 : column.index === 0 || column.index === 1;
    if (isCurrencyColumn && row.section === 'body') drawIQD(doc, row.raw[column.index], cell.x + cell.width / 2, cell.y + cell.height / 2 - 1.8, { fontSize: 8.5, align: 'center', language });
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
    if (document.fonts?.load) await document.fonts.load('400 16px Cairo');
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
