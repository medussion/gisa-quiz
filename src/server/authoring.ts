import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { questionProgress, questions } from '@/db/schema';
import { normalizeForDedupe, similarity } from '@/lib/grading';
import { validateQuestions, type RawQuestion, type ValidationIssue } from '@/lib/question-schema';

/**
 * 웹에서 추가한 문제는 DB에만 넣지 않고 JSON 파일에도 함께 쓴다.
 * 그래야 `npm run db:reset` 후 `questions:import` 로 되살아나고,
 * 기존 수집 파이프라인(JSON -> DB)과 어긋나지 않는다.
 */
const USER_FILE_REL = 'data/normalized/user-added.json';
const NORMALIZED_DIR = path.resolve('data/normalized');

/** 경로가 data/normalized 안에 있는지 확인한다 (임의 경로 쓰기 방지). */
function safeResolve(relPath: string): string {
  const abs = path.resolve(relPath);
  if (abs !== NORMALIZED_DIR && !abs.startsWith(NORMALIZED_DIR + path.sep)) {
    return path.resolve(USER_FILE_REL);
  }
  return abs;
}

function readJsonFile(relPath: string): RawQuestion[] {
  const abs = safeResolve(relPath);
  if (!fs.existsSync(abs)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonFile(relPath: string, list: RawQuestion[]) {
  const abs = safeResolve(relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(list, null, 2) + '\n', 'utf8');
}

const readUserFile = () => readJsonFile(USER_FILE_REL);
const writeUserFile = (list: RawQuestion[]) => writeJsonFile(USER_FILE_REL, list);

function idExists(id: string): boolean {
  if (db.select({ id: questions.id }).from(questions).where(eq(questions.id, id)).get()) return true;
  return readUserFile().some((q) => q.id === id);
}

/** past_exam이면 `2024-2-013`, 아니면 `user-0007` 형태로 만든다. */
export function generateId(input: { sourceType: string; year?: number | null; round?: number | null }): string {
  const make = (prefix: string, pad: number) => {
    for (let n = 1; n < 10_000; n++) {
      const candidate = `${prefix}${String(n).padStart(pad, '0')}`;
      if (!idExists(candidate)) return candidate;
    }
    return `${prefix}${Date.now()}`;
  };

  if (input.sourceType === 'past_exam' && input.year && input.round) {
    return make(`${input.year}-${input.round}-`, 3);
  }
  if (input.sourceType === 'generated') return make('gen-', 4);
  if (input.sourceType === 'sample') return make('sample-', 3);
  return make('user-', 4);
}

export interface CreateResult {
  ok: boolean;
  id?: string;
  issues?: ValidationIssue[];
  error?: string;
  /** 비슷한 문제가 이미 있으면 알려준다 (저장은 막지 않는다) */
  similar?: { id: string; question: string; score: number }[];
}

function findSimilar(text: string, excludeId: string) {
  const norm = normalizeForDedupe(text);
  if (!norm) return [];
  const rows = db
    .select({ id: questions.id, question: questions.question, normalizedText: questions.normalizedText })
    .from(questions)
    .all();

  return rows
    .filter((r) => r.id !== excludeId)
    .map((r) => ({
      id: r.id,
      question: r.question,
      score: Math.round(similarity(norm, r.normalizedText || r.question) * 1000) / 1000,
    }))
    .filter((r) => r.score >= 0.8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function createQuestion(input: Partial<RawQuestion>): CreateResult {
  const id = input.id?.trim() || generateId({ sourceType: input.sourceType ?? 'user', year: input.year, round: input.round });

  if (input.id?.trim() && idExists(id)) {
    return { ok: false, error: `이미 있는 id 입니다: ${id}` };
  }

  const candidate = { ...input, id } as RawQuestion;
  const res = validateQuestions([candidate]);
  const errors = res.issues.filter((i) => i.level === 'error');
  if (errors.length > 0 || res.valid.length === 0) {
    return { ok: false, issues: res.issues, error: '입력값을 확인하세요.' };
  }

  const q = res.valid[0];
  const normalizedText = normalizeForDedupe(`${q.question} ${q.code ?? ''} ${q.image ?? ''}`);
  const similar = findSimilar(`${q.question} ${q.code ?? ''}`, q.id);

  db.insert(questions)
    .values({
      id: q.id,
      sourceType: q.sourceType,
      sourceLabel: q.sourceLabel ?? '',
      sourceUrls: JSON.stringify(q.sourceUrls ?? []),
      year: q.year ?? null,
      round: q.round ?? null,
      category: q.category,
      subcategory: q.subcategory ?? null,
      questionType: q.questionType,
      question: q.question,
      code: q.code ?? null,
      codeLang: q.codeLang ?? null,
      image: q.image ?? null,
      answer: JSON.stringify(q.answer),
      acceptedAnswers: JSON.stringify(q.acceptedAnswers ?? []),
      choices: q.choices ? JSON.stringify(q.choices) : null,
      hint: q.hint ?? null,
      caseSensitive: q.caseSensitive ?? false,
      orderSensitive: q.orderSensitive ?? false,
      explanation: q.explanation ?? '',
      difficulty: q.difficulty ?? 3,
      verificationStatus: q.verificationStatus ?? 'unverified',
      verificationCount: q.verificationCount ?? 0,
      basedOn: q.basedOn ?? null,
      normalizedText,
      sourceFile: USER_FILE_REL,
      active: true,
      updatedAt: new Date().toISOString(),
    })
    .run();

  db.insert(questionProgress).values({ questionId: q.id }).onConflictDoNothing().run();

  const list = readUserFile();
  list.push(q);
  writeUserFile(list);

  return { ok: true, id: q.id, issues: res.issues.filter((i) => i.level === 'warn'), similar };
}

export function userAddedCount(): number {
  return readUserFile().length;
}

/** 폼의 "최근 추가" 목록용 — 웹에서 넣은 문제만 최신순으로 */
export function recentUserAdded(limit = 5) {
  return readUserFile()
    .slice(-limit)
    .reverse()
    .map((q) => ({ id: q.id, question: q.question, category: q.category }));
}

export interface UpdateResult {
  ok: boolean;
  id?: string;
  issues?: ValidationIssue[];
  error?: string;
  /** 원본 JSON 파일까지 고쳤으면 그 경로 */
  file?: string;
}

/**
 * 문제를 고친다.
 *
 * id는 바꾸지 않는다. id가 풀이 이력·오답노트·복습 주기를 묶는 열쇠라서
 * 바꾸면 지금까지 푼 기록이 끊긴다.
 *
 * DB만 고치면 다음 `questions:import` 때 JSON 원본으로 되돌아가므로
 * 그 문제가 들어 있던 파일도 함께 고친다.
 */
export function updateQuestion(id: string, input: Partial<RawQuestion>): UpdateResult {
  const existing = db.select().from(questions).where(eq(questions.id, id)).get();
  if (!existing) return { ok: false, error: '문제를 찾을 수 없습니다.' };

  const candidate = { ...input, id } as RawQuestion;
  const res = validateQuestions([candidate]);
  const errors = res.issues.filter((i) => i.level === 'error');
  if (errors.length > 0 || res.valid.length === 0) {
    return { ok: false, issues: res.issues, error: '입력값을 확인하세요.' };
  }

  const q = res.valid[0];
  const targetFile = existing.sourceFile ?? USER_FILE_REL;

  db.update(questions)
    .set({
      sourceType: q.sourceType,
      sourceLabel: q.sourceLabel ?? '',
      sourceUrls: JSON.stringify(q.sourceUrls ?? []),
      year: q.year ?? null,
      round: q.round ?? null,
      category: q.category,
      subcategory: q.subcategory ?? null,
      questionType: q.questionType,
      question: q.question,
      code: q.code ?? null,
      codeLang: q.codeLang ?? null,
      image: q.image ?? null,
      answer: JSON.stringify(q.answer),
      acceptedAnswers: JSON.stringify(q.acceptedAnswers ?? []),
      choices: q.choices ? JSON.stringify(q.choices) : null,
      hint: q.hint ?? null,
      caseSensitive: q.caseSensitive ?? false,
      orderSensitive: q.orderSensitive ?? false,
      explanation: q.explanation ?? '',
      difficulty: q.difficulty ?? 3,
      verificationStatus: q.verificationStatus ?? 'unverified',
      verificationCount: q.verificationCount ?? 0,
      basedOn: q.basedOn ?? null,
      normalizedText: normalizeForDedupe(`${q.question} ${q.code ?? ''} ${q.image ?? ''}`),
      sourceFile: targetFile,
      active: q.active ?? true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(questions.id, id))
    .run();

  const list = readJsonFile(targetFile);
  const idx = list.findIndex((item) => item.id === id);
  if (idx >= 0) list[idx] = q;
  else list.push(q); // 파일에 없던 문제면 새로 넣어 다음 import 때 유지되게 한다
  writeJsonFile(targetFile, list);

  return { ok: true, id, issues: res.issues.filter((i) => i.level === 'warn'), file: targetFile };
}

/** 수정 폼을 채우기 위한 원본 값 (정답·해설까지 포함) */
export function getQuestionForEdit(id: string) {
  const q = db.select().from(questions).where(eq(questions.id, id)).get();
  if (!q) return null;
  const arr = (v: string | null): string[] => {
    if (!v) return [];
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  };
  return {
    id: q.id,
    sourceType: q.sourceType,
    sourceLabel: q.sourceLabel,
    sourceUrls: arr(q.sourceUrls).join('\n'),
    year: q.year ? String(q.year) : '',
    round: q.round ? String(q.round) : '',
    category: q.category,
    subcategory: q.subcategory ?? '',
    questionType: q.questionType,
    question: q.question,
    code: q.code ?? '',
    codeLang: q.codeLang ?? '',
    answer: arr(q.answer).join('\n'),
    acceptedAnswers: arr(q.acceptedAnswers).join('\n'),
    choices: arr(q.choices).join('\n'),
    caseSensitive: q.caseSensitive,
    orderSensitive: q.orderSensitive,
    hint: q.hint ?? '',
    explanation: q.explanation,
    difficulty: String(q.difficulty),
    verificationStatus: q.verificationStatus,
    basedOn: q.basedOn ?? '',
    active: q.active,
    sourceFile: q.sourceFile ?? USER_FILE_REL,
  };
}
