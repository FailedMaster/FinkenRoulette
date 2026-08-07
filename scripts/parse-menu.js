import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";
import { Parser } from "json2csv";

// Pass the API key explicitly from process.env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfPath = path.resolve(__dirname, "../data/raw/Bierkarte.pdf");
const csvOutputPath = path.resolve(
  __dirname,
  "../public/Bierkarte_dauerhaft.csv",
);

async function parseMenu() {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(
        `PDF file not found at ${pdfPath}. Run the fetch script first.`,
      );
    }

    console.log("Reading data/raw/Bierkarte.pdf...");
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");

    console.log("Extracting and cross-referencing beer data with Gemini...");

    const prompt = `
You are analyzing a German beer menu PDF ("Bierkarte").

### STEP 1: Quickfinder Index Scan
1. Focus first on pages 38 and 39 (the Quickfinder index).
2. Look at the legend in the top left of page 38 for visual color coding:
   - Identify which text/background color maps to "Fassbiere", "Dosenbiere", or "Flaschenbiere".
   - Map every beer entry on pages 38-39 to one of these three categories: "Fassbiere", "Dosenbiere", or "Flaschenbiere".
   - RULE: If an entry belongs to "Alkoholfreie Biere", assign its category as "Flaschenbiere".
3. Extract each beer listed in the Quickfinder along with its referenced page number (e.g., "Seite XX").

### STEP 2: Detail Page Cross-Referencing
For each beer found in the Quickfinder:
1. Navigate to the detail page specified by "Seite XX" in the PDF.
2. Match the beer entry by its exact name.
3. Extract additional details from that specific detail page to populate the missing fields.

### STEP 3: Formatting & Output Rules
- 'id': Assign sequential IDs starting from 'BD001', 'BD002', 'BD003', etc., in the exact order the beers appear in the Quickfinder index.
- 'name': The clean, exact name of the beer.
- 'category': Must be one of: "Fassbiere", "Dosenbiere", or "Flaschenbiere".
- 'page': The page reference string or integer found in the Quickfinder (e.g., "Seite 12" or 12).
- 'description': The full descriptive text found on the detail page for this beer.
- 'sizes': All available volumes for the beer, joined with a slash "/" (e.g., "0,33l/0,5l").
- 'prices': All corresponding prices in Euros without the € sign, joined with a slash "/" (e.g., "3,60/4,50"). Ensure correct 1:1 order relative to 'sizes'.
- 'alcoholfree': Integer 1 if the beer is alcohol-free (0,0%, non-alcoholic, or listed as Alkoholfrei), otherwise 0.
- 'glutenfree': Integer 1 if explicitly stated or tagged as gluten-free (glutenfrei), otherwise 0.
- 'hint': Any other extra information, special tags, badges, notes, or warnings found on either the index or detail page.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              page: { type: Type.STRING },
              description: { type: Type.STRING },
              sizes: { type: Type.STRING },
              prices: { type: Type.STRING },
              alcoholfree: { type: Type.INTEGER },
              glutenfree: { type: Type.INTEGER },
              hint: { type: Type.STRING },
            },
            required: [
              "id",
              "name",
              "category",
              "page",
              "description",
              "sizes",
              "prices",
              "alcoholfree",
              "glutenfree",
              "hint",
            ],
          },
        },
      },
    });

    const beers = JSON.parse(response.text);
    console.log(`Successfully parsed ${beers.length} beer entries.`);

    const fields = [
      "id",
      "name",
      "category",
      "page",
      "description",
      "sizes",
      "prices",
      "alcoholfree",
      "glutenfree",
      "hint",
    ];

    const json2csvParser = new Parser({ fields });
    const csvData = json2csvParser.parse(beers);

    const publicDir = path.dirname(csvOutputPath);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(csvOutputPath, csvData, "utf-8");
    console.log(`Saved output to ${csvOutputPath}`);
  } catch (err) {
    console.error("Parsing failed:", err.message);
  }
}

parseMenu();
