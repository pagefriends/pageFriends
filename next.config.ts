import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 왜 끄나: Next 16 dev 서버가 AGENTS.md/CLAUDE.md 를 자동 생성한다. 규칙 문서는 README 하나로 유지한다.
  agentRules: false,
  experimental: {
    // proxy.ts 가 있으면 요청 본문을 이 크기까지만 복사해 넘긴다 (기본 10MB, 넘으면 잘린 채 조용히 전달된다).
    // 사진 올리기(한 장 8MB 까지)가 잘리지 않게 여유를 둔다.
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
