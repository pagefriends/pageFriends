import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/card";
import { SUPPORT } from "@/content/site";

export const metadata: Metadata = { title: "개인정보처리방침" };

const UPDATED = "2026-09-30";

/** 초안. 법률 검토 전 임시 문구 — 확정본으로 교체해야 한다. */
const SECTIONS: { id: string; title: string; paras: string[] }[] = [
  { id: "overview", title: "총칙", paras: ["페이지프렌즈(이하 '회사')는 개인정보 보호법 등 관련 법령을 준수하며, 이용자의 개인정보를 안전하게 보호하기 위해 이 방침을 두고 있습니다.", "이 방침은 회사가 운영하는 웹사이트와 서비스(대시보드 · 편집기 · 결제 · 관리자 화면)에 적용됩니다."] },
  {
    id: "items",
    title: "수집하는 개인정보의 항목",
    paras: [
      "회원가입: 이메일, 비밀번호(암호화 저장), 이름 또는 표시 이름.",
      "결제: 결제 대행사(포트원 · 토스페이먼츠)가 발급한 결제 식별자와 빌링키 식별자. 카드번호 등 결제 정보 원문은 회사가 저장하지 않습니다.",
      "사이트 제작: 회원이 입력한 브리프(사이트 이름 · 업종 · 목적 · 참고 URL · 프롬프트), 업로드한 이미지 · 문구, 수정 요청 내용.",
      "상담 신청 · 문의 · 전문가 지원 · 뉴스레터: 이름, 이메일, 연락처, 회사 · 매장명, 문의 내용, 포트폴리오 URL, 경력.",
      "자동 수집: 접속 IP, 브라우저 종류, 접속 일시, 쿠키, 서비스 이용 기록.",
    ],
  },
  { id: "purpose", title: "개인정보의 수집 및 이용 목적", paras: ["회원 식별과 로그인, 서비스 제공(사이트 제작 · 수정 요청 처리 · 진행 상황 안내).", "요금 결제, 정기 결제 갱신, 환불 · 정산, 결제 오류 대응.", "상담 · 문의 답변, 전문가 지원 심사, 뉴스레터 발송(동의한 경우).", "서비스 개선, 부정 이용 방지, 법령상 의무 이행."] },
  { id: "method", title: "개인정보의 수집 방법", paras: ["회원가입 · 위저드 · 편집기 · 상담 신청 · 문의 폼 등 서비스 화면에서 이용자가 직접 입력.", "결제 대행사로부터 결제 결과 수신.", "서비스 이용 과정에서 자동 생성 · 수집."] },
  { id: "retention", title: "개인정보의 보유 및 이용 기간", paras: ["회원 정보: 회원 탈퇴 시까지. 다만 관련 법령에 따라 일정 기간 보관해야 하는 정보는 그 기간 동안 보관합니다.", "전자상거래 등에서의 소비자보호에 관한 법률: 계약 · 청약철회 기록 5년, 대금 결제 · 재화 공급 기록 5년, 소비자 불만 · 분쟁 처리 기록 3년.", "통신비밀보호법: 접속 기록 3개월.", "상담 · 문의 · 전문가 지원 기록: 처리 완료 후 1년. 뉴스레터: 구독 해지 시까지."] },
  { id: "third-party", title: "개인정보의 제3자 제공", paras: ["회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.", "다만 이용자가 사전에 동의한 경우, 법령에 특별한 규정이 있거나 수사기관이 적법한 절차에 따라 요청한 경우에는 예외로 합니다."] },
  { id: "processor", title: "개인정보 처리의 위탁", paras: ["회사는 서비스 제공을 위해 다음 업체에 개인정보 처리를 위탁합니다.", "Supabase: 데이터베이스 · 인증 · 파일 저장 (해외 이전 항목 참고).", "포트원 · 토스페이먼츠: 결제 처리 및 정기 결제.", "AI 모델 제공사: 브리프 · 수정 요청 문구를 사이트 초안 생성 목적으로 처리. 개인정보는 필요한 최소 범위로만 전달합니다.", "위탁 업체가 바뀌면 이 방침을 갱신하여 공지합니다."] },
  { id: "transfer", title: "개인정보의 국외 이전", paras: ["회사가 사용하는 클라우드 인프라(Supabase 등)의 서버가 해외에 위치할 수 있습니다. 이 경우 이전되는 항목, 국가, 일시 · 방법, 이전받는 자의 이용 목적과 보유 기간을 이 방침에 명시하고, 관련 법령이 요구하는 보호 조치를 취합니다.", "이전 국가 · 사업자 세부 정보는 확정 후 이 항목에 기재합니다."] },
  { id: "rights", title: "정보주체의 권리 · 의무 및 행사 방법", paras: [`이용자는 언제든 자신의 개인정보를 조회 · 수정 · 삭제하거나 처리 정지를 요구할 수 있습니다. 대시보드의 계정 설정 또는 ${SUPPORT.email} 로 요청하면 지체 없이 조치합니다.`, "만 14세 미만 아동의 개인정보는 수집하지 않으며, 확인되면 즉시 삭제합니다.", "법정대리인 또는 위임을 받은 자는 위임장을 제출하고 권리를 대신 행사할 수 있습니다."] },
  { id: "destroy", title: "개인정보의 파기 절차 및 방법", paras: ["보유 기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.", "전자적 파일은 복구할 수 없는 방법으로 삭제하고, 종이 문서는 분쇄 또는 소각합니다."] },
  { id: "cookies", title: "쿠키의 사용", paras: ["회사는 로그인 세션 유지와 서비스 이용 편의를 위해 쿠키를 사용합니다. 로그인에 필요한 필수 쿠키 외의 분석 · 광고 쿠키는 사용하지 않으며, 도입 시 이 방침을 갱신합니다.", "이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 기능을 이용할 수 없습니다."] },
  { id: "security", title: "개인정보의 안전성 확보 조치", paras: ["비밀번호 암호화 저장, 전송 구간 암호화(HTTPS), 데이터베이스 행 수준 접근 제어(RLS).", "관리자 권한 최소화 및 접근 기록 보관.", "결제 정보는 결제 대행사에서만 처리하며 회사 서버에 카드 정보 원문을 저장하지 않습니다."] },
  { id: "officer", title: "개인정보 보호책임자", paras: ["개인정보 보호책임자: (직위 · 성명은 확정 후 기재)", `연락처: ${SUPPORT.email} / ${SUPPORT.phone}`, "개인정보 관련 문의, 불만 처리, 피해 구제는 위 연락처로 접수해 주십시오."] },
  { id: "remedy", title: "권익 침해 구제 방법", paras: ["개인정보 침해에 대한 신고 · 상담은 개인정보침해신고센터(privacy.kisa.or.kr, 118), 개인정보 분쟁조정위원회(kopico.go.kr, 1833-6972), 대검찰청 사이버수사과(spo.go.kr, 1301), 경찰청 사이버수사국(ecrm.police.go.kr, 182)에 문의할 수 있습니다."] },
  { id: "changes", title: "방침의 변경", paras: ["이 방침의 내용이 추가 · 삭제 · 수정되는 경우 시행 7일 전부터 서비스 화면을 통해 공지합니다. 이용자에게 중요한 변경은 30일 전에 공지합니다.", `이 방침은 ${UPDATED}부터 시행됩니다.`] },
];

export default function PrivacyPage() {
  return (
    <section className="bg-white text-ink-900">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow text-brand-600">개인정보</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">개인정보처리방침</h1>
        <p className="mt-3 text-sm text-ink-500">최종 수정 {UPDATED}</p>
        <Alert tone="gray" className="mt-6">
          이 문서는 초안입니다. 법률 검토 후 확정본으로 교체해야 하며, 위탁 · 국외 이전 업체와 보호책임자 정보는 확정 후 채워야 합니다.
        </Alert>

        <nav aria-label="목차" className="mt-10 rounded-2xl border border-ink-200 bg-ink-50 p-6">
          <p className="text-sm font-bold">목차</p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-brand-600 hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold sm:text-2xl">
                {i + 1}. {s.title}
              </h2>
              <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-700">
                {s.paras.map((p, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-300" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-16 border-t border-ink-200 pt-8 text-sm text-ink-500">
          <p>
            관련 문서:{" "}
            <Link href="/terms" className="font-semibold text-brand-600 hover:underline">
              이용약관
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
