# EasyFlow 로컬 문서 에이전트 사양

작성 기준: 2026-08-15
목표: 사용자가 한글 또는 LibreOffice에서 이미 열어 둔 문서를 계획 모드와 수정 모드로 안전하게 보완한다.

## 1. 제품 목표

업로드 → 서버 변환 → 다운로드 방식은 보조 경로로 유지한다. 주 사용 흐름은 현재 열려 있는 문서나 선택 영역을 읽고, 수정 계획을 먼저 확인한 뒤 승인된 변경만 원본 프로그램에 반영하는 것이다.

inlineAI의 공개 제품·학습 화면에서 참고할 핵심 UX는 다음과 같다.

- 설치된 한/글과 현재 활성 문서를 자동 감지해 그 창에서 바로 작업
- 실제 파일을 열고 지시한 뒤 결과를 반복해서 다듬는 학습 흐름
- 복잡한 표·머리말·꼬리말·중첩 표까지 문서 구조 단위로 처리
- 선택 영역만 전달하고 바뀐 부분을 비교한 뒤 변경별 수락·거절
- 편집 전 사용자 승인과 전체 파일 대신 필요한 최소 문맥만 모델에 전송

참고:

- https://www.inline-ai.com/blog/
- https://www.inline-ai.com/blog/courses/getting-started-online-training/
- https://www.inline-ai.com/feature/hwp/

프론트 협의용으로 `서식자료실_스마트 계획서 변환.html`에 교사 친화형
`예시 열기 → 바꿀 내용 적기 → 수정할 곳 고르기 → 문장 직접 수정 → 결과 미리보기` 흐름이 있다.
예시 흐름 자체는 실제 문서를 자동 수정하지 않는다. 같은 페이지의 자체 호스팅 `rhwp` 편집기는 별도
1차 기능으로 실제 HWP/HWPX를 브라우저에서 열고 편집해 HWP/HWPX 수정본을 내보낸다.

## 2. 구현 판정

브라우저만으로 업로드한 HWP/HWPX를 자체 호스팅 편집기에서 다루는 1차 기능은 구현했다. 다만 브라우저가
별도 데스크톱 한글 창에서 이미 열려 있는 문서를 제어할 수는 없다. 그 2차 기능에는 다음 구성요소가 필요하다.

```text
EasyFlow 웹/백엔드
  ├─ 인증·조직 권한
  ├─ RAG·정책·감사 로그
  └─ 구조화된 DocumentPatch 생성
             ↓
Windows 로컬 에이전트
  ├─ 승인 UI·백업·충돌 검사
  ├─ HancomAdapter: HWP/HWPX Automation
  └─ LibreOfficeAdapter: ODT UNO
             ↓
현재 활성 문서
```

한컴 Automation은 별도 라이선스와 보안 모듈 검토가 필요하다. 서버에서 HWP/HWPX를 처리하는 별도 경로는 한컴 HWP SDK 또는 문서 변환 제품을 검토한다.

- 한컴 Automation: https://developer.hancom.com/hwpautomation
- 한컴 HWP SDK: https://www.hancom.com/product/sdk/hwpSdk
- HWPX 포맷: https://tech.hancom.com/hwpxformat/
- WebHWP: https://developer.hancom.com/webhwp/devguide
- LibreOffice UNO XDesktop: https://api.libreoffice.org/docs/idl/ref/interfacecom_1_1sun_1_1star_1_1frame_1_1XDesktop.html
- ODF 1.3 패키지: https://docs.oasis-open.org/office/OpenDocument/v1.3/OpenDocument-v1.3-part2-packages.html

## 3. 실행 형태

1차 권장안은 Windows 데스크톱 에이전트다. 웹 화면과 연동해야 할 경우 다음 중 하나를 선택한다.

1. EasyFlow 웹을 데스크톱 셸에 포함한다. 로컬 문서 API가 외부 브라우저에 노출되지 않아 가장 단순하다.
2. 브라우저가 `easyflow://connect` 사용자 동작으로 에이전트를 실행하고, 짧은 수명의 연결 토큰으로 loopback 채널을 연다.
3. 브라우저 확장과 Native Messaging을 사용한다. 배포·업데이트 정책이 허용되는 조직에서만 선택한다.

