/**
 * 글 속의 웹 주소(http · https)를 누를 수 있는 링크로 바꿔 보여 준다. 나머지 글자는 그대로 둔다.
 * "웹사이트에 적용했어요 … https://…" 처럼 담당자가 보낸 주소를 바로 열 수 있게. 다른 형식(javascript: 등)은 링크로 만들지 않는다.
 */
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
// 문장 끝에 붙은 문장부호 · 닫는 괄호는 주소가 아니다 ("주소(https://a.com)." → "https://a.com")
const TRAILING = /[.,!?;:)\]}>]+$/;

export function Linkified({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = match[0].replace(TRAILING, "");
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-brand-600 underline hover:text-brand-700">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
