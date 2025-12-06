#!/usr/bin/env node

/**
 * Manual test for the Gemini Image MCP
 * Usage: GEMINI_API_KEY=your_key node test-manual.js "your prompt"
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY environment variable required");
  console.error("Usage: GEMINI_API_KEY=your_key node test-manual.js \"prompt\"");
  process.exit(1);
}

const prompt = process.argv[2] || "A cute robot holding a banana";
console.log(`Generating image for: "${prompt}"`);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp-image-generation",
  generationConfig: {
    responseModalities: ["image", "text"],
  },
});

async function main() {
  try {
    const result = await model.generateContent([{ text: prompt }]);
    const response = result.response;
    
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No response generated");
    }

    const content = candidates[0].content;
    for (const part of content.parts) {
      if (part.inlineData) {
        const outputPath = "test-output.png";
        fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, "base64"));
        console.log(`✓ Image saved to: ${outputPath}`);
        console.log(`  MIME type: ${part.inlineData.mimeType}`);
      }
      if (part.text) {
        console.log(`  Model text: ${part.text}`);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