loopback API를 사용할 경우 임의 웹사이트의 호출을 막기 위해 허용 Origin, 세션 nonce, 요청 서명, 만료 시간, 재사용 방지, 사용자 표시 승인을 모두 적용한다. 문서 제어 포트를 무인증으로 열어두지 않는다.

## 4. 사용자 모드

### 계획 모드

- 활성 문서·선택 영역·문서 형식·수정 가능 여부 확인
- 문서 원문 변경 없음
- 변경 대상, 근거, 예상 변경 전후를 목록으로 표시
- 문서가 계획 생성 후 바뀌면 계획을 폐기하고 다시 생성

### 수정 모드

- 사용자가 `한 번 허용` 또는 `거부`를 선택
- 초기 버전에는 `항상 허용`을 제공하지 않음
- 적용 직전 문서 지문과 기준 리비전 재검증
- 가능하면 하나의 실행 취소 단위로 적용
- 원본 저장 전 복구 가능한 백업 또는 새 버전 생성
- 적용 결과와 실패한 연산을 사용자에게 구분 표시

## 5. DocumentPatch 계약

모델은 한글 Automation 명령이나 임의 코드를 만들지 않는다. 서버는 허용 목록의 문서 연산만 반환한다.

```json
{
  "patchId": "ptc_...",
  "documentId": "local:sha256:...",
  "baseRevision": "sha256:...",
  "mode": "plan",
  "summary": "기관명과 회의 일정을 최신 값으로 바꾸고 공문체를 다듬습니다.",
  "operations": [
    {
      "id": "op_1",
      "op": "replace_text",
      "anchor": {
        "type": "selection",
        "beforeHash": "sha256:..."
      },
      "before": "기존 문장",
      "text": "수정 문장",
      "reason": "공문체 통일"
    },
    {
      "id": "op_2",
      "op": "set_field",
      "field": "기관명",
      "value": "OO초등학교",
      "reason": "로그인 소속 정보 반영"
    }
  ],
  "expiresAt": "2026-08-15T10:05:00Z"
}
```

초기 허용 연산:

- `replace_text`
- `insert_text_before`, `insert_text_after`
- `set_field`
- `insert_paragraph_after`
- `replace_table_cell`
- `append_table_row`

초기 금지 연산:

- 임의 Automation 메서드 호출
- 매크로 실행
- 외부 프로그램 실행
- 임의 파일 읽기·쓰기·삭제
- 승인되지 않은 다른 문서 열기
- 보호 구역·전자서명 영역 변경

## 6. 문서 식별과 충돌 방지

로컬 에이전트는 다음을 조합해 문서를 식별한다.

- 편집 프로그램 프로세스·창·문서 핸들
- 정규화된 로컬 경로의 해시
- 문서 크기·최종 수정 시각
- 선택 영역 또는 대상 블록의 해시
- 에이전트 자체 리비전 번호

계획의 `baseRevision`과 적용 직전 리비전이 다르면 `DOCUMENT_CHANGED`로 중단한다. 텍스트 검색으로 비슷한 문단을 임의 선택하지 않는다. 공공서식은 누름틀, 책갈피, 필드 이름 같은 안정적인 앵커를 우선 사용한다.

## 7. HWP/HWPX 어댑터

PoC에서 확인할 항목:

- 설치된 한글 버전 탐지
- 이미 실행 중인 한글의 활성 문서에 안정적으로 연결
- 선택 영역 읽기·바꾸기
- 누름틀/필드 읽기·설정
- 표 셀 탐색·수정
- 변경 내용 추적 또는 실행 취소 묶음 지원 여부
- 원본과 새 이름 저장
- HWP/HWPX/ODT로 다시 저장할 때 서식 보존 수준
- DRM, 암호화, 읽기 전용, 전자서명 문서의 명확한 거부

HWPX를 서버나 브라우저에서 직접 처리할 때는 ZIP/XML 패키지 무결성, `mimetype` 저장 방식, XML 네임스페이스, DTD/외부 엔터티 차단, 한컴 버전별 열기 테스트가 필요하다. 문자열 전체 치환보다 XML 노드 단위 편집을 사용한다.

## 8. ODT 어댑터

