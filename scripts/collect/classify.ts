/**
 * 문제를 Q-Net 출제기준 12개 영역과 문제 유형으로 분류한다.
 *
 * 규칙 기반이라 완벽하지 않다. 애매한 것은 'etc' 로 두고 사람이 고치게 한다
 * (웹의 문제 수정 화면에서 영역을 바꿀 수 있다).
 */

export interface ClassifyInput {
  question: string;
  code: string;
  answer: string;
  wikiTopics: string[];
}

/** 위에 있는 규칙이 먼저 이긴다 */
const CATEGORY_RULES: { id: string; patterns: RegExp[] }[] = [
  {
    id: 'sql',
    patterns: [
      /\bSELECT\b|\bINSERT\s+INTO\b|\bUPDATE\b\s|\bDELETE\s+FROM\b|\bCREATE\s+(TABLE|VIEW|INDEX)\b|\bALTER\s+TABLE\b|\bDROP\s+(TABLE|VIEW)\b/i,
      /\bGRANT\b|\bREVOKE\b|\bCOMMIT\b|\bROLLBACK\b|\bHAVING\b|\bGROUP\s+BY\b|\bORDER\s+BY\b/i,
      /SQL\s?문|질의문|관계\s?대수|관계\s?해석|프로시저|트리거|커서|집계\s?함수|뷰\(VIEW\)/,
      /[πσ⋈∪∩÷×]|프로젝션|셀렉션|디비전|카티션|natural\s+join/i,
    ],
  },
  {
    id: 'programming_language',
    patterns: [
      /#include|System\.out|public\s+class|def\s+\w+\(|printf|scanf|malloc|std::/,
      /다음\s*(C|C\+\+|JAVA|Java|자바|Python|파이썬)\s*(언어)?\s*(로|으로)?\s*(구현|작성)/,
      /객체\s?지향|상속|오버라이딩|오버로딩|캡슐화|다형성|추상화|접근\s?제어자|예외\s?처리|포인터|배열|클래스|생성자|인터페이스\s*키워드/,
      /파이썬|자바|스크립트\s?언어|변수명|식별자|연산자|라이브러리\s?함수/,
      // 코드가 그림으로만 올라온 문항은 지문만 보고 가려야 한다
      /(C|C\+\+|자바|Java|파이썬|Python|JavaScript)\s*언어|다음\s*(코드|소스\s?코드|프로그램)|출력\s?값|예약어|구조체/i,
    ],
  },
  {
    id: 'security',
    patterns: [
      /보안|암호화|복호화|대칭\s?키|비대칭|공개\s?키|개인\s?키|해시|SHA|AES|DES|RSA|SEED|ARIA/,
      /공격|취약점|침해|악성|랜섬|피싱|스니핑|스푸핑|DDoS|DoS|SQL\s?삽입|XSS|백도어|좀비|봇넷/,
      /접근\s?통제|인증|인가|과금|방화벽|IDS|IPS|VPN|SSO|커버로스|Kerberos|블록체인|\bAAA\b/,
      /트로이|웜|바이러스|하이재킹|세션\s?가로채기|살라미|스머핑|티어드롭/,
    ],
  },
  {
    id: 'app_sw_basics',
    patterns: [
      /운영\s?체제|프로세스|스레드|스케줄링|교착\s?상태|데드락|페이지\s?교체|페이지\s?부재|가상\s?메모리|기억\s?장치|세마포어|모니터|리눅스|유닉스|커널|셸|chmod/,
      /네트워크|프로토콜|OSI|TCP|UDP|IP\s?주소|IPv|서브넷|라우팅|라우터|스위치|LAN|MAC\s?주소|패킷|ICMP|ARP|DNS|HTTP|포트/,
      /클라우드|IaaS|PaaS|SaaS|가상화|빅데이터|하둡|IoT|5G|무선|블루투스|메시\s?네트워크/,
    ],
  },
  {
    id: 'data_io',
    patterns: [
      /정규화|정규형|이상\s?현상|함수\s?종속|반정규화|무결성|트랜잭션|ACID|병행\s?제어|로킹|회복\s?기법|로그\s?기반/,
      /데이터베이스\s?설계|개념적\s?설계|논리적\s?설계|물리적\s?설계|스키마|E-?R|개체|릴레이션|튜플|카디널리티|디그리|도메인/,
      /기본\s?키|외래\s?키|후보\s?키|슈퍼\s?키|대체\s?키|인덱스|파티션|클러스터|자료\s?구조|스택|큐|트리|해싱|정렬|탐색|연결\s?리스트/,
      /데이터\s?마이닝|데이터\s?웨어하우스|OLAP|ETL|메타\s?데이터|RAID/,
    ],
  },
  {
    id: 'testing',
    patterns: [
      /테스트|테스팅|검사|결함|오류\s?예측|커버리지|블랙\s?박스|화이트\s?박스|동치\s?분할|경계값|원인-?결과|테스트\s?케이스|드라이버|스텁|통합\s?시험/,
      /디버깅|인스펙션|워크\s?스루|동료\s?검토|V-?모델|회귀|알파\s?테스트|베타\s?테스트|성능\s?측정|복잡도|McCabe|순환\s?복잡도/,
      /리팩토링|클린\s?코드|코드\s?품질/,
    ],
  },
  {
    id: 'requirements',
    patterns: [
      /요구\s?사항|요구\s?분석|현행\s?시스템|타당성|소프트웨어\s?생명\s?주기|생명주기|폭포수|프로토타입\s?모형|나선형|애자일|스크럼|XP|익스트림|백로그|스프린트/,
      /UML|유스\s?케이스|클래스\s?다이어그램|시퀀스\s?다이어그램|활동\s?다이어그램|상태\s?다이어그램|집합\s?관계|일반화|연관\s?관계|스테레오\s?타입|모델링/,
      /비용\s?산정|COCOMO|기능\s?점수|LOC|PERT|CPM|일정\s?관리|위험\s?관리/,
    ],
  },
  {
    id: 'server_programming',
    patterns: [
      /디자인\s?패턴|생성\s?패턴|구조\s?패턴|행위\s?패턴|싱글톤|팩토리|빌더|프로토타입\s?패턴|어댑터|브리지|데코레이터|퍼사드|프록시|옵저버|전략\s?패턴|템플릿\s?메소드|상태\s?패턴|책임\s?연쇄/,
      /팬\s?인|팬\s?아웃|Fan-?in|Fan-?out|시스템\s?구조도|모듈\s?구조/i,
      /결합도|응집도|모듈화|추상화|정보\s?은닉|MVC|아키텍처|계층화|파이프|필터|클라이언트-?서버|마이크로\s?서비스|서버\s?개발|프레임워크|배치\s?프로그램/,
    ],
  },
  {
    id: 'interface',
    patterns: [
      /인터페이스|EAI|ESB|미들웨어|API|JSON|XML|YAML|AJAX|REST|SOAP|WSDL|웹\s?서비스|연계\s?모듈|송수신|데이터\s?교환/,
    ],
  },
  {
    id: 'ui_design',
    patterns: [/\bUI\b|\bUX\b|사용자\s?인터페이스|화면\s?설계|와이어\s?프레임|스토리\s?보드|목업|프로토타입\s?제작|웹\s?접근성|직관성|유효성|학습성|유연성|CLI|GUI|NUI/],
  },
  {
    id: 'integration',
    patterns: [/형상\s?관리|버전\s?관리|체크\s?아웃|체크\s?인|커밋|깃|Git|SVN|CVS|베이스\s?라인|통합\s?구현|단위\s?모듈|IPC|공유\s?메모리|소켓|파이프/],
  },
  {
    id: 'packaging',
    patterns: [/패키징|DRM|저작권|릴리즈\s?노트|매뉴얼|설치\s?안내|빌드\s?자동화|배포|난독화|워터마킹|핑거프린팅|저장소\s?관리/],
  },
];

