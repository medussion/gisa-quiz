/**
 * 카테고리는 Q-Net 정보처리기사 실기 출제기준(2026.1.1~2026.12.31 적용)의
 * 12개 주요항목을 기준으로 한다.
 * 출처: https://q-net.or.kr/crf005.do?id=crf00503s02&jmCd=1320&jmInfoDivCcd=B0
 * DB에는 문자열로 저장하므로 목록 변경 시 마이그레이션이 필요 없다.
 */
export const CATEGORIES = [
  { id: 'requirements', label: '요구사항 확인' },
  { id: 'data_io', label: '데이터 입출력 구현' },
  { id: 'integration', label: '통합 구현' },
  { id: 'server_programming', label: '서버 프로그램 구현' },
  { id: 'interface', label: '인터페이스 구현' },
  { id: 'ui_design', label: '화면 설계' },
  { id: 'testing', label: '애플리케이션 테스트 관리' },
  { id: 'sql', label: 'SQL 응용' },
  { id: 'security', label: '소프트웨어 개발 보안 구축' },
  { id: 'programming_language', label: '프로그래밍 언어 활용' },
  { id: 'app_sw_basics', label: '응용 SW 기초 기술 활용' },
  { id: 'packaging', label: '제품 소프트웨어 패키징' },
  { id: 'etc', label: '기타' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as readonly string[];
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);

export const QUESTION_TYPES = [
  { id: 'short_answer', label: '단답형' },
  { id: 'term', label: '용어' },
  { id: 'code_output', label: '코드 실행결과' },
  { id: 'sql', label: 'SQL 작성' },
  { id: 'descriptive', label: '서술형' },
  { id: 'multiple_choice', label: '객관식' },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]['id'];
export const QUESTION_TYPE_IDS = QUESTION_TYPES.map((t) => t.id) as readonly string[];
export const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.id, t.label]),
);

/**
 * past_exam : 실제 기출/복원 문제
 * generated : AI가 기출을 변형해 만든 문제 (basedOn 필수 권장)
 * sample    : 앱 동작 확인용 자체 제작 예시 문제 — 기출이 아니다
 * user      : 사용자가 직접 넣은 자료(교재/노트 등)
 */
export const SOURCE_TYPES = [
  { id: 'past_exam', label: '기출' },
  { id: 'generated', label: 'AI 변형' },
  { id: 'sample', label: '샘플' },
  { id: 'user', label: '사용자 자료' },
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number]['id'];
export const SOURCE_TYPE_IDS = SOURCE_TYPES.map((s) => s.id) as readonly string[];

export const VERIFICATION_STATUSES = [
  'unverified',
  'single_source',
  'cross_checked',
  'verified',
  'rejected',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** UI에 노출할 출처 배지 문구 */
export function sourceBadge(sourceType: string, verificationStatus: string): string {
  if (sourceType === 'past_exam') {
    if (verificationStatus === 'verified' || verificationStatus === 'cross_checked') {
      return '기출 · 검증됨';
    }
    if (verificationStatus === 'single_source') return '기출 · 단일 복원';
    return '기출 · 미검증';
  }
  if (sourceType === 'generated') return 'AI 변형';
  if (sourceType === 'sample') return '샘플(기출 아님)';
  return '사용자 자료';
}

export const STUDY_MODES = [
  { id: 'today', label: '오늘의 20문제', desc: '신규 + 취약 문제 혼합' },
  { id: 'past_only', label: '기출 ONLY', desc: '실제 기출/복원 문제만' },
  { id: 'wrong', label: '오답 집중', desc: '틀린 적 있는 문제 우선' },
  { id: 'recent_wrong', label: '최근 오답', desc: '최근 7일 내 틀린 문제' },
  { id: 'code', label: '코드 집중', desc: '코드 실행결과 문제' },
  { id: 'sql', label: 'SQL 집중', desc: 'SQL 작성 문제' },
  { id: 'memorize', label: '암기 집중', desc: '용어 · 단답형' },
  { id: 'descriptive', label: '서술형 집중', desc: '설명을 직접 쓰는 문제' },
  { id: 'review_due', label: '복습 예정', desc: '복습 주기가 도래한 문제' },
  { id: 'bookmarked', label: '북마크', desc: '북마크한 문제' },
  { id: 'random', label: '랜덤', desc: '무작위 출제' },
] as const;

export type StudyMode = (typeof STUDY_MODES)[number]['id'];
export const STUDY_MODE_IDS = STUDY_MODES.map((m) => m.id) as readonly string[];
