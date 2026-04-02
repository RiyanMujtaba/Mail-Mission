require('dotenv').config();
var k = process.env.GEMINI_API_KEY;
console.log('GEMINI key exists:', !!k);
console.log('Starts with:', k ? k.slice(0, 8) : 'MISSING');