/**
 * 이 낱말이 나오면 다른 규칙과 상관없이 그 영역으로 본다.
 * (예: '릴리즈 노트' 는 내용에 보안 이야기가 섞여 있어도 제품 소프트웨어 패키징이다)
 */
const STRONG_RULES: { id: string; pattern: RegExp }[] = [
  { id: 'packaging', pattern: /릴리즈\s?노트|제품\s?소프트웨어\s?패키징|\bDRM\b|디지털\s?저작권|난독화|워터마킹|핑거프린팅|매뉴얼\s?작성/ },
  { id: 'integration', pattern: /형상\s?관리|형상\s?통제|형상\s?식별|베이스\s?라인|버전\s?관리\s?도구/ },
  { id: 'ui_design', pattern: /UI\s?설계\s?원칙|와이어\s?프레임|스토리\s?보드|사용자\s?인터페이스\s?설계/ },
  { id: 'requirements', pattern: /유스\s?케이스\s?다이어그램|요구사항\s?명세|애자일\s?선언/ },
];

export function classifyCategory(input: ClassifyInput): string {
  const haystack = [input.question, input.code, input.answer, input.wikiTopics.join(' ')].join('\n');

  for (const rule of STRONG_RULES) {
    if (rule.pattern.test(haystack)) return rule.id;
  }

  const scores = CATEGORY_RULES.map((rule) => ({
    id: rule.id,
    hits: rule.patterns.reduce((n, p) => n + (p.test(haystack) ? 1 : 0), 0),
  }));

  const best = scores.reduce((a, b) => (b.hits > a.hits ? b : a), { id: 'etc', hits: 0 });
  return best.hits > 0 ? best.id : 'etc';
}

const CODE_SIGNALS =
  /#include|System\.out|public\s+class|public\s+static|def\s+\w*\(|printf|scanf|console\.log|std::|int\s+main|for\s*\(|while\s*\(|print\s*\(/;

const SQL_SIGNALS = /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bCREATE\s+(TABLE|VIEW|INDEX)\b|\bGRANT\b|\bREVOKE\b|\bALTER\b|\bDROP\b/i;

export function classifyQuestionType(input: ClassifyInput): string {
  const { question, code, answer } = input;

  // SQL문을 직접 쓰라는 문제
  if (/SQL\s?문(을|를)?\s*(작성|쓰|완성)/.test(question) || (SQL_SIGNALS.test(answer) && answer.length > 12)) {
    return 'sql';
  }

  // 코드를 주고 실행 결과를 묻는 문제
  if (CODE_SIGNALS.test(code) && /출력|실행\s?결과|결과를/.test(question)) return 'code_output';
  if (SQL_SIGNALS.test(code) && /출력|실행\s?결과|결과를/.test(question)) return 'code_output';

  // 설명을 문장으로 쓰라는 문제는 문자열 비교로 채점할 수 없다
  if (/서술하시오|설명하시오|약술하시오|기술하시오|이유를\s*(쓰|작성)/.test(question)) return 'descriptive';
  if (answer.length > 60 && !/\n/.test(answer)) return 'descriptive';

  // 한 낱말짜리 용어
  if (!/\s/.test(answer.trim()) && answer.trim().length <= 20) return 'term';

  return 'short_answer';
}
