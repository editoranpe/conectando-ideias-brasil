/** Validate builder documents before saving or publishing.
 * No arbitrary HTML, scripts or CSS are accepted. */
export const WIDGET_TYPES = ['heading','text','image','button','features','quote','faq','signup','divider','spacer'] as const;
export type BuilderWidget = {
  id: string; type: typeof WIDGET_TYPES[number]; title?: string; text?: string;
  image?: string; url?: string; label?: string; align?: string;
  fontSize?: number; color?: string; background?: string;
  items?: Array<{ title?: string; text?: string }>;
};
export type BuilderSection = {
  id: string; label: string; columns: number; background: string;
  color: string; padding: number; backgroundImage?: string;
  widgets: BuilderWidget[];
};
export type BuilderPage = {
  title: string; font: string; headerColor: string; accentColor: string;
  sections: BuilderSection[];
};
const safeColor = (x: unknown): x is string => typeof x === 'string' && /^#[\da-fA-F]{6}$/.test(x);
const safeUrl = (x: unknown): boolean => typeof x !== 'string' || x === '' || (x.length <= 800 && (/^https:\/\//i.test(x) || /^\/(?!\/)/.test(x) || /^#[\w-]+$/.test(x)));
const textLen = (x: unknown, max: number): boolean => x === undefined || (typeof x === 'string' && x.length <= max);
export function validatePage(input: unknown): input is BuilderPage {
  if (!input || typeof input!=='object' || Array.isArray(input)) return false;
  const p = input as BuilderPage;
  if (!textLen(p.title,120) || typeof p.title!=='string' || !['sans','serif','modern'].includes(p.font) ||
      !safeColor(p.headerColor) || !safeColor(p.accentColor) || !Array.isArray(p.sections) ||
      p.sections.length < 1 || p.sections.length > 35) return false;
  let total=0;
  const ids=new Set<string>();
  for (const section of p.sections) {
    if (!section || typeof section!=='object' || typeof section.id!=='string' || !/^[\w-]{4,64}$/.test(section.id) ||
        ids.has(section.id) || !textLen(section.label,90) || ![1,2,3].includes(section.columns) ||
        !safeColor(section.background) || !safeColor(section.color) ||
        !Number.isInteger(section.padding) || section.padding < 16 || section.padding > 160 ||
        !safeUrl(section.backgroundImage) || !Array.isArray(section.widgets) || section.widgets.length > 24) return false;
    ids.add(section.id);
    for (const w of section.widgets) {
      total++;
      if (!w || typeof w.id!=='string' || !/^[\w-]{4,64}$/.test(w.id) || ids.has(w.id) ||
          !WIDGET_TYPES.includes(w.type) || !textLen(w.title,160) || !textLen(w.text,4000) ||
          !textLen(w.label,100) || !safeUrl(w.image) || !safeUrl(w.url) ||
          (w.color && !safeColor(w.color)) || (w.background && !safeColor(w.background)) ||
          (w.fontSize!==undefined && (!Number.isInteger(w.fontSize) || w.fontSize<10 || w.fontSize>90)) ||
          (w.align && !['left','center','right'].includes(w.align)) ||
          (w.items && (!Array.isArray(w.items) || w.items.length>15 || w.items.some(x=>!x || !textLen(x.title,160) || !textLen(x.text,1200))))) return false;
      ids.add(w.id);
    }
  }
  return total<=150 && JSON.stringify(p).length <= 120_000;
}
