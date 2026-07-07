// Impression reseau via le protocole Star WebPRNT (imprimantes Star
// Micronics avec module LAN/WiFi). Le ticket est un document XML envoye en
// POST directement depuis le navigateur/l'app vers l'adresse IP locale de
// l'imprimante - pas de backend implique, l'appareil doit etre sur le meme
// reseau local que l'imprimante.
//
// Note: le format XML ci-dessous suit la structure documentee du
// protocole StarWebPRNT (namespace star-m.jp/service/2009/09/webprnt).
// A verifier/ajuster avec le SDK officiel Star une fois une imprimante
// physique disponible pour tester - certains details (noms d'attributs
// exacts) peuvent varier selon le modele/firmware.
const WEBPRNT_NS = 'http://www.star-m.jp/service/2009/09/webprnt';

function escapeXml(str) {
  return String(str ?? '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function wrapDocument(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<request xmlns="${WEBPRNT_NS}">
<appInfo>RestoLab</appInfo>
<printObject>
${bodyXml}
<cutPaper print.feed="true"/>
</printObject>
</request>`;
}

function line(text, opts = {}) {
  const { bold = false, align = 'left', width = 1, height = 1 } = opts;
  return `<style print.bold="${bold}" print.alignment="${align}" print.width="${width}" print.height="${height}"/>` +
    `<text>${escapeXml(text)}&#10;</text>`;
}

function blank(count = 1) {
  return `<text>${'&#10;'.repeat(count)}</text>`;
}

async function sendToPrinter(ip, xml) {
  if (!ip) throw new Error('Aucune imprimante configurée');
  const res = await fetch(`http://${ip}/StarWebPRNT/SendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: xml,
  });
  if (!res.ok) throw new Error(`Imprimante injoignable (${res.status})`);
}

const orderTypeLabels = { dine_in: 'Sur place', takeaway: 'Emporter', delivery: 'Livraison' };

export async function printKitchenTicket(ip, order, items) {
  const parts = [
    line(order.customer_name || `Table ${order.table_number || ''}`, { bold: true, align: 'center', width: 2, height: 2 }),
    line(orderTypeLabels[order.order_type] || order.order_type, { align: 'center' }),
    blank(1),
    line(new Date().toLocaleString('fr-FR')),
    line('--------------------------------'),
  ];
  for (const item of items || []) {
    parts.push(line(`${item.quantity}x ${item.product_name}`, { bold: true }));
    if (item.notes) parts.push(line(`  ${item.notes}`));
  }
  parts.push(line('--------------------------------'));
  await sendToPrinter(ip, wrapDocument(parts.join('\n')));
}

export async function printReceipt(ip, order, items, paymentMethod) {
  const methodLabels = { cash: 'Espèces', card: 'Carte', meal_voucher: 'Ticket resto' };
  const parts = [
    line(order.business_name || 'RestoLab', { bold: true, align: 'center', width: 2, height: 2 }),
    blank(1),
    line(`Commande ${order.order_number}`),
    line(new Date().toLocaleString('fr-FR')),
    line('--------------------------------'),
  ];
  for (const item of items || []) {
    parts.push(line(`${item.quantity}x ${item.product_name}`));
    parts.push(line(`  ${parseFloat(item.total_price).toFixed(2)} €`, { align: 'right' }));
  }
  parts.push(line('--------------------------------'));
  parts.push(line(`Total : ${parseFloat(order.total).toFixed(2)} €`, { bold: true, width: 2 }));
  parts.push(line(`Payé par : ${methodLabels[paymentMethod] || paymentMethod}`));
  parts.push(blank(1));
  parts.push(line('Merci de votre visite !', { align: 'center' }));
  await sendToPrinter(ip, wrapDocument(parts.join('\n')));
}

export async function testPrint(ip) {
  const xml = wrapDocument([
    line('RestoLab', { bold: true, align: 'center', width: 2, height: 2 }),
    line('Test d\'impression', { align: 'center' }),
    line(new Date().toLocaleString('fr-FR'), { align: 'center' }),
  ].join('\n'));
  await sendToPrinter(ip, xml);
}
