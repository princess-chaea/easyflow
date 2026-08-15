# EasyFlow 백엔드 API 계약 초안

작성 기준: 2026-08-15
상태: 프론트엔드-백엔드 구현 경계 확정용 초안

이 문서는 현재 정적 프론트엔드의 `localStorage`, 하드코딩 목록, 외부 API 직접 호출을 서버 API로 교체할 때의 공통 계약이다. 세부 도메인 모델과 과거 프론트 이력은 `BACKEND_HANDOFF.md`, 열려 있는 HWP/HWPX/ODT 편집 기능은 `DOCUMENT_AGENT_SPEC.md`를 따른다.

## 1. 공통 규칙

- 기본 경로: `/api`
- 인증: `HttpOnly`, `Secure`, `SameSite=Lax` 세션 쿠키 우선. 토큰을 `localStorage`에 저장하지 않는다.
- 상태 변경 요청: CSRF 토큰 또는 동일 출처 검증을 적용한다.
- 모든 권한 검사는 서버가 세션의 사용자·조직·역할로 다시 수행한다.
- 시간: 저장은 UTC ISO 8601, 표시만 `Asia/Seoul`로 변환한다.
- ID: 화면 순번과 분리된 UUID/ULID를 권장한다.
- 목록 응답은 기본 20건, 최대 100건으로 제한한다.
- 모든 쓰기 API는 감사 로그에 `actor`, `organization`, `resource`, `action`, `before`, `after`, `createdAt`을 남긴다.

### 성공 응답

```json
{
  "data": {},
  "meta": {
    "requestId": "req_..."
  }
}
```

현재 NEIS·AI 프론트 코드는 이행 편의를 위해 각각 `{ "schools": [] }`, `{ "schedules": [] }`, `{ "text": "..." }`, `{ "data": {} }`도 허용한다. 백엔드 공통 래퍼 적용 시 프론트 어댑터에서 한 번만 정규화한다.

### 프론트 협의용 데모 폴백

프론트 소스에서 제거할 것은 외부 공급자 키와 직접 호출이지 사용자 흐름이 아니다. 현재 학교 검색·스마트 공문 달력은 동일 출처 API를 먼저 호출하고, 연결 실패 시 로컬 `file:` 실행 또는 `window.EF_CONFIG.demoFallback === true`인 환경에서만 결정론적 데모 결과를 표시한다. HTTP(S) 환경은 설정이 없으면 데모가 꺼지는 fail-closed 방식이다.

- 개발·협의 환경: `demoFallback: true`
- 운영 환경: `demoFallback: false`
- 데모 학교 코드는 `DEMO-` 접두어, 데모 일정·AI 결과는 화면에 `데모` 표기를 붙인다.
- 백엔드는 데모 코드를 실재 조직 코드로 받아 저장하지 않는다.
- 운영에서 상류 API가 실패하면 데모로 가장하지 않고 표준 오류 응답과 재시도 UI를 사용한다.
- 프론트 데모 응답 형태는 실제 API 응답 계약과 동일하게 유지해 연결 시 UI를 다시 만들지 않는다.

협의회 확인 절차는 `FRONTEND_REVIEW_GUIDE.md`를 따른다.

### 오류 응답

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해주세요.",
    "fields": {
      "title": "필수 항목입니다."
    },
    "requestId": "req_..."
  }
}
```

공통 오류 코드는 `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `RATE_LIMITED`, `FILE_REJECTED`, `MALWARE_DETECTED`, `DOCUMENT_CHANGED`, `DOCUMENT_UNSUPPORTED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR`를 사용한다.

