import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 날짜는 항상 한국 시간으로 적는다. 시간대를 정하지 않으면 서버가 도는 곳의 시간대(운영 서버는 보통 UTC)로 찍혀
 * 대화 시각이 9시간 어긋나고, 서버와 브라우저가 다른 글자를 그려 화면이 어긋난다.
 */
const TIME_ZONE = "Asia/Seoul";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: TIME_ZONE });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}
