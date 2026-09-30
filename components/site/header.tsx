import { MegaNav } from "@/components/site/nav";
import { getSessionUser } from "@/lib/auth/session";

export { SiteFooter } from "@/components/site/footer";

/** 공개 페이지 상단 바 (서버에서 로그인 여부만 읽고, 메뉴 자체는 클라이언트 MegaNav) */
export async function SiteHeader() {
  const user = await getSessionUser();
  return <MegaNav signedIn={Boolean(user)} />;
}