ODT 파일 패키지 자체의 생성·수정은 비교적 단순하지만, 이미 열려 있는 ODT를 바꾸려면 편집 프로그램 연결이 필요하다. 1차는 LibreOffice UNO의 활성 컴포넌트를 대상으로 구현한다.

- Writer 문서인지 확인
- 현재 선택 또는 북마크 범위 식별
- 텍스트·표·스타일 최소 편집
- 실행 취소 컨텍스트와 저장본 생성
- 외부 링크·매크로·임베디드 객체 실행 금지

한글에서 ODT를 연 경우 Automation을 통한 수정·ODT 재저장이 가능한지는 별도 호환성 시험 항목으로 둔다. 검증 전에는 지원한다고 표시하지 않는다.

## 9. 개인정보·보안

- 기본 입력은 현재 선택 영역과 사용자가 선택한 참고자료만 사용
- 학생·보호자·교직원 식별정보 탐지 및 전송 전 경고/마스킹
- 조직별 RAG 격리와 문서 접근권한 재검증
- 공급자 Zero Data Retention 또는 기관 내부 모델 검토
- 프롬프트·원문 전체를 일반 애플리케이션 로그에 기록하지 않음
- 감사 로그에는 문서 해시, 연산 종류, 승인자, 성공 여부만 우선 저장
- 로컬 히스토리는 사용자 삭제와 보존기간 정책 제공

## 10. 단계별 출시

### Phase 0 — 기술 검증

- Windows 1대, 지원 한글 버전 1종
- 활성 선택 영역 읽기
- 계획 미리보기
- 승인 후 선택 영역 교체
- 다른 이름으로 백업 저장

### Phase 1 — 내부 MVP

- 한글 버전 호환표
- 누름틀·책갈피·표 지원
- 조직 RAG 연결
- 리비전 충돌 차단
- 감사 로그와 중앙 정책

### Phase 2 — 확대

- ODT/LibreOffice 어댑터
- 문서 전체 초안·공문서 템플릿
- 여러 문서 비교·병합
- WebHWP 또는 서버 변환 보조 경로

## 11. Phase 0 완료 기준

- 이미 열려 있는 문서 100회 연결 시험에서 성공률 95% 이상
- 선택 영역 밖의 내용이 바뀌지 않음
- 변경 전후 diff와 실제 적용 결과가 일치
- 문서 변경 충돌을 100% 차단
- 실패 시 원본 훼손 없이 종료
- 승인 없이 쓰기 연산이 실행되지 않음
- 한글 종료·응답 없음·읽기 전용·DRM 상태를 사용자 메시지로 구분
- 설치·업데이트·코드서명·자동복구 방안 확정

## 12. 착수 전 의사결정

- 지원할 Windows와 한글 최소 버전
- 한컴 Automation/HWP SDK/WebHWP 라이선스 범위와 비용
- 웹+로컬 에이전트 또는 데스크톱 셸 중 배포 방식
- 외부 모델, 기관 전용 모델, 온프레미스 모델 중 개인정보 처리 경로
- ODT의 기준 편집 프로그램을 LibreOffice로 고정할지 여부
- 원본 덮어쓰기 허용 여부와 백업 보존기간

## 13. 프론트에서 확정한 문서 작업 계약

`서식자료실_스마트 계획서 변환.html`의 교사용 예시 흐름은 다음 동작을 실제 프론트 상태로 구현한다.

- 바꿀 항목 선택과 변경 전후 비교
- 제안 문장을 textarea에서 직접 수정
- 변경별 `이대로 반영`·`원래대로` 선택과 미결정 상태 차단
- 선택·수정 결과를 제목·일시·주요 내용 최종 미리보기에 반영
- 실제 파일 편집 영역으로 바로 이동

교사 화면에는 JSON·패치·리비전·영수증·I/O 같은 내부 용어를 노출하지 않는다. 백엔드 연결을 위해
`easyflow.document-patch/v1`과 `easyflow.document-apply-receipt/v1` 객체 생성 코드는 숨겨 유지한다.
예시 흐름은 실제 문서 I/O를 성공으로 가장하지 않는다.

