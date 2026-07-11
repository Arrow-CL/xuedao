const fs = require("fs");
const path = require("path");
const zipfile = (await import("node:zipfile")).default;
// Actually, use the built-in zlib
const XMLParser = require("xml2js").DOMParser || null;

// No xml2js available. Use basic regex approach.
const PAPERS = "src/data/gaokao-papers";
const OUT = "public/gaokao-images";

function getRels(zip, items) {
  // Parse rels to map rId -> filename
  const relsXml = zip.readFileSync("word/_rels/document.xml.rels").toString("utf-8");
  const relMap = {};
  const relMatches = relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g);
  for (const m of relMatches) {
    relMap[m[1]] = m[2];
  }
  return relMap;
}

function getDocxImages(docxPath, paperId) {
  const zip = new (require("adm-zip"))(docxPath);
  const entries = zip.getEntries();
  
  // Get rels map
  const relsEntry = entries.find(e => e.entryName === "word/_rels/document.xml.rels");
  if (!relsEntry) return [];
  const relsXml = relsEntry.getData().toString("utf-8");
  const relMap = {};
  const relMatches = [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g)];
  for (const m of relMatches) {
    relMap[m[1]] = m[2];
  }
  
  // Get document XML
  const docEntry = entries.find(e => e.entryName === "word/document.xml");
  if (!docEntry) return [];
  const docXml = docEntry.getData().toString("utf-8");
  
  // Find all paragraphs with their text and images
  const paragraphs = [];
  const pMatches = [...docXml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)];
  
  let lastQNum = 0;
  
  for (const pMatch of pMatches) {
    const pXml = pMatch[0];
    
    // Get paragraph text
    const textMatches = [...pXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
    const pText = textMatches.map(m => m[1]).join("");
    
    // Check for question number at start
    const qMatch = pText.match(/^(\d+)[\.\s]/);
    if (qMatch) lastQNum = parseInt(qMatch[1]);
    
    // Check for images
    const imgMatches = [...pXml.matchAll(/r:embed="([^"]+)"/g)];
    for (const imgMatch of imgMatches) {
      const rId = imgMatch[1];
      const imgFile = relMap[rId];
      if (imgFile && imgFile.startsWith("media/") && imgFile.endsWith(".png")) {
        const imgEntry = entries.find(e => e.entryName === "word/" + imgFile);
        if (imgEntry) {
          const data = imgEntry.getData();
          const ext = path.extname(imgFile);
          const outName = paperId + "_q" + lastQNum + "_" + imgFile.replace("media/", "");
          const outPath = path.join(OUT, outName);
          if (!fs.existsSync(outPath)) {
            fs.writeFileSync(outPath, data);
          }
          paragraphs.push({ q: lastQNum, outName, text: pText.slice(0, 60) });
        }
      }
    }
  }
  
  return paragraphs;
}

// Process all DOCX files
const docxFiles = [];
function walk(d) {
  for (const i of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, i.name);
    if (i.isDirectory()) walk(fp);
    else if (i.name.endsWith(".docx")) docxFiles.push(fp);
  }
}
walk(PAPERS);

console.log("Found " + docxFiles.length + " DOCX files");
console.log("Note: adm-zip may not be installed. Checking images directly from DOCX...");

// Simple test: extract one image from one DOCX to verify the approach works
const testDocx = docxFiles[0];
if (testDocx) {
  try {
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(testDocx);
    
    // Just extract all media files
    const entries = zip.getEntries();
    const mediaEntries = entries.filter(e => e.entryName.startsWith("word/media/"));
    if (mediaEntries.length > 0) {
      const paperId = path.basename(testDocx, ".docx").slice(0, 15);
      const img = mediaEntries[0];
      const data = img.getData();
      const outName = paperId + "_" + path.basename(img.entryName);
      fs.writeFileSync(path.join(OUT, outName), data);
      console.log("Test: extracted " + outName + " (" + data.length + " bytes)");
    }
    console.log("Found " + mediaEntries.length + " media files in test DOCX");
  } catch (e) {
    console.log("adm-zip not available: " + e.message);
    console.log("Trying built-in zip...");
  }
}

console.log("Done. Run: npm install adm-zip && node extract_images.cjs");
