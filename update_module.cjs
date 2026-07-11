const f = require("fs");
let c = f.readFileSync("src/app/modules/[id]/page.tsx", "utf-8");

// Add KnowledgeContent import
c = c.replace(
  'import FormulaCard from "@/components/FormulaCard";',
  'import FormulaCard from "@/components/FormulaCard";\nimport KnowledgeContent from "@/components/KnowledgeContent";'
);

// Replace MathContent with KnowledgeContent for unit content
c = c.replace(
  '<MathContent text={unitContent.content} />',
  '<KnowledgeContent text={unitContent.content} />'
);

f.writeFileSync("src/app/modules/[id]/page.tsx", c, "utf-8");
console.log("Updated module page for KnowledgeContent");
