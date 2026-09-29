'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, QuestionBody, QuestionMeta } from '@/components/QuestionBody';
import { CATEGORIES, QUESTION_TYPES, SOURCE_TYPES, VERIFICATION_STATUSES, sourceBadge } from '@/lib/constants';
import type { QuestionDTO } from '@/lib/types';

interface Issue {
  id: string;
  level: 'error' | 'warn';
  message: string;
}

interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
  issues?: Issue[];
  similar?: { id: string; question: string; score: number }[];
  /** 수정 시 같이 고친 JSON 파일 */
  file?: string;
}

const EMPTY = {
  id: '',
  sourceType: 'user',
  sourceLabel: '',
  sourceUrls: '',
  year: '',
  round: '',
  category: 'programming_language',
  subcategory: '',
  questionType: 'short_answer',
  question: '',
  code: '',
  codeLang: '',
  answer: '',
  acceptedAnswers: '',
  choices: '',
  caseSensitive: false,
  orderSensitive: false,
  hint: '',
  explanation: '',
  difficulty: '3',
  verificationStatus: 'unverified',
  basedOn: '',
  active: true,
};

export type QuestionFormValues = typeof EMPTY;
type Form = QuestionFormValues;

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className="text-[12.5px] font-semibold">{children}</span>
      {hint && (
        <span className="ml-1.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

interface Props {
  mode?: 'create' | 'edit';
  /** 수정 모드일 때 채워 넣을 원래 값 */
  initial?: Partial<Form>;
  /** 수정 모드일 때 대상 문제 id */
  questionId?: string;
  /** 수정 모드일 때 이 문제가 들어 있는 JSON 파일 */
  sourceFile?: string;
  recent?: { id: string; question: string; category: string }[];
}

export default function QuestionForm({
  mode = 'create',
  initial,
  questionId,
  sourceFile,
  recent = [],
}: Props) {
  const isEdit = mode === 'edit';
  const router = useRouter();
  const [f, setF] = useState<Form>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [added, setAdded] = useState<{ id: string; question: string }[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  };

  const isPastExam = f.sourceType === 'past_exam';
  const isChoice = f.questionType === 'multiple_choice';
  const answerLines = f.answer.split('\n').map((s) => s.trim()).filter(Boolean);

  const preview: QuestionDTO = {
    id: f.id || '(자동 생성)',
    sourceType: f.sourceType,
    sourceLabel: f.sourceLabel,
    sourceUrls: [],
    year: f.year ? Number(f.year) : null,
    round: f.round ? Number(f.round) : null,
    category: f.category,
    subcategory: f.subcategory || null,
    questionType: f.questionType,
    question: f.question || '(문제 본문)',
    code: f.code || null,
    codeLang: f.codeLang || null,
    image: null,
    choices: isChoice ? f.choices.split('\n').map((s) => s.trim()).filter(Boolean) : null,
    difficulty: Number(f.difficulty) || 3,
    verificationStatus: f.verificationStatus,
    badge: sourceBadge(f.sourceType, f.verificationStatus),
  };

  const submit = async (keepGoing: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/questions/${questionId}` : '/api/questions', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const data: SaveResult = await res.json();
      setResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (isEdit && data.ok) {
        router.refresh();
        return;
      }
      if (data.ok && data.id) {
        setAdded((a) => [{ id: data.id!, question: f.question }, ...a]);
        if (keepGoing) {
          // 같은 회차/영역을 연속으로 넣는 경우가 많아 메타 정보는 남겨둔다.
          setF((prev) => ({
            ...EMPTY,
            sourceType: prev.sourceType,
            sourceLabel: prev.sourceLabel,
            sourceUrls: prev.sourceUrls,
            year: prev.year,
            round: prev.round,
            category: prev.category,
            questionType: prev.questionType,
            difficulty: prev.difficulty,
            verificationStatus: prev.verificationStatus,
          }));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch {
      setResult({ ok: false, error: '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const errors = result?.issues?.filter((i) => i.level === 'error') ?? [];
  const warns = result?.issues?.filter((i) => i.level === 'warn') ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-[17px] font-bold">{isEdit ? '문제 수정' : '문제 추가'}</h1>
        <Link
          href={isEdit ? `/questions/${questionId}` : '/questions'}
          className="text-[13px]"
          style={{ color: 'var(--text-dim)' }}
        >
          {isEdit ? '취소' : '문제 목록'}
        </Link>
      </div>

      {isEdit && (
        <p className="px-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
          <span className="font-mono">{questionId}</span> · 저장하면 DB와{' '}
          <code>{sourceFile}</code> 를 함께 고칩니다. 풀이 이력은 그대로 남습니다.
        </p>
      )}

      {/* 저장 결과 */}
      {result?.ok && (
        <div className="card p-4" style={{ borderColor: 'var(--ok)' }}>
          <p className="text-[14px] font-bold" style={{ color: 'var(--ok)' }}>
            {isEdit ? '수정했습니다' : '저장했습니다'} · {result.id}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
            DB와 <code>{result.file ?? 'data/normalized/user-added.json'}</code> 에 함께 기록되어 DB를
            초기화해도 남습니다.
          </p>
          {warns.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {warns.map((w, i) => (
                <li key={i} className="text-[12.5px]" style={{ color: 'var(--warn)' }}>
                  경고: {w.message}
                </li>
              ))}
            </ul>
          )}
          {result.similar && result.similar.length > 0 && (
            <div className="mt-2">
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--warn)' }}>
                비슷한 문제가 이미 있습니다
              </p>
              <ul className="mt-1 space-y-0.5">
                {result.similar.map((s) => (
                  <li key={s.id} className="text-[12.5px]">
                    <Link href={`/questions/${s.id}`} className="underline underline-offset-2">
                      {s.question.slice(0, 40)}…
                    </Link>
                    <span style={{ color: 'var(--text-dim)' }}> (유사도 {s.score})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link href={`/questions/${result.id}`} className="btn mt-3 inline-block py-2 text-[13px]">
            {isEdit ? '문제 보기' : '방금 추가한 문제 보기'}
          </Link>
        </div>
      )}

      {result && !result.ok && (
        <div className="card p-4" style={{ borderColor: 'var(--bad)' }}>
          <p className="text-[14px] font-bold" style={{ color: 'var(--bad)' }}>
            {result.error ?? '저장하지 못했습니다.'}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i} className="text-[13px]" style={{ color: 'var(--bad)' }}>
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 출처 */}
      <section className="card space-y-3 p-4">
        <h2 className="text-[13px] font-bold">출처</h2>

        <div>
          <Label hint="실제 기출만 '기출'로 표시하세요">출처 유형</Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {SOURCE_TYPES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn py-2 text-[13px]"
                style={
                  f.sourceType === s.id
                    ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                    : undefined
                }
                onClick={() => set('sourceType', s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {isPastExam && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>연도</Label>
                <input
                  className="field"
                  inputMode="numeric"
                  placeholder="2024"
                  value={f.year}
                  onChange={(e) => set('year', e.target.value)}
                />
              </div>
              <div>
                <Label>회차</Label>
                <input
                  className="field"
                  inputMode="numeric"
                  placeholder="2"
                  value={f.round}
                  onChange={(e) => set('round', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label hint="한 줄에 하나">출처 URL</Label>
              <textarea
                className="field font-mono text-[13px]"
                rows={2}
                placeholder="https://..."
                value={f.sourceUrls}
                onChange={(e) => set('sourceUrls', e.target.value)}
              />
            </div>
          </>
        )}

        <div>
          <Label hint="예: 2024년 2회 실기 복원">출처 라벨</Label>
          <input
            className="field"
            value={f.sourceLabel}
            onChange={(e) => set('sourceLabel', e.target.value)}
          />
        </div>

        <div>
          <Label>검증 상태</Label>
          <select
            className="field"
            value={f.verificationStatus}
            onChange={(e) => set('verificationStatus', e.target.value)}
          >
            {VERIFICATION_STATUSES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
            정답이 확실하지 않으면 <code>unverified</code> 로 두세요.
          </p>
        </div>

        {f.sourceType === 'generated' && (
          <div>
            <Label hint="변형의 원본 문제 id">basedOn</Label>
            <input className="field" value={f.basedOn} onChange={(e) => set('basedOn', e.target.value)} />
          </div>
        )}
      </section>

      {/* 분류 */}
      <section className="card space-y-3 p-4">
        <h2 className="text-[13px] font-bold">분류</h2>

        <div>
          <Label>영역</Label>
          <select className="field" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>문제 유형</Label>
          <select
            className="field"
            value={f.questionType}
            onChange={(e) => set('questionType', e.target.value)}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label hint="선택">세부 분류</Label>
            <input
              className="field"
              placeholder="예: 디자인 패턴"
              value={f.subcategory}
              onChange={(e) => set('subcategory', e.target.value)}
            />
          </div>
          <div>
            <Label>난이도 1~5</Label>
            <select className="field" value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 본문 */}
      <section className="card space-y-3 p-4">
        <h2 className="text-[13px] font-bold">문제</h2>

        <div>
          <Label>문제 본문</Label>
          <textarea
            className="field"
            rows={4}
            placeholder="다음 설명에 해당하는 용어를 쓰시오."
            value={f.question}
            onChange={(e) => set('question', e.target.value)}
          />
        </div>

        <div>
          <Label hint="코드 / SQL / 표. 선택">코드 블록</Label>
          <textarea
            className="field font-mono text-[13px]"
            rows={5}
            placeholder={'#include <stdio.h>\n\nint main() { ... }'}
            value={f.code}
            onChange={(e) => set('code', e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {f.code && (
            <input
              className="field mt-2"
              placeholder="언어 (c / java / python / sql / text)"
              value={f.codeLang}
              onChange={(e) => set('codeLang', e.target.value)}
            />
          )}
        </div>

        {isChoice && (
          <div>
            <Label hint="한 줄에 하나. 2개 이상">보기</Label>
            <textarea
              className="field"
              rows={4}
              value={f.choices}
              onChange={(e) => set('choices', e.target.value)}
            />
          </div>
        )}
      </section>

      {/* 정답 */}
      <section className="card space-y-3 p-4">
        <h2 className="text-[13px] font-bold">정답 · 해설</h2>

        <div>
          <Label hint={isChoice ? '보기 번호를 쓰세요 (예: 3)' : '빈칸이 여러 개면 한 줄에 하나씩'}>
            정답
          </Label>
          <textarea
            className="field font-mono text-[14px]"
            rows={2}
            value={f.answer}
            onChange={(e) => set('answer', e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {answerLines.length > 1 && (
            <p className="mt-1 text-[11.5px]" style={{ color: 'var(--accent)' }}>
              빈칸 {answerLines.length}개로 채점합니다. 맞힌 개수만큼 부분 점수가 나옵니다.
            </p>
          )}
        </div>

        <div>
          <Label hint="영문 표기, 축약형 등. 한 줄에 하나">추가 허용 답</Label>
          <textarea
            className="field font-mono text-[14px]"
            rows={2}
            value={f.acceptedAnswers}
            onChange={(e) => set('acceptedAnswers', e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          {answerLines.length > 1 && (
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                className="size-5"
                checked={f.orderSensitive}
                onChange={(e) => set('orderSensitive', e.target.checked)}
              />
              <span className="text-[13.5px]">순서까지 맞아야 정답</span>
            </label>
          )}
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              className="size-5"
              checked={f.caseSensitive}
              onChange={(e) => set('caseSensitive', e.target.checked)}
            />
            <span className="text-[13.5px]">대소문자 구분 (문자열 출력 문제)</span>
          </label>
        </div>

        <div>
          <Label hint="비우면 정답 글자 수·첫 글자로 자동 생성">힌트</Label>
          <textarea
            className="field"
            rows={2}
            placeholder="예: 스크럼에서 제품 책임자가 관리하는 목록입니다."
            value={f.hint}
            onChange={(e) => set('hint', e.target.value)}
          />
        </div>

        <div>
          <Label>해설</Label>
          <textarea
            className="field"
            rows={3}
            value={f.explanation}
            onChange={(e) => set('explanation', e.target.value)}
          />
        </div>

        {isEdit ? (
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              className="size-5"
              checked={!f.active}
              onChange={(e) => set('active', !e.target.checked)}
            />
            <span className="text-[13.5px]">출제에서 제외 (문제는 남기고 더 이상 내지 않음)</span>
          </label>
        ) : (
          <div>
            <Label hint="비우면 자동 생성">id</Label>
            <input
              className="field font-mono text-[13px]"
              placeholder={isPastExam && f.year && f.round ? `${f.year}-${f.round}-001` : 'user-0001'}
              value={f.id}
              onChange={(e) => set('id', e.target.value)}
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        )}
      </section>

      {/* 미리보기 */}
      <section className="card p-4">
        <button
          type="button"
          className="text-[13px] font-medium"
          style={{ color: 'var(--accent)' }}
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? '미리보기 닫기' : '푸는 화면으로 미리보기'}
        </button>
        {showPreview && (
          <div className="mt-3">
            <QuestionMeta q={preview} />
            <QuestionBody q={preview} />
            <p className="mt-3 text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
              정답
            </p>
            <p className="font-mono text-[14px]" style={{ color: 'var(--ok)' }}>
              {answerLines.join(' / ') || '(미입력)'}
            </p>
          </div>
        )}
      </section>

      {isEdit ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary" onClick={() => submit(false)} disabled={saving}>
            {saving ? '저장 중…' : '수정 저장'}
          </button>
          <Link href={`/questions/${questionId}`} className="btn text-center">
            취소
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary" onClick={() => submit(true)} disabled={saving}>
            {saving ? '저장 중…' : '저장하고 계속'}
          </button>
          <button className="btn" onClick={() => submit(false)} disabled={saving}>
            저장하고 멈춤
          </button>
        </div>
      )}

      {/* 버튼 바로 아래에서도 결과를 알 수 있게 한 번 더 보여준다 */}
      {result && (
        <p
          className="px-1 text-center text-[13px] font-semibold"
          style={{ color: result.ok ? 'var(--ok)' : 'var(--bad)' }}
        >
          {result.ok
            ? `${isEdit ? '수정' : '저장'}했습니다 · ${result.id}`
            : (result.error ?? '저장하지 못했습니다.')}
        </p>
      )}

      {/* 이번 세션에서 추가한 것 */}
      {added.length > 0 && (
        <section className="card p-4">
          <h2 className="text-[13px] font-bold">이번에 추가한 {added.length}문제</h2>
          <ul className="mt-2 space-y-1">
            {added.map((a) => (
              <li key={a.id} className="text-[13px]">
                <Link href={`/questions/${a.id}`} className="underline underline-offset-2">
                  {a.question.slice(0, 40) || a.id}…
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && added.length === 0 && (
        <section className="card p-4">
          <h2 className="text-[13px] font-bold">최근 추가한 문제</h2>
          <ul className="mt-2 space-y-1.5">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[13px]">
                <Badge>{r.id}</Badge>
                <Link href={`/questions/${r.id}`} className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">
                  {r.question}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
