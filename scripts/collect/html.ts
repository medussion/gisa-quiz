/** 수집한 HTML을 텍스트로 바꾸는 최소한의 도구 (외부 파서 의존성 없이) */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  middot: '·',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  // 기출 본문과 정답에 실제로 나오는 기호들.
  // C 코드의 `&a;` `&ptr;` 같은 표기는 여기에 없으므로 그대로 남는다.
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  divide: '÷',
  times: '×',
  plusmn: '±',
  le: '≤',
  ge: '≥',
  ne: '≠',
  infin: '∞',
  deg: '°',
  bull: '•',
  sup2: '²',
  sup3: '³',
  frac12: '½',
  pi: 'π',
  sigma: 'σ',
  cap: '∩',
  cup: '∪',
  isin: '∈',
  sube: '⊆',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** <table> 을 읽을 수 있는 텍스트 표로 바꾼다 (기출에 테이블이 자주 나온다) */
export function tableToText(tableHtml: string): string {
  const rows: string[][] = [];
  for (const rowMatch of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(t[hd])[^>]*>([\s\S]*?)<\/\1>/gi)) {
      cells.push(stripTags(cellMatch[2]).replace(/\s+/g, ' ').trim());
    }
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return '';

  const cols = Math.max(...rows.map((r) => r.length));
  const width: number[] = [];
  for (let c = 0; c < cols; c++) {
    width[c] = Math.max(...rows.map((r) => displayWidth(r[c] ?? '')));
  }

  const line = (cells: string[]) =>
    '| ' + Array.from({ length: cols }, (_, c) => pad(cells[c] ?? '', width[c])).join(' | ') + ' |';

  const out = [line(rows[0]), '|' + width.map((w) => '-'.repeat(w + 2)).join('|') + '|'];
  for (const r of rows.slice(1)) out.push(line(r));
  return out.join('\n');
}

/** 한글은 두 칸을 차지하므로 표 정렬에 반영한다 */
function displayWidth(s: string): number {
  let n = 0;
  for (const ch of s) n += /[ᄀ-ᇿ㄰-㆏가-힣！-｠]/.test(ch) ? 2 : 1;
  return n;
}

function pad(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - displayWidth(s)));
}

export function stripTags(input: string): string {
  return decodeEntities(
    input
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

/** <pre> 안의 내용을 원문 그대로 살리되 표만 텍스트로 바꾼다 */
export function preToText(input: string): string {
  let s = input.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (m) => '\n' + tableToText(m) + '\n');
  s = s.replace(/<pre[^>]*>|<\/pre>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  return decodeEntities(s).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

export function collapse(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
