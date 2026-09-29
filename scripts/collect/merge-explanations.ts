/**
 * 해설 묶음을 data/explanations.json 에 합친다.
 *
 *   npx tsx scripts/collect/merge-explanations.ts batch.json
 *
 * batch.json 은 { "문항id": "해설", ... } 형태다.
 * 이미 있는 id 는 덮어쓴다.
 */
import fs from 'node:fs';

const TARGET = 'data/explanations.json';

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('합칠 JSON 파일을 지정하세요.');
    process.exit(1);
  }

  const batch = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
  const doc = JSON.parse(fs.readFileSync(TARGET, 'utf8')) as {
    _readme?: string[];
    explanations: Record<string, string>;
  };

  const before = Object.keys(doc.explanations).length;
  let added = 0;
  let updated = 0;

  for (const [id, text] of Object.entries(batch)) {
    if (!text?.trim()) continue;
    if (doc.explanations[id]) updated++;
    else added++;
    doc.explanations[id] = text.trim();
  }

  doc.explanations = Object.fromEntries(
    Object.entries(doc.explanations).sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.writeFileSync(TARGET, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  const after = Object.keys(doc.explanations).length;
  console.log(`해설 ${before} -> ${after}건 (새로 ${added}, 갱신 ${updated})`);
}

main();
