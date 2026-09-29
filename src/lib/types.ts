/** 클라이언트로 보내는 문제 모양 (JSON 컬럼을 파싱한 형태) */
export interface QuestionDTO {
  id: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrls: string[];
  year: number | null;
  round: number | null;
  category: string;
  subcategory: string | null;
  questionType: string;
  question: string;
  code: string | null;
  codeLang: string | null;
  image: string | null;
  choices: string[] | null;
  difficulty: number;
  verificationStatus: string;
  badge: string;
}

/** 채점 후 정답/해설까지 포함한 모양 */
export interface RevealedQuestion extends QuestionDTO {
  answer: string[];
  acceptedAnswers: string[];
  explanation: string;
}

export interface GradeResponse {
  attemptId: number;
  isCorrect: boolean;
  score: number;
  perSlot: boolean[];
  needsManualCheck: boolean;
  /** '정답 보기'로 공개한 경우 true */
  wasRevealed: boolean;
  revealed: RevealedQuestion;
  progress: {
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    streak: number;
    nextReviewAt: string | null;
    masteryScore: number;
    bookmarked: boolean;
    memo: string;
  };
}

export interface QuestionFilters {
  category?: string;
  questionType?: string;
  sourceType?: string;
  year?: number;
  round?: number;
  difficulty?: number;
  pastOnly?: boolean;
  excludeGenerated?: boolean;
}
