/** 只比较编译产物，楼层内容和运行中的变量变化不会触发舞台重载。 */
export function getFrontendRevision(document: Document): string {
  const sources = [
    ...Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .filter(css => css.includes('.cultivation-status')),
    ...Array.from(document.querySelectorAll('script[type="module"]:not([src])'))
      .map(script => script.textContent ?? '')
      .filter(code => code.includes('__webpack_require__')),
  ];
  if (sources.length === 0) return '';
  let hash = 2166136261;
  let length = 0;
  for (const source of sources) {
    length += source.length;
    for (let index = 0; index < source.length; index += 1) {
      hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    }
  }
  return `bright-test-${length}-${(hash >>> 0).toString(16)}`;
}
