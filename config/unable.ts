/**
 * AI 가 바로 할 수 없는 요청의 갈래 (2026-11-24 사용자와 정함). 모든 요청은 AI 가 먼저 보고, 할 수 없으면 아래 넷 중 하나로 안내한다.
 * 어느 갈래든 토큰은 깎지 않는다.
 *
 *   later    아직 AI 기능이 없어서 못 하는 것 (구역 추가 · 순서, 메뉴 · 페이지, 폼 항목, 지도 · 영상 …) — 차례로 AI 가 하게 만든다.
 *            그 전까지는 담당자가 이어서 해 준다 (추가 토큰 없음).
 *   connect  서류나 고객 계정이 있어야 하는 것 (결제 · 알림톡 · 문자 · 소셜 로그인 · 도메인 · 외부 서비스) — 필요한 서류를 안내한다.
 *            고객이 서류를 보내면 관리자가 처리하고 연결 키를 넣고, AI 가 사이트에 붙인다.
 *   review   사람이 확인해야 하는 것 (사실 확인 · 법이 정한 표현 · 로고 디자인) — 전문가 검수 요청으로 안내한다.
 *   consult  서비스 범위 밖 (모바일 앱 · 맞춤 업무 시스템 · 다른 사이트 베끼기) — 상담으로 안내한다.
 */

export const UNABLE_KINDS = ["later", "connect", "review", "consult"] as const;
export type UnableKind = (typeof UNABLE_KINDS)[number];

export const CONNECT_KINDS = ["payment", "alimtalk", "sms", "social_login", "domain", "external"] as const;
export type ConnectKind = (typeof CONNECT_KINDS)[number];

/** 연결마다 이름 · 고객이 준비할 것 */
export const CONNECTIONS: Record<ConnectKind, { label: string; needs: string[] }> = {
  payment: { label: "결제", needs: ["사업자등록증", "통신판매업 신고증", "정산받을 통장 사본", "대표자 신분증 사본"] },
  alimtalk: { label: "카카오 알림톡", needs: ["카카오톡 채널 (비즈니스 인증)", "보낼 알림 문구 (카카오 심사에 며칠 걸려요)"] },
  sms: { label: "문자 보내기", needs: ["보내는 번호의 통신서비스 이용증명원", "사업자등록증"] },
  social_login: { label: "카카오 · 네이버 로그인", needs: ["카카오 · 네이버 개발자 계정 (앱 등록은 안내해 드려요)", "개인정보 처리방침 주소"] },
  domain: { label: "내 도메인 연결", needs: ["도메인을 산 곳의 로그인 (주소 설정을 바꿀 수 있어야 해요)"] },
  external: { label: "외부 서비스 연결", needs: ["연결할 서비스의 관리자 계정 · 연결 권한"] },
};

export const UNABLE_LABEL: Record<UnableKind, string> = {
  later: "담당자가 이어서",
  connect: "연결 필요",
  review: "전문가 검수",
  consult: "상담 필요",
};

/** 고객에게 보여 줄 안내 (AI 의 설명 뒤에 붙는다) */
export function unableGuide(kind: UnableKind, connect: ConnectKind | null): string {
  switch (kind) {
    case "later":
      return "AI가 아직 할 수 없는 작업이라 담당자가 이어서 해 드려요. 토큰은 깎지 않아요.";
    case "connect": {
      const c = CONNECTIONS[connect ?? "external"];
      return `${c.label}을(를) 연결하려면 이런 것이 필요해요: ${c.needs.join(", ")}. 메시지로 보내 주시면 담당자가 연결을 준비하고, 연결되면 AI가 사이트에 바로 붙여요. 토큰은 깎지 않아요.`;
    }
    case "review":
      return "사람이 확인해야 하는 내용이라 '전문가 검수 요청'으로 보내 주세요. 토큰은 깎지 않아요.";
    case "consult":
      return "페이지프렌즈에서 바로 만들 수 있는 범위 밖이라 상담으로 도와드릴게요 (상담 신청 메뉴). 토큰은 깎지 않아요.";
  }
}
