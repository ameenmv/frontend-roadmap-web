/**
 * Turns the roadmap markdown (sibling repo) into app/data/content.json.
 * Run: bun scripts/build-content.ts [path-to-roadmap-repo]
 */
import { marked } from 'marked'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.argv[2] ?? join(import.meta.dir, '../../frontend-roadmap-2026-2027')
const GH = 'https://github.com/ameenmv/frontend-roadmap-2026-2027/blob/main'

interface WeekContent {
  n: number
  title: string
  video?: { href: string; thumb: string; label: string; meta: string }
  fields: { label: string; html: string }[]
  body: string
  checklist: string[]
}

const fixLinks = (html: string) =>
  html
    .replace(/href="#week-(\d+)"/g, 'href="/week/$1"')
    .replace(/href="((?:README|TRACKER|RESOURCES|0\d-[a-z]+)\.md[^"]*)"/g, `href="${GH}/$1"`)
    .replace(/<a href="http/g, '<a target="_blank" rel="noopener" href="http')

const inline = (md: string) => fixLinks(marked.parseInline(md.trim()) as string)

function parseSection(n: number, s: string): WeekContent {
  const cut = s.lastIndexOf('<div align="right">')
  if (cut > -1) s = s.slice(0, cut)
  const title = s.match(/^## Week \d+ · (.+)$/m)?.[1]?.trim() ?? `Week ${n}`
  s = s.replace(/^## Week .+$/m, '')

  const out: WeekContent = { n, title, fields: [], body: '', checklist: [] }

  const table = s.match(/<table>[\s\S]*?<\/table>/)
  if (table && table[0].includes('img.youtube.com')) {
    const t = table[0]
    const a = t.match(/<a href="([^"]+)"><img src="([^"]+)"/)
    const cap = t.match(/<br \/><b>(.+?)<\/b>\n<br \/>(.+)/)
    if (a) out.video = { href: a[1]!.replace(/&amp;/g, '&'), thumb: a[2]!.replace('mqdefault', 'hqdefault'), label: cap?.[1] ?? '', meta: cap?.[2] ?? '' }
    const right = t.split('<td valign="top">').pop()!.split('</td>')[0]!
    for (const para of right.split(/\n{2,}/)) {
      const p = para.trim()
      if (!p) continue
      const m = p.match(/^\*\*([^*]+?):\*\*\s*([\s\S]*)$/)
      if (m && m[1] === 'Watch') continue
      out.fields.push(m ? { label: m[1]!, html: inline(m[2]!) } : { label: '', html: inline(p) })
    }
    s = s.slice(s.indexOf(table[0]) + table[0].length)
  }

  // banners and separators
  s = s.replace(/<div align="center">[\s\S]*?<\/div>/g, '').replace(/^---\s*$/gm, '')

  // exit checklist -> interactive list
  s = s.replace(/<details>\s*<summary><b>.*?<\/b><\/summary>([\s\S]*?)<\/details>/g, (all, inner: string) => {
    const items = [...inner.matchAll(/^- \[ \] (.+)$/gm)].map((m) => inline(m[1]!))
    if (!items.length) return all
    out.checklist.push(...items)
    return ''
  })

  // GitHub alerts -> callouts
  s = s.replace(/^> \[!(\w+)\]\n((?:>.*\n?)+)/gm, (_all, type: string, inner: string) => {
    const md = inner.replace(/^> ?/gm, '')
    return `\n\n<div class="callout callout-${type.toLowerCase()}">\n\n${md}\n\n</div>\n\n`
  })

  out.body = fixLinks(marked.parse(s.trim(), { gfm: true }) as string)
  return out
}

function parseFile(file: string) {
  const text = readFileSync(join(SRC, file), 'utf8')
  const parts = text.split(/<a id="week-(\d+)"><\/a>/)
  const res: WeekContent[] = []
  for (let i = 1; i < parts.length; i += 2) res.push(parseSection(Number(parts[i]), parts[i + 1]!))
  return res
}

const content: Record<string, WeekContent> = {}
for (const w of [...parseFile('README.md'), ...parseFile('01-beginner.md'), ...parseFile('02-intermediate.md'), ...parseFile('03-react.md')]) content[String(w.n)] = w
for (const w of parseFile('03-vue.md')) content[`${w.n}-vue`] = w

writeFileSync(join(import.meta.dir, '../app/data/content.json'), JSON.stringify(content))
console.log(Object.keys(content).length, 'entries')
