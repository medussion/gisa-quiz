import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    sourceType: text('source_type').notNull(),
    sourceLabel: text('source_label').notNull().default(''),
    /** JSON 배열 문자열 */
    sourceUrls: text('source_urls').notNull().default('[]'),
    year: integer('year'),
    round: integer('round'),
    category: text('category').notNull(),
    subcategory: text('subcategory'),
    questionType: text('question_type').notNull(),
    question: text('question').notNull(),
    /** 코드/SQL 스니펫 (선택) */
    code: text('code'),
    codeLang: text('code_lang'),
    /** 코드/그림이 이미지로만 있는 기출 문항의 이미지 경로 (public 기준) */
    image: text('image'),
    /** JSON 배열 문자열 — 정답(복수 가능) */
    answer: text('answer').notNull(),
    /** JSON 배열 문자열 — 추가 허용 답 */
    acceptedAnswers: text('accepted_answers').notNull().default('[]'),
    /** JSON 배열 문자열 — 객관식 보기 */
    choices: text('choices'),
    /** 대소문자 무시 여부 (문제별) */
    caseSensitive: integer('case_sensitive', { mode: 'boolean' }).notNull().default(false),
    /** 정답이 여러 개일 때 순서를 지켜야 하는지 */
    orderSensitive: integer('order_sensitive', { mode: 'boolean' }).notNull().default(false),
    /** 직접 적은 힌트. 비어 있으면 정답 모양으로 자동 생성한다. */
    hint: text('hint'),
    explanation: text('explanation').notNull().default(''),
    difficulty: integer('difficulty').notNull().default(3),
    verificationStatus: text('verification_status').notNull().default('unverified'),
    verificationCount: integer('verification_count').notNull().default(0),
    basedOn: text('based_on'),
    /** 중복 탐지용 정규화 본문 */
    normalizedText: text('normalized_text').notNull().default(''),
    /** 이 문제가 들어 있는 JSON 파일. 웹에서 수정할 때 원본까지 같이 고치려고 남긴다. */
    sourceFile: text('source_file'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [
    index('questions_category_idx').on(t.category),
    index('questions_source_type_idx').on(t.sourceType),
    index('questions_question_type_idx').on(t.questionType),
    index('questions_year_round_idx').on(t.year, t.round),
  ],
);

export const attempts = sqliteTable(
  'attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    userAnswer: text('user_answer').notNull().default(''),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
    /** 0.0 ~ 1.0 */
    score: real('score').notNull().default(0),
    mode: text('mode').notNull().default('today'),
    examSessionId: integer('exam_session_id'),
    /** 사용자가 채점 결과를 수동 보정했는지 */
    manualOverride: integer('manual_override', { mode: 'boolean' }).notNull().default(false),
    /** 풀지 않고 정답을 열어본 경우 */
    revealed: integer('revealed', { mode: 'boolean' }).notNull().default(false),
    /** 힌트를 본 뒤 맞혔는지 구분하려고 남긴다 */
    usedHint: integer('used_hint', { mode: 'boolean' }).notNull().default(false),
    answeredAt: text('answered_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    durationMs: integer('duration_ms').notNull().default(0),
  },
  (t) => [
    index('attempts_question_idx').on(t.questionId),
    index('attempts_answered_at_idx').on(t.answeredAt),
    index('attempts_exam_session_idx').on(t.examSessionId),
  ],
);

export const questionProgress = sqliteTable(
  'question_progress',
  {
    questionId: text('question_id')
      .primaryKey()
      .references(() => questions.id, { onDelete: 'cascade' }),
    attemptCount: integer('attempt_count').notNull().default(0),
    correctCount: integer('correct_count').notNull().default(0),
    wrongCount: integer('wrong_count').notNull().default(0),
    streak: integer('streak').notNull().default(0),
    lastAnsweredAt: text('last_answered_at'),
    lastCorrectAt: text('last_correct_at'),
    lastWrongAt: text('last_wrong_at'),
    nextReviewAt: text('next_review_at'),
    /** 0.0 ~ 1.0 숙련도 */
    masteryScore: real('mastery_score').notNull().default(0),
    bookmarked: integer('bookmarked', { mode: 'boolean' }).notNull().default(false),
    memo: text('memo').notNull().default(''),
  },
  (t) => [
    index('progress_next_review_idx').on(t.nextReviewAt),
    index('progress_bookmarked_idx').on(t.bookmarked),
  ],
);

export const examSessions = sqliteTable('exam_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  completedAt: text('completed_at'),
  questionCount: integer('question_count').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  score: integer('score').notNull().default(0),
  mode: text('mode').notNull().default('mock_exam'),
  /** JSON 배열 문자열 — 출제된 questionId 순서 */
  questionIds: text('question_ids').notNull().default('[]'),
});

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type QuestionProgress = typeof questionProgress.$inferSelect;
export type ExamSession = typeof examSessions.$inferSelect;
