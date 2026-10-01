const RECEIPT_BACKGROUND = 'assets/spider-receipt-background.jpg';
const RECEIPT_PART_ORDER = ['cpu', 'motherboard', 'ram', 'storage', 'gpu', 'psu', 'cooling', 'case'];

const receiptText = (language, ar, en) => language === 'en' ? en : ar;
const escapeReceipt = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const receiptMoney = (value, language) => `${Number(value || 0).toLocaleString('en-IQ')} ${language === 'en' ? 'IQD' : 'د.ع'}`;
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
    unitPrice: Number(item.unit_price ?? item.price ?? 0),
    total: Number(item.line_total ?? (Number(item.unit_price ?? item.price ?? 0) * Number(item.quantity ?? item.qty ?? 1)))
  })) : [];
  if (!items.some((item) => item.source === 'builder')) return items;
  return items.sort((a, b) => {
    const aKey = RECEIPT_PART_ORDER.indexOf(String(a.partId || a.builderPart || a.part || '').toLowerCase());
    const bKey = RECEIPT_PART_ORDER.indexOf(String(b.partId || b.builderPart || b.part || '').toLowerCase());
    return (aKey < 0 ? 99 : aKey) - (bKey < 0 ? 99 : bKey);
  });
}

function receiptPageMarkup({ order, language, items, pageNumber, pageCount }) {
  const isEnglish = language === 'en';
  const { date, time } = receiptDate(order.timestamp, language);
  const customer = [order.customerName, order.customerPhone, [order.governorate, order.district, order.subdistrict, order.neighborhood, order.addressDetails || order.address].filter(Boolean).join(' - ')].filter(Boolean);
  const rows = items.map((item, index) => `<tr>
    <td>${escapeReceipt(index + 1)}</td>
    <td class="item-name">${escapeReceipt(item.name || item.product_name || '')}</td>
    <td>${escapeReceipt(item.quantity)}</td>
    <td>${escapeReceipt(receiptMoney(item.unitPrice, language))}</td>
    <td>${escapeReceipt(receiptMoney(item.total, language))}</td>
  </tr>`).join('');
  const firstPage = pageNumber === 1;
  return `<section class="spider-pdf-page" dir="${isEnglish ? 'ltr' : 'rtl'}">
    <img class="spider-pdf-background" src="${RECEIPT_BACKGROUND}" alt="">
    <div class="spider-pdf-content">
      <div class="spider-pdf-page-meta">${pageCount > 1 ? `${escapeReceipt(isEnglish ? `Page ${pageNumber} of ${pageCount}` : `صفحة ${pageNumber} من ${pageCount}`)}` : ''}</div>
      ${firstPage ? `<div class="spider-pdf-title">${escapeReceipt(receiptText(language, 'وصل طلب', 'Order Receipt'))}</div>
      <div class="spider-pdf-order-meta">
        <div><b>${escapeReceipt(receiptText(language, 'رقم الطلب', 'Order number'))}</b><span>${escapeReceipt(order.orderNumber || order.orderId || '')}</span></div>
        <div><b>${escapeReceipt(receiptText(language, 'التاريخ', 'Date'))}</b><span>${escapeReceipt(date)}</span></div>
        <div><b>${escapeReceipt(receiptText(language, 'الوقت', 'Time'))}</b><span>${escapeReceipt(time)}</span></div>
      </div>
      <div class="spider-pdf-section-title">${escapeReceipt(receiptText(language, 'بيانات الزبون', 'Customer details'))}</div>
      <div class="spider-pdf-customer">
        <div><b>${escapeReceipt(receiptText(language, 'الاسم', 'Name'))}</b><span>${escapeReceipt(customer[0] || '')}</span></div>
        <div><b>${escapeReceipt(receiptText(language, 'الهاتف', 'Phone'))}</b><span>${escapeReceipt(customer[1] || '')}</span></div>
        <div><b>${escapeReceipt(receiptText(language, 'العنوان', 'Address'))}</b><span>${escapeReceipt(customer[2] || '')}</span></div>
        <div><b>${escapeReceipt(receiptText(language, 'نوع الطلب', 'Order type'))}</b><span>${escapeReceipt(items.some((item) => item.source === 'builder') ? receiptText(language, 'تجميعة كمبيوتر', 'Build Your PC') : receiptText(language, 'طلب عادي', 'Regular order'))}</span></div>
        <div><b>${escapeReceipt(receiptText(language, 'طريقة الاستلام', 'Fulfilment'))}</b><span>${escapeReceipt(receiptText(language, 'توصيل', 'Delivery'))}</span></div>
        ${order.notes ? `<div><b>${escapeReceipt(receiptText(language, 'ملاحظات', 'Notes'))}</b><span>${escapeReceipt(order.notes)}</span></div>` : ''}
      </div>` : `<div class="spider-pdf-continuation">${escapeReceipt(receiptText(language, 'متابعة المنتجات', 'Items continued'))}</div>`}
      <table class="spider-pdf-table"><thead><tr>
        <th>${escapeReceipt(receiptText(language, 'ت', '#'))}</th>
        <th>${escapeReceipt(receiptText(language, 'المنتج', 'Product'))}</th>
        <th>${escapeReceipt(receiptText(language, 'الكمية', 'Qty'))}</th>
        <th>${escapeReceipt(receiptText(language, 'سعر الوحدة', 'Unit price'))}</th>
        <th>${escapeReceipt(receiptText(language, 'الإجمالي', 'Total'))}</th>
      </tr></thead><tbody>${rows}</tbody></table>
      ${pageNumber === pageCount ? `<div class="spider-pdf-totals">
        <div><span>${escapeReceipt(receiptText(language, 'المجموع قبل الخصم', 'Subtotal before discount'))}</span><b>${escapeReceipt(receiptMoney(order.subtotal, language))}</b></div>
        ${Number(order.builderDiscount || 0) > 0 ? `<div><span>${escapeReceipt(receiptText(language, 'خصم التجميعة', 'Build discount'))}</span><b>${escapeReceipt(receiptMoney(order.builderDiscount, language))}</b></div>` : ''}
        ${Number(order.deliveryFee || 0) > 0 ? `<div><span>${escapeReceipt(receiptText(language, 'التوصيل', 'Delivery'))}</span><b>${escapeReceipt(receiptMoney(order.deliveryFee, language))}</b></div>` : ''}
        <div class="grand"><span>${escapeReceipt(receiptText(language, 'السعر النهائي', 'Final total'))}</span><b>${escapeReceipt(receiptMoney(order.grandTotal, language))}</b></div>
      </div>` : ''}
    </div>
  </section>`;
}

