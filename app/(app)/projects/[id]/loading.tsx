import { LoaderCircleIcon } from "lucide-react";

/** 탭을 옮길 때 가운데에만 보이는 불러오는 중 표시 (위쪽 줄 · 왼쪽 목록 · 오른쪽 칸은 layout.tsx 그대로) */
export default function ProjectTabLoading() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 py-24 text-sm text-ink-500">
      <LoaderCircleIcon className="size-4 animate-spin" /> 불러오는 중…
    </div>
  );
}
