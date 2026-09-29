/**
 * 1단계: 공개된 기출/복원 페이지를 그대로 내려받아 data/raw/<연도>/ 에 보관한다.
 *
 * - 공개 접근 가능한 페이지만 받는다. 로그인·유료벽을 건드리지 않는다.
 * - robots.txt 가 막은 경로(/comment/, /question/delete, /question/example)는 받지 않는다.
 * - 회차 목록은 사이트의 시험 색인 페이지에서 직접 읽는다(회차가 늘면 자동으로 따라간다).
 * - 이미 받아둔 파일은 다시 받지 않는다 (--force 로 강제).
 * - 서버 부담을 줄이려고 요청 사이에 쉰다.
 *
 * 사용법:
 *   npx tsx scripts/collect/fetch-newbt.ts             # 색인에 있는 회차 전부
 *   npx tsx scripts/collect/fetch-newbt.ts 2024        # 2024년만
 *   npx tsx scripts/collect/fetch-newbt.ts 2024 2      # 2024년 2회만
 *   npx tsx scripts/collect/fetch-newbt.ts --force
 */
import fs from 'node:fs';
import path from 'node:path';

const HOST = 'https://newbt.kr';
const INDEX_PATH = `/${encodeURIComponent('시험')}/${encodeURIComponent('정보처리기사 실기')}`;
const INDEX_RAW = 'data/raw/newbt-index.html';
const DELAY_MS = 1500;
const UA = 'gisa-quiz personal study collector (single user, low volume)';

export interface RoundLink {
  year: number;
  round: number;
  href: string;
  url: string;
}

export function rawPath(year: number, round: number): string {
  return path.join('data/raw', String(year), `newbt-${year}-${round}.html`);
}

/** 색인 HTML에서 회차 링크를 뽑는다. */
export function extractRoundLinks(indexHtml: string): RoundLink[] {
  const found = new Map<string, RoundLink>();
  const hrefs = indexHtml.matchAll(/href=["']([^"']+)["']/g);

  for (const m of hrefs) {
    const href = m[1];
    let decoded: string;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      continue;
    }
    if (!decoded.includes('/시험/정보처리기사 실기/')) continue;

    const rm = decoded.match(/(\d{4})년\s*\+?\s*(\d)회/);
    if (!rm) continue;

    const year = Number(rm[1]);
    const round = Number(rm[2]);
    const key = `${year}-${round}`;
    if (found.has(key)) continue;

    found.set(key, { year, round, href, url: href.startsWith('http') ? href : HOST + href });
  }

  return [...found.values()].sort((a, b) => b.year - a.year || b.round - a.round);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    console.log(`  HTTP ${res.status} — ${url}`);
    return null;
  }
  return res.text();
}

function writeWithProvenance(out: string, html: string, url: string) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
  fs.writeFileSync(
    out.replace(/\.html$/, '.source.json'),
    JSON.stringify({ url, fetchedAt: new Date().toISOString(), bytes: html.length }, null, 2) + '\n',
    'utf8',
  );
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);

  console.log('회차 목록을 읽는 중…');
  const indexHtml = await get(HOST + INDEX_PATH);
  if (!indexHtml) {
    console.error('색인 페이지를 읽지 못했습니다.');
    process.exit(1);
  }
  writeWithProvenance(INDEX_RAW, indexHtml, HOST + INDEX_PATH);

  let links = extractRoundLinks(indexHtml);
  console.log(`색인에서 ${links.length}개 회차를 찾았습니다 (${links.at(-1)?.year}년 ~ ${links[0]?.year}년)\n`);

  if (nums.length === 2) links = links.filter((l) => l.year === nums[0] && l.round === nums[1]);
  else if (nums.length === 1) links = links.filter((l) => l.year === nums[0]);

  let fetched = 0;
  let skipped = 0;

  for (const link of links) {
    const out = rawPath(link.year, link.round);
    if (!force && fs.existsSync(out)) {
      skipped++;
      continue;
    }
    await sleep(DELAY_MS);
    const html = await get(link.url);
    if (!html) continue;
    writeWithProvenance(out, html, link.url);
    console.log(`  받음  ${link.year}년 ${link.round}회 — ${(html.length / 1024).toFixed(0)}KB`);
    fetched++;
  }

  console.log(`\n받음 ${fetched}건 · 이미 있어 건너뜀 ${skipped}건`);
}

main();
