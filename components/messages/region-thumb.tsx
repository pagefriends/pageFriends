import type { Region, Screenshot } from "@/lib/types/db";

/**
 * 요청한 네모 주변을 잘라 보여주는 작은 미리보기 (서버 컴포넌트). 어느 네모에 대한 대화인지 글만 보고 헷갈리지 않게 한다.
 * 좌표는 0~1 정규화 값이라 캡처 원본 크기(shot.width/height)로 되돌려 배치한다.
 */
export function RegionThumb({ shot, region, width = 132, height = 88 }: { shot: Screenshot; region: Region; width?: number; height?: number }) {
  // 네모 주변에 여백을 두고, 그 범위가 상자 안에 다 들어오는 축척을 고른다
  const padX = Math.max(region.w * 0.2, 0.02);
  const padY = Math.max(region.h * 0.2, 0.01);
  const cx = Math.max(0, region.x - padX);
  const cy = Math.max(0, region.y - padY);
  const cw = Math.min(1 - cx, region.w + padX * 2);
  const ch = Math.min(1 - cy, region.h + padY * 2);
  const scale = Math.min(width / (cw * shot.width), height / (ch * shot.height));
  const left = (width - cw * shot.width * scale) / 2 - cx * shot.width * scale;
  const top = (height - ch * shot.height * scale) / 2 - cy * shot.height * scale;

  return (
    <div className="relative shrink-0 overflow-hidden rounded border border-ink-200 bg-ink-100" style={{ width, height }} aria-hidden>
      <div className="absolute" style={{ left, top, width: shot.width * scale, height: shot.height * scale }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 원본 픽셀 기준 배치 */}
        <img src={shot.url} alt="" width={shot.width * scale} height={shot.height * scale} className="block max-w-none" />
        <div
          className="absolute border-2 border-mark"
          style={{ left: region.x * shot.width * scale, top: region.y * shot.height * scale, width: region.w * shot.width * scale, height: region.h * shot.height * scale }}
        />
      </div>
    </div>
  );
}
