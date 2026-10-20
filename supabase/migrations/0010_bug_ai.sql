-- =============================================================================
-- 오류 신고 AI + 프로필 권한 보안 수정
-- 적용: 0009 다음에 Supabase SQL Editor 에서 한 번 실행. 여러 번 실행해도 된다.
--
-- 바뀌는 것
-- 1) ai_runs.task 에 'bug' (오류 확인) 추가. 오류 신고가 들어오면 AI 가 먼저 확인한다:
--    최근 AI 변경 때문이면 그 변경을 되돌리고 · 테마 · 문구로 고칠 수 있으면 고치고 · 아니면 담당자(관리자)에게 넘긴다
--    (lib/ai/engine.ts processBugReport). 넘긴 오류 신고는 관리자 화면에 24시간 기한으로 보인다.
-- 2) 보안: 지금까지는 로그인한 사용자가 자기 프로필 행을 직접 고칠 수 있어 role 을 'admin' 으로 바꿀 수 있었다.
--    앱은 프로필을 브라우저에서 고치지 않으므로 사용자의 직접 수정 권한을 없앤다 (관리자 지정은 SQL Editor 에서만).
-- =============================================================================

alter table public.ai_runs drop constraint if exists ai_runs_task_check;
alter table public.ai_runs add constraint ai_runs_task_check check (task in ('build', 'edit', 'bug'));

drop policy if exists "profiles: own update" on public.profiles;
revoke update on public.profiles from anon, authenticated;
