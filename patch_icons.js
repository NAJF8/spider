const fs = require('fs');
let js = fs.readFileSync('public/script.js', 'utf8');

const mappingStr = `
const CUSTOM_ICONS = {
  'cat-storage': 'assets/icon_1.png',
  'cat-ram': 'assets/icon_2.png',
  'cat-printers': 'assets/icon_3.png',
  'cat-power': 'assets/icon_4.png',
  'cat-psu': 'assets/icon_4.png',
  'cat-network': 'assets/icon_5.png',
  'cat-monitors': 'assets/icon_6.png',
  'cat-motherboards': 'assets/icon_7.png',
  'cat-cpus': 'assets/icon_8.png',
  'cat-cases': 'assets/icon_9.png'
};
`;

js = js.replace('const FALLBACK_IMAGES = {', mappingStr + '\nconst FALLBACK_IMAGES = {');

js = js.replace(
  'const imgSrc = cat.image || categoryFallback(cat);',
  'const imgSrc = CUSTOM_ICONS[cat.id] || cat.image || categoryFallback(cat);'
);

const oldSidebarLogic = `const imgHtml = cat.image
        ? \`<img class="cat-icon" src="\${esc(cat.image)}" alt="">\`
        : \`<i class="fa-solid \${esc(cat.icon || 'fa-folder')}"></i>\`;`;

const newSidebarLogic = `const customImg = CUSTOM_ICONS[cat.id] || cat.image;
      const imgHtml = customImg
        ? \`<img class="cat-icon" src="\${esc(customImg)}" alt="">\`
        : \`<i class="fa-solid \${esc(cat.icon || 'fa-folder')}"></i>\`;`;

js = js.replace(oldSidebarLogic, newSidebarLogic);

fs.writeFileSync('public/script.js', js);
console.log('script.js patched successfully!');
