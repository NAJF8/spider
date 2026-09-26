const fs = require('fs');
let rules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));
const r = rules.rules;

const isAdmin = "auth != null && auth.uid === 'e8uTdYi5TQOsrztxPnlD7X4GKAx1'";
const hasPerm = (perm) => `(auth != null && root.child('admins/'+auth.uid+'/permissions/'+'${perm}').val() === true)`;

const canWrite = (perm) => `${isAdmin} || ${hasPerm(perm)}`;
const canReadWrite = (perm) => ({ '.read': `auth != null && (${isAdmin} || ${hasPerm(perm)})`, '.write': canWrite(perm) });

r.products = {
  '.read': true,
  '$productId': {
    '.write': `${isAdmin} || (!data.exists() && ${hasPerm('products_add')}) || (data.exists() && newData.exists() && ${hasPerm('products_edit')}) || (data.exists() && !newData.exists() && ${hasPerm('products_delete')})`
  }
};

r.private_prices = canReadWrite('special_prices'); 
r.categories = { '.read': true, '.write': canWrite('categories') };
r.offers = { '.read': true, '.write': canWrite('categories') };
r.settings = { '.read': true, '.write': canWrite('store_settings') };
r.users = canReadWrite('customers');
r.profiles = canReadWrite('customers');
r.pricing_identities = canReadWrite('pricing_customers');
r.auditLogs = canReadWrite('audit_logs');
r.reports = canReadWrite('reports');

r.admins = {
  '.read': `${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')}`,
  '$uid': {
    '.read': `auth != null && (auth.uid === $uid || ${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')})`,
    '.write': `${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')}`
  }
};

r.pending_admins = {
  '.read': `${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')}`,
  '$emailKey': {
    '.read': `auth != null && (auth.token.email.replace('.', ',') === $emailKey || ${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')})`,
    '.write': `${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')}`
  }
};

r.orders['.read'] = `${isAdmin} || ${hasPerm('orders')}`;
r.orders['$orderId']['.write'] = `${isAdmin} || ${hasPerm('orders')}`;

fs.writeFileSync('database.rules.json', JSON.stringify(rules, null, 2));
console.log('Rules updated successfully');
