require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const list = await genAI.listModels();
  for await (const m of list) {
    if (m.supportedGenerationMethods?.includes('generateContent')) {
      console.log(m.name);
    }
  }
}
run().catch(console.error);
