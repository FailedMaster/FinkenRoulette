import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { PDFDocument } from "pdf-lib";

const TOKEN = "8728592d-7efd-4f78-9c3e-c95969b02105";
const BASE_URL =
  "https://firebasestorage.googleapis.com/v0/b/finkenkrug-8582a.firebasestorage.app/o";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, "../data/raw");

async function downloadAndMergeBierkarte() {
  try {
    console.log("Fetching menu index from Firebase...");
    const listRes = await fetch(BASE_URL);
    if (!listRes.ok)
      throw new Error(`HTTP ${listRes.status} - ${listRes.statusText}`);

    const data = await listRes.json();

    // Filter items belonging to Bierkarte that end with .pdf
    const beerPages = data.items.filter(
      (item) =>
        item.name &&
        item.name.includes("menus/Bierkarte") &&
        item.name.toLowerCase().endsWith(".pdf"),
    );
    console.log(`Found ${beerPages.length} PDF page(s).`);

    // Extract page number and sort items numerically
    const sortedPages = beerPages
      .map((item) => {
        const rawFileName = item.name.split("/").pop() || "";
        const match = rawFileName.match(/page[_-]?(\d+)/i);
        const pageNum = match ? parseInt(match[1], 10) : Infinity;
        return { item, pageNum };
      })
      .sort((a, b) => a.pageNum - b.pageNum);

    // Create a new merged PDF document in memory
    const mergedPdf = await PDFDocument.create();

    for (const { item, pageNum } of sortedPages) {
      const encodedPath = item.name.replace(/\//g, "%2F");
      const mediaUrl = `${BASE_URL}/${encodedPath}?alt=media&token=${TOKEN}`;

      console.log(`Fetching page ${pageNum}...`);
      const pdfRes = await fetch(mediaUrl);

      if (!pdfRes.ok) {
        console.error(
          ` Failed to download ${item.name} (HTTP ${pdfRes.status})`,
        );
        continue;
      }

      const pdfBuffer = await pdfRes.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save single merged file as Bierkarte.pdf
    const mergedPdfBytes = await mergedPdf.save();
    const outputPath = path.join(outputDir, "Bierkarte.pdf");
    fs.writeFileSync(outputPath, Buffer.from(mergedPdfBytes));

    console.log(`\nSuccessfully saved combined PDF to data/raw/Bierkarte.pdf`);
  } catch (err) {
    console.error("Download and merge failed:", err.message);
  }
}

downloadAndMergeBierkarte();
