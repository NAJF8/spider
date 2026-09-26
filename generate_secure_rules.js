const fs = require('fs');
let rules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));
const r = rules.rules;

const SUPER_ADMIN = "'e8uTdYi5TQOsrztxPnlD7X4GKAx1'";
const isAdmin = `(auth != null && auth.uid === ${SUPER_ADMIN})`;
const hasPerm = (perm) => `(auth != null && root.child('admins/'+auth.uid+'/permissions/'+'${perm}').val() === true)`;

// Admin checks
r.admins = {
  ".read": `${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')}`,
  "$uid": {
    ".read": `auth != null && (auth.uid === $uid || auth.uid === ${SUPER_ADMIN} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')})`,
    
    // Write access
    ".write": `auth != null && (${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')})`,
    
    // Protect Super Admin UID from being modified or deleted by anyone except Super Admin themselves (and even then, we can just block it entirely)
    ".validate": `$uid !== ${SUPER_ADMIN}`,
    
    "role": {
      // Users cannot change their own role. Only Super Admin or someone with manage_permissions can change roles of OTHERS.
      ".validate": `(data.val() === newData.val()) || (${isAdmin} && auth.uid !== $uid && newData.val() !== 'Super Admin') || (${hasPerm('manage_permissions')} && auth.uid !== $uid && newData.val() !== 'Super Admin') || (!data.exists() && newData.val() !== 'Super Admin')`
    },
    "permissions": {
      // Users cannot change their own permissions. Only Super Admin or someone with manage_permissions can change permissions of OTHERS.
      ".validate": `(data.val() === newData.val()) || (${isAdmin} && auth.uid !== $uid) || (${hasPerm('manage_permissions')} && auth.uid !== $uid)`,
      "$permId": {
        // Cannot grant a permission you don't have, unless Super Admin
        ".validate": `${isAdmin} || root.child('admins/'+auth.uid+'/permissions/'+$permId).val() === true`
      }
    }
  }
};

// Pending Admins (Fixed email matching logic using base64 key and email child check)
r.pending_admins = {
  ".read": `${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')}`,
  "$key": {
    ".read": `auth != null && (data.child('email').val() === auth.token.email || ${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')})`,
    ".write": `${isAdmin} || ${hasPerm('manage_staff')} || ${hasPerm('manage_permissions')}`
  }
};

// Profiles (Customer owns their profile, cannot escalate)
r.profiles = {
  ".read": `${isAdmin} || ${hasPerm('customers')}`,
  "$uid": {
    ".read": `auth != null && (auth.uid === $uid || ${isAdmin} || ${hasPerm('customers')})`,
    ".write": `auth != null && (auth.uid === $uid || ${isAdmin} || ${hasPerm('customers')})`,
    
    // Protect sensitive fields from being changed by the user themselves
    "role": { ".validate": `auth.uid !== $uid || (data.val() === newData.val()) || !newData.exists()` },
    "permissions": { ".validate": `auth.uid !== $uid || (data.val() === newData.val()) || !newData.exists()` },
    "pricing_tier": { ".validate": `auth.uid !== $uid || (data.val() === newData.val()) || !newData.exists()` },
    "accountType": { ".validate": `auth.uid !== $uid || (data.val() === newData.val()) || !newData.exists()` },
    "uid": { ".validate": `auth.uid !== $uid || (data.val() === newData.val()) || !newData.exists()` }
  }
};

// Profile Credentials (Strictly isolated)
r.profile_credentials = {
  ".read": false, // No client can read this
  "$uid": {
    // Only the user themselves can write (e.g. to set their PIN hash) or the backend
    ".write": `auth != null && auth.uid === $uid`
  }
};

// Also apply proper restrictions on `users` if it's identical to profiles
if(r.users) {
  r.users = JSON.parse(JSON.stringify(r.profiles));
}

fs.writeFileSync('database.rules.json', JSON.stringify(rules, null, 2));
console.log('database.rules.json has been updated with security fixes.');
