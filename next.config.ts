import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 왜 끄나: Next 16 dev 서버가 AGENTS.md/CLAUDE.md 를 자동 생성한다. 규칙 문서는 README 하나로 유지한다.
  agentRules: false,
};

export default nextConfig;
