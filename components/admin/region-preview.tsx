import type { Region, Screenshot } from "@/lib/types/db";

/**
 * 요청된 네모 영역 미리보기 (서버 컴포넌트).
 * 왼쪽: 전체 페이지 축소본 위에 빨간 네모. 오른쪽: 네모 주변을 잘라 확대한 것.
 * 좌표는 0~1 정규화 값이라 캡처 원본 크기(shot.width/height)로 되돌려 배치한다.
 */
export function RegionPreview({ shot, region, seq }: { shot: Screenshot; region: Region; seq: number }) {
  // 전체 축소본: 폭 260px 고정
  const thumbW = 260;
  const thumbScale = thumbW / shot.width;
  const thumbH = Math.min(shot.height * thumbScale, 520);

  // 확대 크롭: 네모 주변에 여백(네모 크기의 25%)을 두고 폭 560px 에 맞춘다
  const padX = Math.max(region.w * 0.25, 0.02);
  const padY = Math.max(region.h * 0.25, 0.01);
  const cx = Math.max(0, region.x - padX);
  const cy = Math.max(0, region.y - padY);
  const cw = Math.min(1 - cx, region.w + padX * 2);
  const ch = Math.min(1 - cy, region.h + padY * 2);
  const cropW = 560;
  const cropScale = cropW / (cw * shot.width);
  const cropH = Math.min(ch * shot.height * cropScale, 480);

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="overflow-hidden rounded border border-ink-200 bg-ink-100" style={{ width: thumbW, height: thumbH }}>
        <div className="relative overflow-y-auto" style={{ width: thumbW, height: thumbH }}>
          <div className="relative" style={{ width: thumbW, height: shot.height * thumbScale }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 원본 픽셀 기준 배치 */}
            <img src={shot.url} alt="" width={thumbW} height={shot.height * thumbScale} className="block" />
            <div
              className="absolute border-2 border-mark"
              style={{ left: region.x * thumbW, top: region.y * shot.height * thumbScale, width: region.w * thumbW, height: region.h * shot.height * thumbScale }}
            />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded border border-ink-200 bg-ink-100" style={{ maxWidth: cropW, height: cropH }}>
        <div className="relative overflow-hidden" style={{ width: cropW, height: cropH }}>
          <div
            className="absolute"
            style={{ left: -cx * shot.width * cropScale, top: -cy * shot.height * cropScale, width: shot.width * cropScale, height: shot.height * cropScale }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.url} alt="" width={shot.width * cropScale} height={shot.height * cropScale} className="block max-w-none" />
            <div
              className="absolute border-2 border-mark"
              style={{ left: region.x * shot.width * cropScale, top: region.y * shot.height * cropScale, width: region.w * shot.width * cropScale, height: region.h * shot.height * cropScale }}
            >
              <span className="absolute -left-0.5 -top-[18px] bg-mark px-1.5 text-[11px] font-semibold leading-[18px] text-white">{seq}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
