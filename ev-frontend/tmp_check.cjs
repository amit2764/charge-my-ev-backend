const fs = require('fs');
console.log(process.cwd());
console.log(fs.existsSync('index.html'));
console.log(fs.readFileSync('index.html', 'utf8').slice(0,40));