동일 페이지의 실제 파일 편집은 `assets/js/web-hwp-editor.js`가 담당한다. `rhwp/`의 정적 편집기와
`assets/vendor/rhwp-editor/`의 `@rhwp/editor 0.8.2` 래퍼를 동일 출처로 불러오며, 선택한 문서 바이트는
서버 API나 제3자 편집 서버로 업로드하지 않는다. HWP 저장 전에는 `exportHwpVerify()`의 재로드·쪽 수
검사를 통과해야 한다. 반입 파일과 라이선스는 `THIRD_PARTY_NOTICES.md`를 단일 고지로 사용한다.

### 13.1 DocumentPatch 추가 필드

- `schema`: `easyflow.document-patch/v1`
- `evidence[]`: 근거 ID, 유형, 제목, 모델 전달 여부. RAG 근거는 문서 ID·페이지·문단 앵커를 포함한다.
- `preservationPolicy`: 승인 앵커 밖 변경 금지, 표·문단 스타일 보존, 리비전 일치, 복구 백업 조건
- `privacyPolicy`: 기본 입력 범위와 전체 문서 전송 여부
- `operationGroups[]`: 프론트에서 한 묶음으로 수락·거절할 그룹 ID
- `operations[].groupId`: 비교 행과 연산을 연결하는 ID
- `operations[].evidenceIds[]`: 수정 근거 연결
- `operations[].risk`: `low`, `review`, `blocked`와 구조화된 위험 코드

`review`는 사용자 확인 후 진행할 수 있지만 `blocked`가 하나라도 있으면 적용 토큰을 발급하지 않는다.

### 13.2 DocumentApplyReceipt 필수 필드

- `schema`: `easyflow.document-apply-receipt/v1`
- `receiptId`, `patchId`, `documentId`
- `outcome`: `applied`, `partial`, `rejected`, `failed`, `demo_only`
- `documentChanged`: 실제 쓰기 발생 여부
- `decisions[]`: 그룹·연산 ID별 `accept`, `reject`, `skipped`
- `revision.before/after/matchVerified`
- `validations.backup`
- `validations.packageIntegrity`
- `validations.reopenInHancom`
- `validations.visualLayout`
- `validations.untouchedParts`

검증 값은 `passed`, `failed`, `not_performed`, `not_applicable` 중 하나다. 실행하지 않은 검사를
`passed`로 채우지 않는다. 영수증 원문에는 문서 본문, 개인정보, 로컬 전체 경로를 넣지 않고 문서 해시,
연산 ID, 결과 코드만 우선 기록한다.

### 13.3 적용 순서

1. 프론트가 사용자가 수락한 `operationId`만 서버에 보낸다.
2. 서버가 세션·리비전·위험 코드를 다시 검증하고 짧은 수명의 적용 토큰을 발급한다.
3. 로컬 에이전트가 토큰에 포함된 연산만 한 번의 실행 취소 단위로 적용한다.
4. 로컬 에이전트가 실제 영수증을 프론트에 반환한다.
5. 프론트는 영수증을 표시하고, 민감정보를 제거한 사본만 서버 감사 로그로 전송한다.

## 14. GitHub 참고 구현과 라이선스 도입 기준

확인 기준일은 2026-08-16이다. 저장소의 공개 여부나 비상업 개발이라는 사실만으로 코드 사용 권한이
생기지 않는다. 실제 도입 전에는 사용할 태그 또는 커밋의 라이선스와 전이 의존성을 다시 고정해
`THIRD_PARTY_NOTICES.md`, SBOM, 배포물의 라이선스 고지에 기록한다.

구분은 다음과 같다.

- **도입 후보**: 현재 저장소에서 MIT 또는 Apache-2.0을 확인했지만, 고지와 의존성 감사를 거쳐야 한다.
- **조건부 후보**: 라이선스 선언은 있으나 루트 라이선스 파일 또는 배포 단위 확인이 더 필요하다.
- **설계 참고만**: 코드를 복사·수정·번들·의존성으로 추가하지 않고 기능 개념만 독립 구현한다.
- **비프로덕션 평가만**: 실제 사용자나 조직 업무에 제공하는 운영 사용은 별도 허가 전 금지한다.

### 14.1 도입 후보와 기술 역할

