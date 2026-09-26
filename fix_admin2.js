const fs = require('fs');
let f = fs.readFileSync('public/admin.js', 'utf8');
f = f.replace(/function isAdminActive\(record\) \{[\s\S]*?\}/, `function isAdminActive(admin) {
    if (!admin) return false;
    if (admin.status === 'disabled') return false;
    if (admin.active === false) return false;
    if (admin.enabled === false) return false;
  
    return (
      admin.status === 'active' ||
      admin.active === true ||
      admin.enabled === true
    );
}`);
fs.writeFileSync('public/admin.js', f);
