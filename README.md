# 페이지프렌즈 (pagefriends)

AI 웹사이트 제작 SaaS. 템플릿(데모 1,000원 / 운영 사이트 8,900원) 또는 프롬프트만으로 사이트를 만들고,
완성된 페이지 캡처 위에 **빨간 네모**를 그려 AI 반영·전문가 수정을 요청한다. 3~7일 안에 완성.

- Next.js 16 (App Router) · Tailwind v4 · Supabase (Auth + Postgres, `@supabase/ssr`) · 포트원 V2 (PG: 토스페이먼츠)
- 디자인은 [Design Pickle](https://designpickle.com) 을 벤치마킹: 짙은 네이비 바탕 + 하늘색 액센트 알약 버튼, 작은 대문자 눈썹 라벨 + 큰 굵은 헤드라인, 어두운/흰 섹션 교차, 큰 숫자 통계, 해시태그 칩, 4단계 커맨드 센터, 비교표, 좌(어두운 브랜드 패널)/우(흰 폼) 로그인. 색은 네이비·파랑·하늘색 + 무채색만. 폰트 Pretendard. 버튼은 알약, 카드는 12~16px.

## 1. 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 2·3 참고)
npm run dev                  # http://localhost:3000
```

Windows 에서 `An Application Control policy has blocked this file ... next-swc.win32-x64-msvc.node` 오류로 서버가 뜨지 않으면
(보안 정책이 Turbopack 의 네이티브 파일을 막은 경우) `npm run dev -- --webpack`, 빌드는 `npx next build --webpack` 으로 실행한다.

Supabase 없이도 볼 수 있는 화면: `/` 메인, `/pricing` 요금제, `/demo` **편집 화면 체험**(드래그·휠 줌·네모 그리기·요청 작성).
그 외(`/templates`, 로그인, 대시보드, 결제)는 Supabase 설정이 필요하다.

## 2. Supabase 설정

1. 프로젝트 생성 → Settings > API 에서 URL, anon key, service_role key 를 `.env.local` 에 넣는다.
2. SQL Editor 에서 `supabase/migrations/0001_init.sql` → `0002_admin.sql` → `0003_subscription_lifecycle.sql` → `0004_tokens_sites.sql` → `0005_inquiries.sql` → `0006_messages.sql` 순서로 실행 → 이어서 `supabase/seed.sql` 실행(템플릿 10개).
3. Authentication > Providers
   - Email: 켜기. 로컬 테스트는 "Confirm email" 을 꺼야 가입 즉시 로그인된다.
   - Google: Client ID/Secret 입력. Google Cloud 콘솔의 승인된 리디렉션 URI 에 `https://<ref>.supabase.co/auth/v1/callback` 추가.
4. Authentication > URL Configuration
   - Site URL: `http://localhost:3000` (운영은 실제 도메인)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<도메인>/auth/callback`

### 관리자 지정

가입한 계정을 관리자로 만들려면 SQL Editor 에서:

```sql
update public.profiles set role = 'admin' where email = '<이메일>';
```

관리자는 `/admin` 에서 수정 요청을 묶음별로 보고, 상태(접수·처리중·반영 완료·반영 불가)를 바꾸고 사용자에게 글을 보낸다.
글과 상태 변경은 요청마다 대화로 쌓여 사용자의 "요청 내역" 과 알림에 보이고, 사용자는 거기에 답글을 단다 (아래 "사용자 ↔ 관리자 대화").
관리자 쓰기는 `admin_*` RPC 로만 가능하며 DB 가 역할을 검사한다.

## 3. 포트원 V2 (토스페이먼츠)

1. 포트원 콘솔 > 결제 연동 > 토스페이먼츠 채널 추가(테스트 채널로 시작) → `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
2. 콘솔 > API 키 > V2 API Secret → `PORTONE_API_SECRET`
3. 콘솔 > 웹훅 > URL `https://<도메인>/api/webhooks/portone`, 시크릿 → `PORTONE_WEBHOOK_SECRET`
4. `APP_ENCRYPTION_KEY` 에 32자 이상 임의 문자열(빌링키 암호화)
5. 정기결제(구독)는 **빌링키** 방식이라 토스페이먼츠 채널에서 빌링키 발급이 가능해야 한다(계약 필요).

키가 없을 때는 `.env.local` 에 `PAYMENTS_MOCK=true` 를 두면 포트원 없이 결제가 성공 처리된다(개발 전용, production 에서는 무시됨).

## 4. 구조

```
app/
  (public)/            메인 · 템플릿 목록/상세 · 요금제 · /demo 체험
  (auth)/              로그인 · 회원가입 (좌: 브랜드 문구 / 우: 폼)
  (app)/               로그인 후: 대시보드 · 새 프로젝트 위저드 · 프로젝트 편집기 · 요청 내역(요청별 대화) · 메시지 · 플랜/결제
  (admin)/admin        관리자: 수정 요청 목록(할 일·확인 대기·상태·유형·프로젝트 필터) · 요청 상세(영역 미리보기, 대화, 상태 변경) · 사이트 메시지함
  api/payments/*       주문 생성 · 완료 확정 · 구독(빌링키)
  api/notifications    상단 바 알림 숫자 (사용자 · 관리자)
  api/webhooks/portone 포트원 웹훅
components/editor/     캔버스(줌·팬·네모 그리기/이동/크기조절) · 요청 패널(이미지 자리 목록 포함) · 편집기 셸
components/wizard/     새 사이트 위저드: 단계 화면 · 메뉴/하위 페이지 편집기 · 이미지 단계
components/brief/      제작 정보(위저드 입력) 보기 — 관리자 /admin/projects/[id] · 사용자 /projects/[id]/brief
lib/site-plan.ts       업종별 추천 메뉴 · 페이지 종류 · 이미지 자리 계획 (위저드와 서버가 같이 쓴다)
lib/draft-render.ts    구성 초안 그림(SVG) — app/api/drafts/[pageId]/[device] 가 그린다
components/messages/   대화 부품: 대화 줄기 · 입력칸 · 읽음 표시 · 알림 종 · 확인할 내용
config/plans.ts        플랜·크레딧·템플릿 가격 상수 (가격은 여기서만 바꾼다)
lib/                   env · supabase 클라이언트 · 인증 · 결제 · 포트원 · 한도 계산
supabase/              마이그레이션 · 시드
scripts/gen-samples.mjs 샘플 캡처 SVG 생성 (public/samples, config/samples.json)
```

### 앱 영역의 어두운 톤 (theme-dark)

대시보드·편집기·결제·관리자는 `app/globals.css` 의 `.theme-dark` 스코프 안에 있다. 이 스코프는 ink 계열·`surface`·연한 틴트(brand-50, sky-50, red-50 등) 토큰만 반전시키므로
페이지 코드는 흰 바탕과 같은 클래스(`bg-surface`, `text-ink-900`, `border-ink-200`)를 그대로 쓴다. 앱 영역에서는 `bg-white` 대신 반드시 `bg-surface` 를 쓰고,
`bg-ink-900` 위 글자는 `text-white` 가 아니라 `text-ink-50` 을 써야 반전 후에도 대비가 유지된다.

### 편집기 동작

- 이미지와 네모를 한 래퍼에 두고 래퍼에 `translate + scale` 을 건다. 네모 좌표는 **이미지 픽셀** 기준이므로 휠 줌을 해도 네모가 이미지와 같이 커지고 작아진다. 테두리·번호·핸들만 `1/zoom` 으로 역보정해 화면 크기를 유지한다.
- 도구: 이동(V) / 빨간 네모(R). 네모 hover 시 8방향 핸들로 크기 조절, 드래그로 이동, Delete 로 삭제.
- 왼쪽 디바이스(모바일·태블릿·웹)는 플랜이 허용하는 것만 활성. 아래 탭은 페이지 경로(홈, 안내, 리뷰, 상품, 관리자페이지…).
- 네모 하나 = 요청 하나. 캔버스의 N번 빨간 네모와 오른쪽 패널의 N번 카드가 1:1 이고, 카드/네모에 마우스를 올리면 서로 강조된다. 종류는 네모마다 따로 고른다 (AI 반영 · 전문가 요청 · 오류 신고).
- "요청하기"는 모든 페이지·디바이스의 네모를 한 묶음(batch)으로 보낸다. DB 함수 `submit_change_requests` 가 한도 검사 → 크레딧 차감 → 삽입을 한 트랜잭션으로 처리한다.

## 사용량 모델 (0004_tokens_sites.sql)

- **사이트 수**: 플랜별 동시 보유 사이트 수 (스타터 1 · 비즈니스 2 · 프로 5 · 엔터프라이즈 10, `Plan.maxSites`). `createProjectAction` 이 검사하고 대시보드가 남은 슬롯을 보여준다.
- **AI 반영 = 토큰**: 플랜별 월 토큰 한도 (`Plan.monthlyAiTokens`, 결제 기간 기준). 제출 시점에는 남은 토큰(한도 − 사용 + 크레딧)이 0 이면 막기만 하고,
  처리 시점에 `record_ai_usage(request_id, tokens, monthly_limit)` 로 실제 사용 토큰을 기록하면서 한도 초과분을 토큰 크레딧에서 차감한다.
  지금은 관리자 요청 상세의 "사용 토큰" 칸으로 기록하고, AI 파이프라인이 붙으면 같은 RPC 를 service role 로 호출한다. 사용량 조회는 `ai_token_usage(user_id)`.
- **전문가 요청 = 주간 횟수** (변경 없음). 초과분은 횟수 크레딧에서 제출 시 차감.
- **오류 신고 (`kind = 'bug'`)**: 무료. 한도·크레딧·토큰 어디에서도 차감하지 않는다.
- 크레딧 팩: AI 는 토큰(1만 토큰 180원 · 10만 토큰 1,400원), 전문가는 횟수(1회 8,900원 · 10회 64,900원). `credits.kind='ai'` 의 balance 는 토큰 수.
- 저장 좌표는 0~1 정규화 값이라 캡처를 다시 찍어 크기가 바뀌어도 위치가 유지된다.

## 사용자 ↔ 관리자 대화 (0006_messages.sql)

- **요청 대화**: 네모(요청) 하나마다 대화가 하나다. 관리자가 상태를 바꾸거나 글을 보내면 그 요청의 대화에 쌓이고, 사용자는 "요청 내역" 에서 요청마다 답글을 단다.
  답글은 토큰·횟수를 차감하지 않는다. 네모 미리보기와 번호를 같이 보여 어느 네모의 대화인지 섞이지 않는다.
- **확인 필요** (`change_requests.awaiting_user`): 관리자가 질문하며 "사용자의 답이 필요합니다" 를 켜면 사용자 화면에 "확인 필요" 로 뜬다. 사용자가 답글을 달면 자동으로 풀리고
  그 요청이 관리자의 "할 일" 로 돌아온다. 작업 상태(status)와 따로 둔다 — 상태는 "일이 어디까지 갔나", 이 값은 "누구 차례인가".
- **사이트 메시지**: 네모와 상관없는 대화 (`messages.request_id` 가 null). 사용자는 `/projects/[id]/messages`, 관리자는 `/admin/messages`. 프로젝트 상태를 바꾸면 안내가 자동으로 남는다.
- **읽음·알림**: `messages.read_at` 은 상대편이 읽은 시각이다. 화면에 실제로 뜬 글만 읽음 처리한다 (`components/messages/mark-read.tsx`).
  사용자: 상단 종 아이콘 + 대시보드 "확인할 내용" + 사이트 카드·편집기 상단의 숫자. 관리자: 상단 메뉴의 숫자 + "할 일" 탭 + "새 답글" 표시.
  숫자는 `/api/notifications` 를 주기적으로 불러 갱신하고, 대화 화면은 보고 있는 동안 20~45초마다 새로 받는다 (웹소켓 없음).
- **쓰기는 DB 함수로만**: `post_message` · `mark_messages_read` (사이트 소유자), `admin_reply_request` · `admin_update_batch` · `admin_post_message` · `admin_mark_messages_read` (관리자).
  읽기는 RLS 로 소유자와 관리자만. 알림 수는 `my_message_summary()` · `admin_message_summary()`.
- **0006 적용 전 DB** 에서는 대화 기능만 꺼지고 나머지는 예전처럼 동작한다 (답변 한 줄 저장). 관리자 화면에 적용 안내가 뜬다.

### 구독 수명주기 (lib/subscriptions.ts)

- **활성화**: 빌링키로 첫 달 결제 → `activate_subscription` → 다음 달 결제를 포트원에 예약(`next_payment_id`, `portone_schedule_id` 저장). 예약 결제용 `payments` 행을 pending 으로 미리 만들어 웹훅이 금액을 대조한다.
- **갱신 성공** (웹훅 `Transaction.Paid`, paymentId `pf_sub_*`): 기간 1개월 연장, 실패 카운터 초기화, 다음 달 재예약.
- **갱신 실패** (`Transaction.Failed`): 상태 `past_due`, 3일 뒤 재시도 예약. 3회 연속 실패면 `cancelled` + 빌링키 삭제. 실패 후 7일 유예 동안은 서비스 이용 가능(`PAST_DUE_GRACE_DAYS`).
- **해지**: 예약만 취소하고 `cancel_at_period_end = true`. 기간 끝까지 이용 가능, 그 전엔 "해지 취소"로 되돌릴 수 있다.
- **결제 수단 변경**: 새 빌링키 발급 → 저장. 미납 상태면 즉시 재결제, 아니면 다음 예약을 새 카드로 교체. "지금 다시 결제"는 등록된 카드로 즉시 시도.
- **만료 판정은 읽는 쪽**(`effectiveSubscription`)에서 한다 — 크론이 없어도 기간이 지나면 플랜이 자동으로 비활성이 된다.
- 로컬(`PAYMENTS_MOCK=true`)에서는 결제 페이지의 "갱신 성공/실패" 버튼이 웹훅을 흉내 낸다(`/api/payments/dev/renewal`).

### 아직 연결하지 않은 것 (다음 단계)

- 실제 AI 사이트 생성·캡처 파이프라인: 지금은 위저드 입력으로 그린 **구성 초안**(`/api/drafts/…`)을 캡처 자리에 넣는다 (예전 사이트는 샘플 SVG). 실제 캡처 URL 과 크기(+ 이미지 자리 위치 `slots`)만 넣으면 편집기는 그대로 동작한다.
- 실제 AI 이미지 생성: 위저드에서 고른 자리는 AI 반영 요청으로 접수되고, 지금은 담당자가 만들어 넣은 뒤 사용 토큰을 기록한다. 이미지 생성 API 를 붙이면 같은 요청을 처리하면 된다.
- 결제 실패·해지 알림 메일: 지금은 결제 페이지 배너로만 알린다.
- 대화 알림 메일 · 푸시: 새 답변·메시지는 로그인했을 때 화면 안에서만 알린다. 메일 발송 수단(SMTP · 메일 API)을 붙이면 `admin_reply_request` · `post_message` 호출 뒤에 보내면 된다.
- 대화에 파일 첨부 · 사진 올리기: 지금은 글만 주고받는다. "실제 사진 필요" 자리를 고객 사진으로 채우려면 파일을 받을 방법이 필요하다. Supabase Storage 버킷을 붙이면 된다.

## 새 사이트 위저드 · 구성 초안 · 이미지 자리

결제한 고객이 처음 거치는 화면 (`/projects/new`). 웹사이트를 처음 만드는 사람과 잘 아는 사람이 같은 입력을 만든다.

- **0 시작**: "처음이에요"(쉬운 모드: 설명 상자 · 선택 항목 접기) / "잘 알아요"(직접 구성: 페이지 종류 · 페이지별 메모 · 이미지 설명 고치기). 언제든 바꿀 수 있다. 설명만으로 / 구매한 템플릿으로.
- **1 회사 · 서비스**: 회사 이름 · 업종(칩 12종 또는 직접 입력 → 분류 추정) · 한 줄 소개(첫 화면 제목) · 제공하는 서비스·상품·솔루션(최대 8) · 하고 싶은 일(문의·예약·판매…) · 강점 · 주요 고객 · 연락처 · 회사 소개 글.
- **2 메뉴 · 페이지**: 업종 · 목적 · 서비스 · **플랜 페이지 수**(스타터 5 · 비즈니스 12 · 프로 30, 홈 포함)에 맞춘 추천 구성에서 시작한다(`recommendMenu`). 헤더 미리보기, 메뉴 순서·이름, **하위 페이지**(하위 페이지가 있는 메뉴는 자기 페이지가 없고 첫 하위 페이지로 간다), 자주 쓰는 메뉴 칩, 필요한 기능(페이지에서 자동 + 직접 선택).
- **3 디자인**: 톤 · 메인 색상(헤더 미리보기에 바로 반영) · 참고 사이트 · 추가 요청.
- **4 이미지**: "AI로 이미지 만들어 넣기" 체크. 켜면 **토큰을 많이 쓴다는 안내** + 예상치(장 수 × `APPROX_TOKENS_PER_IMAGE`, config/plans.ts, 지금 2만) + 남은 토큰 대비 %. 남은 토큰(한도 + 크레딧)보다 많으면 다음으로 못 간다(서버도 검사). 끄면 자리를 비워 두고 **자리마다 어떤 이미지가 필요한지** 적어 둔다. 대표·구성원·건물·상품·메뉴·작업물처럼 실제여야 하는 자리(`source: "real"`)는 켜도 AI 로 만들지 않는다.
- **5 확인** → 제작 시작. 입력은 브라우저에 임시 저장돼 새로 고침해도 이어서 쓸 수 있다.

만들 때 일어나는 일 (`createProjectAction`):

1. `buildSitePlan` 이 메뉴 → 실제 페이지(하위 페이지 포함, 주소 자동) → 이미지 자리 목록을 만든다. 결과는 `projects.brief.site`, 회사 정보는 `brief.business` (jsonb 라 **마이그레이션 없음**).
2. 페이지마다 화면별 **구성 초안**을 그려 캡처 자리에 넣는다: `screenshots[device] = { url: /api/drafts/{pageId}/{device}, width, height, draft: true, slots: [이미지 자리 위치] }`. 그림은 요청 때마다 brief 로 다시 그린다(RLS 로 주인·관리자만).
3. AI 로 만들기로 고른 자리마다 **AI 반영 요청**을 그 자리 위치에 한 묶음으로 접수한다(`submit_change_requests`). 토큰은 다른 AI 요청처럼 처리할 때 `record_ai_usage` 로 기록된다.

편집기에서: 왼쪽 페이지 목록이 메뉴 묶음대로 들여 써지고, 상단에 "구성 초안" 표시, 오른쪽 위 **"이 페이지의 이미지 자리"** 목록(상태 · 필요한 이미지 · 권장 크기). 항목에 마우스를 올리면 캔버스에서 그 자리가 강조되고, 누르면 그 자리로 이동한다. **"AI로 만들기"** 는 그 자리에 AI 반영 네모와 요청 글을 채워 준다(보내기 전에 고칠 수 있다).
관리자는 `/admin/projects/[id]` "제작 정보"에서 회사 정보 · 메뉴 구성(페이지 종류 · 메모) · 이미지 자리 전체를 본다. 사용자는 편집기 상단 "제작 정보"에서 같은 내용과 준비할 사진 목록을 본다.

## 공개 사이트 (디자인 피클 구조)

공개 페이지는 designpickle.com 의 정보 구조를 페이지 단위로 그대로 옮겼다 (헤더 메가메뉴 · 푸터 · 홈 · 플랫폼 · 요금제 · 이용 방법 · 비교 · 솔루션 14종 · 작업 사례 · 고객 사례 · 블로그 · 리소스 · 회사 소개 · 팀 · 채용 · 전문가 지원 · 실시간 채팅 · 상담 신청 · 도움말 · 약관 · 검색).

- 콘텐츠는 `content/site.ts` 한 곳에 있다. 내비 · 푸터 · 솔루션 · 후기 · 사례 · 글 · 팀 · 채용 · FAQ 전부.
- 사진은 전부 임시다. `node scripts/gen-placeholders.mjs` 가 `public/placeholders/*.svg` 와 `config/placeholders.json` 을 만든다. 실제 사진이 오면 같은 파일명으로 바꿔 끼우거나 `content/site.ts` 의 `ph()` 자리를 실제 경로로 바꾼다.
- 후기 · 고객 사례 · 블로그 글 · 팀 · 채용 공고는 `sample: true` 샘플이며 화면에 "샘플" 표시가 붙는다. 실제 콘텐츠로 교체해야 한다. 지어낸 실적 수치(고객 수 · 매출)는 넣지 않았다.
- 상담 신청 · 뉴스레터 · 전문가 지원 · 문의 폼은 `app/actions/inquiries.ts` → `inquiries` 테이블(0005). 관리자 화면 `/admin/inquiries` 에서 본다.
- 섹션 부품은 `components/marketing/primitives.tsx`(서버) · `interactive.tsx`(클라이언트). 헤더는 `components/site/nav.tsx`(메가메뉴 · 검색 · 모바일 드로어).