## 2. 인증·사용자·역할

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users?query=&role=&organizationId=&cursor=`
- `POST /api/role-requests`
- `GET /api/role-requests?status=pending&cursor=`
- `POST /api/role-requests/{id}/approve`
- `POST /api/role-requests/{id}/reject`

`GET /api/users/me`는 최소한 다음 필드를 제공한다.

```json
{
  "data": {
    "id": "usr_...",
    "email": "teacher@example.kr",
    "name": "홍길동",
    "organization": { "id": "org_...", "name": "OO초등학교" },
    "department": "교무실",
    "position": "교사",
    "roles": ["teacher"]
  }
}
```

## 3. 문의·멘토링

- `POST /api/inquiries`
- `GET /api/inquiries?mine=true&status=&cursor=`
- `POST /api/inquiries/{id}/answer`
- `POST /api/mentoring/threads`
- `GET /api/mentoring/threads?mine=true&status=&cursor=`
- `POST /api/mentoring/threads/{id}/messages`
- `POST /api/mentoring/threads/{id}/complete`
- `GET /api/mentors?category=`
- `GET /api/mentors/{id}/slots?from=&to=`
- `POST /api/appointments`
- `DELETE /api/appointments/{id}`

멘토링 상태값은 `new`, `in_progress`, `completed`, `cancelled`로 저장하고 한국어 표시는 프론트에서 매핑한다. 메시지는 HTML이 아니라 일반 텍스트 또는 서버에서 정화한 제한 Markdown으로 저장한다.

## 4. 업무배송·달력

- `POST /api/dispatches`
- `GET /api/dispatches?category=&department=&from=&to=&cursor=`
- `GET /api/dispatches/{id}`
- `POST /api/dispatches/{id}/reads`
- `POST /api/dispatches/{id}/bookmarks`
- `DELETE /api/dispatches/{id}/bookmarks`
- `GET /api/calendar/events?from=&to=&department=`
- `POST /api/calendar/events`
- `PATCH /api/calendar/events/{id}`
- `DELETE /api/calendar/events/{id}`

한 번의 업무발송은 `dispatch` 한 건으로 저장하고 대상 부서·업무 분야는 관계 테이블로 분리한다. 읽음 상태는 수신자별 `dispatch_reads`로 저장한다.

## 5. NEIS 프록시

프론트에는 NEIS 키를 내려주지 않는다. 서버에서 응답 캐시·호출 제한·타임아웃을 적용한다.

### 학교 검색

`GET /api/neis/schools?query=아천초&officeCode=R10&limit=12`

```json
{
  "schools": [
    {
      "SCHUL_NM": "아천초등학교",
      "SCHUL_KND_SC_NM": "초등학교",
      "LCTN_SC_NM": "경상북도",
      "ORG_RDNMA": "...",
      "ATPT_OFCDC_SC_CODE": "R10",
      "ATPT_OFCDC_SC_NM": "경상북도교육청",
      "SD_SCHUL_CODE": "..."
    }
  ]
}
```

### 학사일정

`GET /api/neis/schedules?officeCode=R10&schoolCode=...&from=20260801&to=20260831`

```json
{
  "schedules": [
    {
      "AA_YMD": "20260817",
      "EVENT_NM": "개학식",
      "EVENT_CNTNT": "",
      "SBTR_DD_SC_NM": "해당없음"
    }
  ]
}
```

## 6. AI·RAG

- `POST /api/ai/generate`
- `POST /api/ai/chat/sessions`
- `GET /api/ai/chat/sessions?cursor=`
- `POST /api/ai/chat/sessions/{id}/messages`
- `GET /api/rag/sources?scope=organization`
- `POST /api/rag/sources`
- `POST /api/rag/sources/{id}/reindex`
- `GET /api/ai/jobs/{id}`

일정 도우미 텍스트 응답:

```json
{
  "task": "calendar-assistant",
  "prompt": "...",
  "systemPrompt": "...",
  "responseFormat": "text"
}
```

```json
{ "text": "정리된 답변" }
```

일정 추출 응답은 `responseFormat: "json"`을 사용하고 `{ "data": { "events": [] } }`로 반환한다. 서버는 모델 출력 JSON을 스키마로 검증한 뒤 반환한다.

## 7. 파일·문서

- `POST /api/files` — 작은 파일용 multipart 업로드
- `POST /api/files/upload-intents` — 대용량 객체 스토리지 업로드 URL 발급
- `GET /api/files/{id}` — 권한 검사 후 다운로드 또는 짧은 만료 URL 반환
- `POST /api/documents/draft`
- `POST /api/documents/convert`
- `GET /api/document-jobs/{id}`
- `GET /api/templates`
- `POST /api/templates/{id}/render`

필수 검증:

- 허용 확장자와 실제 MIME/파일 시그니처 일치
- HWP/HWPX/ODT/PDF 최대 크기 정책
- 악성코드 검사, ZIP 폭탄·경로 순회 차단
- HWPX/ODT XML의 DTD·외부 엔터티 비활성화
- 암호화·DRM 문서는 명확한 `DOCUMENT_UNSUPPORTED` 처리
- 원본·산출물의 조직별 격리, 보존기간, 삭제 정책
- 같은 변환 요청의 중복 실행을 막는 idempotency key

## 8. 로컬 문서 에이전트

- `POST /api/document-agent/sessions`
- `POST /api/document-agent/plan`
- `POST /api/document-agent/apply-tokens`
- `POST /api/document-agent/results`
- `GET /api/document-agent/receipts/{receiptId}`
- `POST /api/document-agent/audit-events`

백엔드는 문서 전체 바이너리를 무조건 받지 않는다. 사용자가 승인한 선택 영역과 필요한 최소 RAG 문맥을 입력으로 받고 구조화된 `DocumentPatch`를 반환한다. 상세 프로토콜·보안·승인 흐름은 `DOCUMENT_AGENT_SPEC.md`를 따른다.

`POST /api/document-agent/plan`은 `easyflow.document-patch/v1`을 반환한다. 각 연산은
`groupId`, `evidenceIds`, `risk`를 포함하고 계획 전체는 `preservationPolicy`와
`privacyPolicy`를 포함한다.

`POST /api/document-agent/apply-tokens` 요청에는 사용자가 수락한 `operationIds[]`만 넣는다.
서버는 세션·문서 리비전·연산 소유권·`blocked` 위험 여부를 재검증하고, 해당 연산 ID에만 유효한
짧은 수명의 일회용 토큰을 반환한다.

로컬 에이전트는 적용 후 `easyflow.document-apply-receipt/v1`을 프론트에 반환한다. 프론트는
민감정보와 로컬 전체 경로를 제거한 영수증만 `POST /api/document-agent/results`로 보낸다.
`not_performed` 검사를 성공으로 변환하지 않으며 `demo_only` 결과는 실제 적용 건수에 집계하지 않는다.

## 9. localStorage 교체 원칙

| 현재 키 | 백엔드 대상 |
|---|---|
| `currentUser`, `currentRole`, `grantedRoles_*` | 세션, users, user_roles |
| `roleRequests` | role_requests |
| `ef_inquiries` | inquiries, inquiry_messages |
| `ef_mentoring`, `ef_mentor_roster` | mentoring_threads/messages, mentor_assignments |
| `ef_mentor_slots`, `ef_appointments` | mentor_slots, appointments |
| `ef_mail_data` | dispatches, dispatch_targets, dispatch_reads |
| `ef_events`, `ef_done` | calendar_events, task_completions |
| `ef_chat_history_*` | chat_sessions, chat_messages |
| `ef_checklist_progress_*` | checklist_runs, checklist_answers |
| `ef_notices` | notices |
| `ef_saved_resources` | saved_resources |
| `ef_footer_*`, `ef_contact_*`, `ef_dpo_*` | site_settings |
| `ef_security_*` | 서버 보안 정책 저장소 및 감사 로그 |

## 10. 백엔드 완료 정의

- API 명세가 OpenAPI로 생성되고 프론트 타입/클라이언트가 자동 생성된다.
- 조직 A 사용자가 조직 B 자원에 접근할 수 없는 통합 테스트가 있다.
- 관리자 쓰기 API는 역할·조직·감사 로그 테스트가 있다.
- 파일 업로드 실패, 중복 요청, 변환 타임아웃, 모델 오류가 사용자에게 구분되어 표시된다.
- 프론트 소스와 네트워크 응답 어디에도 외부 공급자 키가 나타나지 않는다.
- 모델 응답과 저장된 사용자 데이터가 HTML로 무검증 삽입되지 않는다.