function receiptStyles() {
  return `<style>
    .spider-pdf-root{position:fixed;left:-100000px;top:0;width:794px;background:#fbfbef;color:#202522;font-family:Cairo,Arial,sans-serif}
    .spider-pdf-page{position:relative;width:794px;height:1123px;overflow:hidden;background:#fbfbef;box-sizing:border-box}
    .spider-pdf-background{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:fill}
    .spider-pdf-content{position:absolute;left:92px;right:92px;top:156px;bottom:126px;z-index:1;font-size:15px;line-height:1.55;direction:inherit}
    .spider-pdf-page-meta{display:none;height:20px;text-align:left;color:#4b5d55;font-size:11px;direction:ltr}
    .spider-pdf-title{text-align:center;font-size:25px;font-weight:800;color:#168e70;margin:3px 0 12px}
    .spider-pdf-order-meta,.spider-pdf-customer{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 14px;background:rgba(255,255,255,.9);border:1px solid #dce3d1;border-radius:10px;padding:10px 12px;margin-bottom:10px}
    .spider-pdf-order-meta div,.spider-pdf-customer div{display:flex;gap:5px;min-width:0;flex-direction:column}
    .spider-pdf-order-meta b,.spider-pdf-customer b{color:#178b70;font-size:11px}.spider-pdf-order-meta span,.spider-pdf-customer span{overflow-wrap:anywhere}
    .spider-pdf-section-title,.spider-pdf-continuation{font-size:16px;font-weight:800;color:#168e70;margin:9px 0 6px;border-bottom:2px solid #dbeb9e;padding-bottom:3px}
    .spider-pdf-table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.94);table-layout:fixed;direction:inherit;font-size:12px}
    .spider-pdf-table th{background:#168e70;color:#fff;padding:7px 5px;text-align:center;font-weight:800}.spider-pdf-table td{border:1px solid #d8dfd5;padding:6px 5px;vertical-align:top;text-align:center;overflow-wrap:anywhere}.spider-pdf-table tr:nth-child(even){background:#f3f7e9}.spider-pdf-table th:nth-child(1){width:6%}.spider-pdf-table th:nth-child(2){width:42%;text-align:inherit}.spider-pdf-table th:nth-child(3){width:10%}.spider-pdf-table th:nth-child(4),.spider-pdf-table th:nth-child(5){width:21%}.spider-pdf-table .item-name{text-align:inherit;word-break:break-word}
    .spider-pdf-totals{margin-top:14px;margin-inline-start:auto;width:58%;background:rgba(255,255,255,.94);border:1px solid #dce3d1;border-radius:10px;padding:8px 12px}.spider-pdf-totals div{display:flex;justify-content:space-between;gap:10px;padding:4px 0}.spider-pdf-totals .grand{border-top:2px solid #168e70;margin-top:4px;padding-top:7px;font-size:17px;color:#168e70;font-weight:800}.spider-pdf-continuation{margin-top:8px}
  </style>`;
}

export async function generateOrderReceiptPdf(order, language = 'ar', options = {}) {
  if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error('PDF_LIBRARIES_NOT_READY');
  const items = receiptItems(order);
  const chunkSize = 10;
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) chunks.push(items.slice(index, index + chunkSize));
  if (!chunks.length) chunks.push([]);
  const root = document.createElement('div');
  root.className = 'spider-pdf-root';
  root.innerHTML = receiptStyles() + chunks.map((chunk, index) => receiptPageMarkup({ order, language, items: chunk, pageNumber: index + 1, pageCount: chunks.length })).join('');
  document.body.appendChild(root);
  try {
    await Promise.all([...root.querySelectorAll('img')].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })));
    const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pages = [...root.querySelectorAll('.spider-pdf-page')];
    for (let index = 0; index < pages.length; index += 1) {
      const canvas = await window.html2canvas(pages[index], { scale: 2.5, useCORS: true, backgroundColor: '#fbfbef', logging: false, width: 794, height: 1123 });
      if (index) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
    const orderKey = String(order.orderNumber || order.orderId || Date.now()).replace(/[^A-Za-z0-9_-]/g, '-');
    const filename = `SPIDER-ORDER-${orderKey}.pdf`;
    const blob = pdf.output('blob');
    if (options.asFile) return new File([blob], filename, { type: 'application/pdf' });
    if (options.download !== false) pdf.save(filename);
    return filename;
  } finally { root.remove(); }
}