| 저장소 | 확인한 라이선스 | EasyFlow 권장 역할 | 도입 조건 |
|---|---|---|---|
| [edwardkim/rhwp](https://github.com/edwardkim/rhwp) | 루트 `LICENSE`의 MIT | **1차 실제 반입**: 브라우저 HWP/HWPX 열기·편집·두 형식 내보내기 | `@rhwp/editor 0.8.2`와 2026-08-16 정적 배포 스냅샷을 자체 호스팅. `THIRD_PARTY_NOTICES.md`의 해시·MIT·폰트 고지 보존. 한컴과 픽셀 동일하다고 주장 금지 |
| [DoHyun468/claw-hwp](https://github.com/DoHyun468/claw-hwp) | 루트 `LICENSE`의 MIT | 구조화 연산 어휘, 일괄 적용, 로컬 개인정보 채움 설계 | 자체 및 번들된 제3자 고지 유지, `@rhwp/core` 버전 감사, HWP 직접 패치는 코퍼스 통과 전 기본 경로 금지 |
| [airmang/python-hwpx](https://github.com/airmang/python-hwpx) | 루트 `LICENSE`의 Apache-2.0 | HWPX 원자적 패치, 실패 시 원본 보존, 변경 영수증 | 릴리스·커밋 고정, NOTICE·변경 고지, 실제 한컴 재열기 시험, 알파 API를 어댑터 뒤에 격리 |
| [chrisryugj/kordoc](https://github.com/chrisryugj/kordoc) | 루트 `LICENSE`의 MIT | HWP/HWPX 파싱·비교·RAG 청크·서식 채우기 참고 또는 후보 | 라이선스 고지 포함, 정확도 주장은 EasyFlow 코퍼스로 재측정, 서명·도장 기능은 별도 권한 통제 |
| [neolord0/hwpxlib](https://github.com/neolord0/hwpxlib) | README와 `pom.xml`이 Apache-2.0 선언, 루트 LICENSE 파일은 미확인 | JVM 백엔드의 HWPX 객체 모델 또는 호환성 비교 엔진 | Maven 배포물의 라이선스 파일·전이 의존성 확인 전 소스 vendoring 금지 |
| [hancom-io/hwpx-owpml-model](https://github.com/hancom-io/hwpx-owpml-model) | `LICENSE.txt`의 Apache-2.0 | 공식 OWPML 저수준 모델과 테스트 참고 | C++·구형 빌드 환경을 고려하고, 레이아웃 엔진이 아니라는 경계를 유지 |

### 14.2 코드 도입 금지 또는 평가 전용

| 저장소·자료 | 확인 결과 | 허용 범위 | 금지선 |
|---|---|---|---|
| [chrisryugj/Docufinder](https://github.com/chrisryugj/Docufinder) | BSL 1.1, Additional Use Grant는 비프로덕션 개발·시험·평가만 허용, Change Date 2030-04-15, 이후 Apache-2.0 | 로컬 검색·OCR·버전 비교·근거 인용 UX 평가 | 현재 코드를 실제 사용자·학교 업무용 운영 서비스에 포함하거나 파생 배포 금지. 무료·비상업도 운영이면 자동 허용되지 않음 |
| [Canine89/hwpxskill](https://github.com/Canine89/hwpxskill) | 루트 LICENSE 파일을 확인하지 못함 | 안전 슬롯·페이지 예산·내용 잔재·공문 린트 개념의 독립 구현 | 소스·스크립트·문서 표현 복사, 수정, 번들, 설치 금지 |
| [jkf87/hwpx-skill](https://github.com/jkf87/hwpx-skill) | README 배지는 LICENSE를 가리키지만 루트 LICENSE 경로는 404로 확인됨 | HWPX 검수 흐름의 기능 요구사항 참고 | 라이선스 확보 전 ZIP·스크립트·템플릿을 제품 또는 개발환경에 복제·실행·배포 금지 |
| [jkf87/hwp2hwpx-python-refactor](https://github.com/jkf87/hwp2hwpx-python-refactor) | README에 '라이선스 검토 중', 루트 LICENSE 파일 미확인 | HWP→HWPX 변환 가능성 조사만 | 변환 코드 도입·수정·서비스 사용 금지 |
| `hwpx-skill-fixed.zip` | 로컬 ZIP은 원 저장소의 라이선스 증거가 아님 | 격리된 읽기 전용 감사 | 자동 설치·외부 clone·패키지 설치·프로젝트 복사 금지. 출처 커밋과 라이선스를 먼저 확인 |

### 14.3 한컴 기술은 오픈소스 라이선스와 별도

- 한컴 Automation은 한컴오피스가 설치되고 적법한 개인 또는 기업 라이선스를 가진 PC에서 구동하는
  로컬 어댑터로만 1차 검증한다.
- 개인 비상업 사용과 사내 자동화에 관한 공식 안내는 근거 URL·문의 답변·확인일을 별도 보관한다.
- 자동화 기능을 유료 솔루션으로 판매하거나 서버에 한컴오피스를 설치해 서비스를 제공하는 형태는
  한컴의 별도 승인·라이선스 확인 전 금지한다.
- WebHWP와 HWP SDK는 Automation과 다른 제품이다. 개발자 페이지에 무료 제한 문구가 보이지 않는다는
  이유로 무료라고 판단하지 않으며, 견적·계약·배포 범위를 서면 확인한 뒤 보조 경로로 도입한다.
- 공개 HWPX/OWPML 규격을 구현할 권리와 한컴 프로그램·SDK를 사용할 권리는 같은 것이 아니다.

### 14.4 의존성 반입 체크리스트

1. 저장소 URL, 태그, 커밋 SHA, 패키지 버전을 고정한다.
2. 해당 커밋의 LICENSE·NOTICE·저작권 헤더를 보관한다.
3. npm·PyPI·Maven·WASM·모델 파일·내장 템플릿까지 전이 라이선스를 SBOM으로 확인한다.
4. MIT 전문, Apache-2.0 전문·NOTICE·수정 고지를 배포물에 포함한다.
5. GPL·AGPL·SSPL·BSL·Commons Clause·라이선스 없음이 발견되면 자동 빌드를 중단하고 재검토한다.
6. 정부 서식 샘플, 글꼴, 도장·서명 이미지, OCR 모델은 코드와 별도의 저작권·개인정보 자산으로 관리한다.
7. 상업화·외부기관 배포·SaaS 전환 시 전 항목과 한컴 라이선스를 다시 검토한다.

## 15. 권장 엔진 라우팅

| 입력·상태 | 1차 엔진 | 보조 엔진 | 원칙 |
|---|---|---|---|
| 한/글에서 열린 HWP/HWPX | 로컬 Hancom Automation 어댑터 | 없음 | 실제 활성 문서 상태와 한컴 조판을 기준으로 처리 |
| 닫힌 HWPX의 안전 패치·일괄 생성 | 자체 어댑터 뒤의 `python-hwpx` PoC | JVM이면 `hwpxlib` 비교 | 원자적 쓰기, 실패 시 원본 불변, 영수증 필수 |
| 업로드한 HWP/HWPX 브라우저 편집 | 자체 호스팅 `rhwp` WASM 편집기(1차 구현) | 서버 렌더 | 서버 업로드 없음, 원본 덮어쓰기 없음, 수정본 다운로드, 한컴과 픽셀 동일하다고 표시하지 않음 |
| 닫힌 HWP 바이너리 직접 패치 | 기본 비활성 | `claw-hwp`·`kordoc` 기술 PoC | 문서 코퍼스와 한컴 재열기 게이트 통과 후 기능 플래그로 제한 |
| 열린 ODT | LibreOffice UNO | ODF 패키지 직접 편집 | 한/글에서 연 ODT는 검증 전 지원으로 표시하지 않음 |
| 과거 문서 검색·유사 문서·페이지 근거 | EasyFlow 로컬 에이전트의 독립 색인 | 서버 조직 RAG | Docufinder 코드는 사용하지 않고 허용 폴더·근거 앵커·조직 격리를 자체 구현 |

서로 다른 라이브러리를 한 요청에서 연쇄 변환하지 않는다. 문서별로 한 쓰기 엔진을 선택하고 다른 엔진은
읽기 검증 또는 비교 판정에만 사용한다. 모든 외부 라이브러리는 `DocumentEngineAdapter` 뒤에 격리해
라이선스·안정성 문제 발생 시 교체할 수 있어야 한다.
