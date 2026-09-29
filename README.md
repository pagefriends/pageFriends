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

Supabase 없이도 볼 수 있는 화면: `/` 메인, `/pricing` 요금제, `/demo` **편집 화면 체험**(드래그·휠 줌·네모 그리기·요청 작성).
그 외(`/templates`, 로그인, 대시보드, 결제)는 Supabase 설정이 필요하다.

## 2. Supabase 설정

1. 프로젝트 생성 → Settings > API 에서 URL, anon key, service_role key 를 `.env.local` 에 넣는다.
2. SQL Editor 에서 `supabase/migrations/0001_init.sql` → `0002_admin.sql` → `0003_subscription_lifecycle.sql` → `0004_tokens_sites.sql` 순서로 실행 → 이어서 `supabase/seed.sql` 실행(템플릿 10개).
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

관리자는 `/admin` 에서 수정 요청을 묶음별로 보고, 상태(접수·처리중·반영 완료·반영 불가)를 바꾸고 답변을 적는다.
답변은 사용자의 "요청 내역" 화면에 표시된다. 관리자 쓰기는 `admin_*` RPC 로만 가능하며 DB 가 역할을 검사한다.

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
  (app)/               로그인 후: 대시보드 · 새 프로젝트 위저드 · 프로젝트 편집기 · 요청 내역 · 플랜/결제
  (admin)/admin        관리자: 수정 요청 목록(상태·유형·프로젝트 필터) · 요청 상세(영역 미리보기, 상태 변경, 답변)
  api/payments/*       주문 생성 · 완료 확정 · 구독(빌링키)
  api/webhooks/portone 포트원 웹훅
components/editor/     캔버스(줌·팬·네모 그리기/이동/크기조절) · 요청 패널 · 편집기 셸
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
- "한번에 요청하기"는 모든 페이지·디바이스의 네모를 한 묶음(batch)으로 보낸다. DB 함수 `submit_change_requests` 가 한도 검사 → 크레딧 차감 → 삽입을 한 트랜잭션으로 처리한다.

## 사용량 모델 (0004_tokens_sites.sql)

- **사이트 수**: 플랜별 동시 보유 사이트 수 (스타터 1 · 비즈니스 2 · 프로 5 · 엔터프라이즈 10, `Plan.maxSites`). `createProjectAction` 이 검사하고 대시보드가 남은 슬롯을 보여준다.
- **AI 반영 = 토큰**: 플랜별 월 토큰 한도 (`Plan.monthlyAiTokens`, 결제 기간 기준). 제출 시점에는 남은 토큰(한도 − 사용 + 크레딧)이 0 이면 막기만 하고,
  처리 시점에 `record_ai_usage(request_id, tokens, monthly_limit)` 로 실제 사용 토큰을 기록하면서 한도 초과분을 토큰 크레딧에서 차감한다.
  지금은 관리자 요청 상세의 "사용 토큰" 칸으로 기록하고, AI 파이프라인이 붙으면 같은 RPC 를 service role 로 호출한다. 사용량 조회는 `ai_token_usage(user_id)`.
- **전문가 요청 = 주간 횟수** (변경 없음). 초과분은 횟수 크레딧에서 제출 시 차감.
- **오류 신고 (`kind = 'bug'`)**: 무료. 한도·크레딧·토큰 어디에서도 차감하지 않는다.
- 크레딧 팩: AI 는 토큰(1만 토큰 180원 · 10만 토큰 1,400원), 전문가는 횟수(1회 8,900원 · 10회 64,900원). `credits.kind='ai'` 의 balance 는 토큰 수.
- 저장 좌표는 0~1 정규화 값이라 캡처를 다시 찍어 크기가 바뀌어도 위치가 유지된다.

### 구독 수명주기 (lib/subscriptions.ts)

- **활성화**: 빌링키로 첫 달 결제 → `activate_subscription` → 다음 달 결제를 포트원에 예약(`next_payment_id`, `portone_schedule_id` 저장). 예약 결제용 `payments` 행을 pending 으로 미리 만들어 웹훅이 금액을 대조한다.
- **갱신 성공** (웹훅 `Transaction.Paid`, paymentId `pf_sub_*`): 기간 1개월 연장, 실패 카운터 초기화, 다음 달 재예약.
- **갱신 실패** (`Transaction.Failed`): 상태 `past_due`, 3일 뒤 재시도 예약. 3회 연속 실패면 `cancelled` + 빌링키 삭제. 실패 후 7일 유예 동안은 서비스 이용 가능(`PAST_DUE_GRACE_DAYS`).
- **해지**: 예약만 취소하고 `cancel_at_period_end = true`. 기간 끝까지 이용 가능, 그 전엔 "해지 취소"로 되돌릴 수 있다.
- **결제 수단 변경**: 새 빌링키 발급 → 저장. 미납 상태면 즉시 재결제, 아니면 다음 예약을 새 카드로 교체. "지금 다시 결제"는 등록된 카드로 즉시 시도.
- **만료 판정은 읽는 쪽**(`effectiveSubscription`)에서 한다 — 크론이 없어도 기간이 지나면 플랜이 자동으로 비활성이 된다.
- 로컬(`PAYMENTS_MOCK=true`)에서는 결제 페이지의 "갱신 성공/실패" 버튼이 웹훅을 흉내 낸다(`/api/payments/dev/renewal`).

### 아직 연결하지 않은 것 (다음 단계)

- 실제 AI 사이트 생성·캡처 파이프라인: 지금은 `project_pages.screenshots` 에 샘플 SVG 를 넣는다. 실제 캡처 URL 과 크기만 넣으면 편집기는 그대로 동작한다.
- 결제 실패·해지 알림 메일: 지금은 결제 페이지 배너로만 알린다.
