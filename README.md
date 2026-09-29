# 정보처리기사 실기 훈련기

기출 중심으로 **직접 답을 입력해서 풀고**, 틀린 문제를 자동으로 다시 만나게 하는 개인 학습 웹앱.
객관식 암기 앱이 아니라 단답형 · 용어 · 코드 실행결과 · SQL 작성 위주다.

## 빠른 시작

```bash
npm install
cp .env.example .env
npm run db:migrate && npm run questions:import
npm run dev
```

http://localhost:3000 을 연다. 로그인은 없다.

`npm run setup` 은 `db:migrate` + `questions:import` 를 한 번에 실행한다.

## 지금 들어 있는 문제

| 출처 | 문항 수 | 표시 |
| --- | --- | --- |
| 2020~2025년 기출/복원 18개 회차 | **358** (출제 대상 354) | `기출 · 단일 복원` |
| 앱 동작 확인용 자체 제작 샘플 | 54 | `샘플(기출 아님)` |

기출은 공개 문제은행([newbt.kr](https://newbt.kr))에서 모았고, 문항마다 출처 URL을 보관한다.
**대부분이 `single_source`(기출 · 단일 복원)** 이라 정답이 틀렸을 수 있다. 자세한 내용은 아래 [검증](#검증).

샘플 54문제는 **실제 기출이 아니다.** 시험 직전에는 `기출 ONLY` 모드로 기출만 풀면 된다.

## 화면

| 경로 | 내용 |
| --- | --- |
| `/` | D-day, 오늘 푼 문제/정답률, 전체 정답률, 최근 7일 학습량, 영역별 정답률, 취약 영역, 최근 모의고사 |
| `/study?mode=...` | 문제 풀이. 한 문제씩 입력 → 제출 → 정답/해설 → 다음 |
| `/exam` | 모의고사. 푸는 동안 정답 비공개, 제출 후 점수·영역별 결과·오답·해설 |
| `/exam/history` | **회차별 기록 · 종합 평균 · 점수 추세 · 모의고사 영역별 평균** |
| `/exam/[id]` | 지난 모의고사 결과 다시 보기 |
| `/review` | 오답노트 |
| `/questions` | 문제 목록 · 영역/유형/출처/연도/북마크 필터 · 검색 |
| `/questions/new` | **웹에서 문제 추가** (`+ 문제 추가` 버튼) |
| `/questions/[id]` | 문제 상세, 출처·검증 상태, 진행 상황, 풀이 이력 |
| `/questions/[id]/edit` | **문제 수정** (상세 화면의 `수정` 버튼, 풀이 화면의 `문제 수정`) |

### 학습 모드 (`/study?mode=`)

`today`(신규+취약 혼합) · `past_only`(기출만) · `wrong`(오답) · `recent_wrong`(최근 7일 오답) ·
`code` · `sql` · `descriptive`(서술형) · `memorize`(용어/단답) · `review_due`(복습 주기 도래) ·
`bookmarked` · `random`

쿼리로 `count`, `category`, `questionType`, `year`, `round`, `difficulty`, `excludeGenerated=1` 을 덧붙일 수 있다.

```
/study?mode=past_only&category=sql&count=30
/study?mode=today&excludeGenerated=1
```

## 설정 (`.env`)

```env
EXAM_DATE=2026-10-25        # 수험표 확인 후 수정
PASS_SCORE=60
EXAM_QUESTION_COUNT=20
EXAM_TOTAL_SCORE=100
DATABASE_PATH=./data/app.db
```

`EXAM_DATE` 는 임시값이다. 수험표를 받으면 바꾸고 `npm run dev` 를 다시 띄우면 된다.
모의고사 점수는 문항 수와 상관없이 100점 만점으로 환산한다(20문항이면 문항당 5점).

## 모의고사 회차 기록

`/exam/history` (홈 · 모의고사 화면의 `회차별 기록` 링크)에서 본다.

- **종합 평균** · 최근 5회 평균 · 직전 회차 대비 증감
- 최고 / 최저 점수, 합격권 비율, 누적 정답률
- 회차별 점수 추세 막대 그래프 (합격선 표시)
- 모의고사에서 푼 문제만 집계한 **영역별 평균** (낮은 순)
- 회차별 기록 목록 → 누르면 그 회차의 문제·해설 복습
- 기출 문제를 import 하면 **기출 연도·회차별 정답률**도 함께 나온다

홈 대시보드의 `최근 모의고사` 카드에도 종합 평균이 바로 뜬다.

## 문제 추가하기

방법은 두 가지다. 어느 쪽이든 같은 검증 규칙을 거치고 같은 JSON 파일로 남는다.

### 웹에서 추가 (빠름)

문제 목록 화면 오른쪽 위 **`+ 문제 추가`** 버튼 (`/questions/new`).

- 출처 유형을 고르면 필요한 칸(연도·회차·출처 URL)이 따라 나온다
- `id` 는 비우면 자동 생성된다 (`2024-2-001` / `user-0001`)
- `힌트` 를 비워두면 정답 글자 수·첫 글자로 자동 생성된다
- `푸는 화면으로 미리보기` 로 실제 풀이 화면을 확인할 수 있다
- 저장하면 비슷한 문제가 이미 있는지 알려준다 (막지는 않는다)
- `저장하고 계속` 을 누르면 출처·영역 등 메타 정보를 남긴 채 본문만 비워 연속 입력할 수 있다

저장한 문제는 DB와 **`data/normalized/user-added.json`** 에 함께 기록된다.
따라서 `db:reset` 후 `questions:import` 해도 되살아나고, 파일을 직접 열어 고쳐도 된다.

### 검증

`npm run collect:crosscheck` (보고서만) / `-- --write` (반영).

**기계로 읽을 수 있는 독립 출처를 찾지 못했다.** 후보였던 곳은 모두 막혀 있었다 —
comcbt·cbtbank는 요청 차단, dumok·eduon 상세는 로그인 필요, gisafirst는 인증서 오류,
itwiki가 가리키는 q.fran.kr은 newbt로 리다이렉트되는 같은 사이트였다.
그래서 **없는 검증을 있다고 하지 않고**, 실제로 확인할 수 있는 것만 한다.

1. **회차 간 반복 출제 대조** — 같은 문제가 다른 회차에 다시 나오면 두 복원은 다른 시점·다른 작성자의 것이다.
   정답이 일치하면 서로를 뒷받침하므로 `cross_checked` 로 올린다. 다르면 보고서에 남기고 그대로 둔다.
2. **품질 점검** — 정답이 비었거나, 문제를 그대로 베꼈거나, 그림을 보라는데 그림이 없는 문항을 찾아
   `rejected` 로 내려 출제에서 뺀다.

결론은 [`data/corrections.json`](data/corrections.json) 에 **근거(`reason`)와 함께** 쌓인다.
`collect:parse` 가 마지막에 이 파일을 덮어씌우므로 다시 파싱해도 살아남는다.
근거가 없는 보정은 무시한다.

현재 상태: `cross_checked` 2 · `single_source` 355 · `rejected` 1 (출제 제외).

### 기출 해설

출처에는 해설이 없다(등록자 해설은 비어 있고 나머지는 그 사이트가 그때그때 만드는 AI 해설이다).
그래서 **해설은 직접 작성해 [`data/explanations.json`](data/explanations.json) 에 넣었다.**
정답은 출처의 것을 그대로 두고 '왜 그 답이 되는지'만 덧붙인 것이다.

`collect:parse` 가 파싱 마지막에 이 파일을 덮어씌우므로 다시 파싱해도 살아남는다.
틀린 해설을 보면 웹의 `수정` 화면에서 고치거나 이 파일을 직접 고치면 된다.

현재 **기출 358문항 전부에 해설이 들어 있다.** 코드 문제는 한 줄씩 따라간 풀이를,
용어 문제는 헷갈리는 이웃 개념과 함께 적었다.

### 이미 있는 문제 고치기

문제 상세 화면 오른쪽 위 **`수정`**, 또는 풀이 화면에서 채점 결과 아래 **`문제 수정`**.
정답이 틀렸거나 오타를 발견했을 때 그 자리에서 고칠 수 있다.

- **id는 바꾸지 않는다.** id가 풀이 이력·오답노트·복습 주기를 묶는 열쇠라서, 바꾸면 기록이 끊긴다.
  그래서 고쳐도 지금까지 푼 기록·북마크·메모는 그대로 남는다.
- 저장하면 DB와 **그 문제가 원래 들어 있던 JSON 파일**을 함께 고친다.
  (`questions.json` 의 문제를 고치면 `questions.json` 이 바뀐다)
  따라서 다음 `questions:import` 때 되돌아가지 않는다.
- `출제에서 제외` 를 켜면 문제를 지우지 않고 출제 대상에서만 뺀다.
  다시 찾으려면 문제 목록의 `출제 제외` 칩을 누른다.

### 공개 기출 수집 (자동)

```bash
npm run collect     # 받기 -> 파싱 -> 검증 -> import 를 한 번에
```

단계별로도 돌릴 수 있고, 각 단계는 몇 번을 다시 실행해도 된다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run collect:fetch` | 공개 회차 페이지를 `data/raw/<연도>/` 에 원문 그대로 저장 (이미 받은 건 건너뜀, `--force` 로 강제) |
| `npm run collect:parse` | 원문에서 문제·정답을 뽑아 `data/normalized/past-<연도>.json` 생성. 그림으로만 있는 본문은 `public/question-images/` 로 꺼냄 |
| `npm run collect:crosscheck` | 검증 보고서. `-- --write` 를 붙이면 `data/corrections.json` 에 반영 |
| `npm run questions:validate` | 검사 |
| `npm run questions:import` | DB 반영 |

지키는 것 — 공개 페이지만, `robots.txt` 준수, 로그인·유료벽 접근 안 함, 요청 사이 1.5초 대기,
출처 URL과 받은 시각을 `data/raw/**/*.source.json` 에 보관.

`npm run collect:fetch` 는 회차 목록을 사이트 색인에서 직접 읽으므로, 새 회차가 올라오면 그대로 따라간다.

### JSON 파일로 추가 (대량)

1. `data/normalized/` 아래에 JSON 파일을 만든다 (`2024.json` 처럼 나눠도 된다. 폴더 안 `*.json` 을 모두 읽는다).
2. `npm run questions:validate` 로 검사한다.
3. `npm run questions:import` 로 DB에 넣는다. 같은 `id` 는 덮어쓰고 풀이 이력은 유지된다.

자세한 내용은 [docs/문제-추가-가이드.md](docs/문제-추가-가이드.md), 스키마는
[data/question.schema.json](data/question.schema.json) 에 있다.

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 · 실행 |
| `npm run db:generate` | 스키마 변경 후 마이그레이션 SQL 생성 |
| `npm run db:migrate` | 마이그레이션 적용 (DB 파일 생성) |
| `CONFIRM=yes npm run db:reset` | DB 삭제 (**풀이 이력까지 전부 사라진다**) |
| `npm run questions:validate` | JSON 검사. 오류는 `data/rejected/` 에 기록 |
| `npm run questions:import` | 검사 통과분만 DB에 반영 |
| `npm run questions:duplicates` | 중복 후보 리포트 (자동 병합하지 않는다) |
| `npm run questions:unverified` | 검증이 덜 된 문제 목록 |
| `npm run collect` | 기출 수집 전체 (받기 → 파싱 → 검증 → 반영 → import) |
| `npm test` / `npm run lint` / `npm run typecheck` | 테스트 · 린트 · 타입 검사 |

## 힌트 · 정답 보기

풀이 화면에서 `제출` 아래에 **`힌트 보기`** 와 **`정답 보기`** 가 있다. (모의고사 중에는 나오지 않는다)

- **힌트 보기** — 문제에 `hint` 를 적어두면 그 문장을 보여주고, 비어 있으면 **정답의 모양**으로 자동 생성한다.
  `분야: 트랜잭션 / 한글 3글자, 「원」(으)로 시작합니다.` 처럼 나온다.
  1글자짜리 정답은 첫 글자를 공개하지 않고, 숫자는 자릿수만, SQL은 첫 키워드만 알려준다.
  정답 자체는 서버 밖으로 나가지 않는다.
- **정답 보기** — 한 번 더 눌러 확인하면 정답과 해설을 공개하고, 그 문제는 **오답으로 기록**된다.
  당일 재출제 후보로 돌아가므로 오답 집중 · 복습 예정에서 다시 만난다.
- 힌트를 보고 푼 기록과 정답을 열어본 기록은 문제 상세의 풀이 이력에 `힌트 사용` / `정답 확인` 으로 남는다.

## 채점 방식

- 공통: 앞뒤 공백 제거, 연속 공백/줄바꿈 정규화, 끝 마침표 무시, 기본적으로 대소문자 무시
- `acceptedAnswers` 에 적은 표기도 정답 처리
- 빈칸이 여러 개(`answer` 배열 길이 ≥ 2)면 줄바꿈 또는 쉼표로 나눠 채점하고 **부분 점수**를 보여준다
  (`orderSensitive: true` 면 순서까지 맞아야 한다)
- **SQL 과 서술형은 자동 채점을 믿지 않는다.** 정규화 비교로 1차 판정한 뒤 모범답안을 보여주고,
  화면에서 `정답 처리` / `오답 처리` 로 직접 보정할 수 있다. 보정하면 누적 통계와 복습 주기도 함께 고쳐진다.

## 출제 우선순위 / 복습 주기

출제는 단순 우선순위 점수로 고른다. 높은 순서대로:

1. 미풀이 기출 → 2. 최근 오답 → 3. 반복 오답 → 4. 복습 주기 도래 →
5. 오래전에 맞힌 문제 → 6. 최근 연속 정답 문제(가장 후순위)

복습 주기는 시험까지 기간이 짧은 것을 감안해 공격적으로 둔다:
**틀림 → 당일 → 1일 → 3일 → 7일 → 14일 → 30일**. 다시 틀리면 당일로 초기화된다.

## 출처 · 검증 상태

모든 문제는 출처를 보존한다. 화면 배지는 다음과 같이 표시된다.

| 배지 | 뜻 |
| --- | --- |
| `기출 · 검증됨` | `past_exam` + `verified`/`cross_checked` |
| `기출 · 단일 복원` | `past_exam` + `single_source` — 출처가 하나뿐이라 정답이 틀릴 수 있다 |
| `기출 · 미검증` | `past_exam` + `unverified` |
| `AI 변형` | `generated` |
| `샘플(기출 아님)` | `sample` |

시험 직전에는 `/study?mode=past_only` 또는 `excludeGenerated=1` 로 AI 문제를 빼고 풀면 된다.

**정답이 확실하지 않으면 추측해서 채우지 말고 `unverified` 로 둔다.**
공개 접근 가능한 자료만 사용하고, 로그인/유료벽을 우회하지 않으며, 상용 교재를 통째로 복제·배포하지 않는다.

## 기술 스택

Next.js 15 (App Router) · TypeScript · SQLite(better-sqlite3) · Drizzle ORM · Tailwind CSS v4 · Vitest

```
src/
├── app/            페이지 + API 라우트
├── components/     풀이/모의고사 UI
├── db/             Drizzle 스키마 · 커넥션
├── lib/            채점 · 출제 우선순위 · 검증 (순수 함수, 테스트 대상)
└── server/         DB를 건드리는 서버 전용 로직
scripts/            CLI (검증 / import / 중복 / 마이그레이션)
  collect/          기출 수집 (내려받기 · 파싱 · 영역 분류)
public/question-images/  본문이 그림으로만 있는 기출 문항의 이미지
data/
├── raw/            수집 원본 HTML + 출처 기록 (연도별)
├── sources/user/   사용자 제공 자료 (PDF/MD/TXT 등)
├── normalized/     import 대상 (questions.json · user-added.json · 기출 파일)
├── generated/      AI 변형 문제
└── rejected/       검증 실패 · 중복 후보 리포트
```

## 참고

- Q-Net 정보처리기사 출제기준(2026.1.1~2026.12.31 적용) —
  <https://q-net.or.kr/crf005.do?id=crf00503s02&jmCd=1320&jmInfoDivCcd=B0>
  실기 주요항목 12개를 `src/lib/constants.ts` 의 `CATEGORIES` 에 그대로 반영했다.
- 실기는 필답형 20문항 · 100점 만점 · 60점 이상 합격 · 2시간 30분.
