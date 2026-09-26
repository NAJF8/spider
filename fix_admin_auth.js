const fs = require('fs');
let f = fs.readFileSync('public/admin.js', 'utf8');

const target = `            try {
                // Check admins
                const adminRef = ref(db, \`admins/\${user.uid}\`);
                let adminSnap = await get(adminRef);
                
                if (!adminSnap.exists() || !isAdminActive(adminSnap.val())) {
                    // Check pending admins securely on the server
                    if (user.email) {
                        try {
                            const token = await user.getIdToken();
                            const claimRes = await fetch(\`\${SPIDER_BACKEND_ENDPOINT}/api/admin/claim-pending\`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': \`Bearer \${token}\`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (claimRes.ok) {
                                const claimData = await claimRes.json();
                                if (claimData.linked || claimData.alreadyAdmin) {
                                    adminSnap = await get(adminRef); // Re-read
                                }
                            }
                        } catch (err) {
                            console.error("Error claiming pending admin", err);
                        }
                    }
                }

                if (adminSnap.exists() && isAdminActive(adminSnap.val())) {
                    currentAdminData = adminSnap.val();
                    isAuthorized = true;
                    role = currentAdminData.role || 'مشرف';
                    roleIcon = '<i class="fa-solid fa-shield-halved"></i>';
                    window.currentAdminPermissions = currentAdminData.permissions || {};
                }
            } catch (e) {
                console.error("Auth check failed", e);
            }`;

const replacement = `            try {
                console.log("[ADMIN AUTH] user: exists");
                console.log("[ADMIN AUTH] uid:", user.uid);
                console.log("[ADMIN AUTH] email:", user.email);

                // Check admins
                const adminRef = ref(db, \`admins/\${user.uid}\`);
                let adminSnap = await get(adminRef);
                
                console.log("[ADMIN AUTH] admin record initial read:", adminSnap.exists() ? adminSnap.val() : null);

                if (!adminSnap.exists() || !isAdminActive(adminSnap.val())) {
                    // Check pending admins securely on the server
                    if (user.email) {
                        try {
                            const token = await user.getIdToken();
                            const claimRes = await fetch(\`\${SPIDER_BACKEND_ENDPOINT}/api/admin/claim-pending\`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': \`Bearer \${token}\`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (claimRes.ok) {
                                const claimData = await claimRes.json();
                                console.log("[ADMIN AUTH] pending claim response:", claimData);
                                if (claimData.linked || claimData.alreadyAdmin) {
                                    adminSnap = await get(adminRef); // Re-read
                                    console.log("[ADMIN AUTH] admin record re-read:", adminSnap.exists() ? adminSnap.val() : null);
                                }
                            } else {
                                console.log("[ADMIN AUTH] pending claim failed with status:", claimRes.status);
                            }
                        } catch (err) {
                            console.error("Error claiming pending admin", err);
                        }
                    }
                }

                console.log("[ADMIN AUTH] active check:", adminSnap.exists() ? isAdminActive(adminSnap.val()) : false);

                if (adminSnap.exists() && isAdminActive(adminSnap.val())) {
                    currentAdminData = adminSnap.val();
                    isAuthorized = true;
                    role = currentAdminData.role || 'مشرف';
                    roleIcon = '<i class="fa-solid fa-shield-halved"></i>';
                    window.currentAdminPermissions = currentAdminData.permissions || {};
                    console.log("[ADMIN AUTH] permissions:", window.currentAdminPermissions);
                    console.log("[ADMIN AUTH] opening dashboard");
                }
            } catch (e) {
                console.error("Auth check failed", e);
            }`;

f = f.replace(target, replacement);
fs.writeFileSync('public/admin.js', f);
