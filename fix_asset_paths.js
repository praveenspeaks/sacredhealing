const fs = require('fs');

let content = fs.readFileSync('service.html', 'utf8');

// Fix hrefs
content = content.replace(/href="assets\//g, 'href="/assets/');
content = content.replace(/href="style\.css"/g, 'href="/style.css"');

// Fix srcs
content = content.replace(/src="assets\//g, 'src="/assets/');
content = content.replace(/src="script\.js"/g, 'src="/script.js"');
content = content.replace(/src="cms_frontend\.js"/g, 'src="/cms_frontend.js"');

fs.writeFileSync('service.html', content);
console.log("Fixed service.html assets.");
