export type LevelId = 'beginner' | 'intermediate' | 'advanced' | 'final'
export type Track = 'react' | 'vue'

export interface Level {
  id: LevelId
  name: string
  range: string
  color: string
}

export interface Week {
  n: number
  level: LevelId
  title: string
  short: [string, string]
  ship: string
  project?: boolean
  vue?: { title: string; short?: [string, string]; ship?: string }
}

export const LEVELS: Record<LevelId, Level> = {
  beginner: { id: 'beginner', name: 'Level 1 · Beginner', range: 'Weeks 0-8', color: '#ff5a1f' },
  intermediate: { id: 'intermediate', name: 'Level 2 · Intermediate', range: 'Weeks 9-18', color: '#ffc21a' },
  advanced: { id: 'advanced', name: 'Level 3 · React or Vue', range: 'Weeks 19-24', color: '#3d8bff' },
  final: { id: 'final', name: 'Level 3 · Final stretch', range: 'Weeks 25-30', color: '#9a6bff' },
}

export const WEEKS: Week[] = [
  { n: 0, level: 'beginner', title: 'Setup & How the Web Works', short: ['Setup', '& the web'], ship: 'A ready machine and your own explanation of how a page loads' },
  { n: 1, level: 'beginner', title: 'HTML Basics', short: ['HTML', 'basics'], ship: 'An "About Me" page' },
  { n: 2, level: 'beginner', title: 'Semantic HTML, Forms & Git', short: ['Semantic', '+ Git'], ship: 'An event sign-up form, live on GitHub Pages' },
  { n: 3, level: 'beginner', title: 'CSS Basics', short: ['CSS', 'basics'], ship: 'A profile card' },
  { n: 4, level: 'beginner', title: 'Box Model, Position & Flexbox', short: ['Box model', '& Flexbox'], ship: 'A navbar and pricing cards' },
  { n: 5, level: 'beginner', title: 'Grid, Transforms & Animations', short: ['Grid &', 'animation'], ship: 'A dashboard layout' },
  { n: 6, level: 'beginner', title: 'Responsive Design & Modern CSS', short: ['Responsive', 'design'], ship: 'A Frontend Mentor challenge' },
  { n: 7, level: 'beginner', title: 'Tailwind CSS', short: ['Tailwind', 'CSS'], ship: 'A pricing page with dark mode' },
  { n: 8, level: 'beginner', title: 'Project 1 · Landing Page', short: ['PROJECT 1', 'Landing page'], ship: 'A complete landing page from a real design', project: true },

  { n: 9, level: 'intermediate', title: 'JavaScript Basics', short: ['JS', 'basics'], ship: 'A set of solved problems' },
  { n: 10, level: 'intermediate', title: 'Arrays, Loops, Functions & Scope', short: ['Arrays &', 'functions'], ship: 'A grade calculator' },
  { n: 11, level: 'intermediate', title: 'Higher-Order Functions & Objects', short: ['map · filter', 'objects'], ship: 'A student data analysis' },
  { n: 12, level: 'intermediate', title: 'DOM, BOM & Local Storage', short: ['DOM &', 'storage'], ship: 'An expense tracker' },
  { n: 13, level: 'intermediate', title: 'Map, Set, Dates & Modules', short: ['Modules', '& more'], ship: 'A modular to-do app' },
  { n: 14, level: 'intermediate', title: 'Async JavaScript & Fetch', short: ['Async &', 'Fetch'], ship: 'A weather app' },
  { n: 15, level: 'intermediate', title: 'How JavaScript Works Inside', short: ['Closures', '& OOP'], ship: 'A quiz app built with classes' },
  { n: 16, level: 'intermediate', title: 'npm, Vite & Git Branching', short: ['npm · Vite', 'branches'], ship: 'Your app on Vite, merged through pull requests' },
  { n: 17, level: 'intermediate', title: 'TypeScript', short: ['Type', 'Script'], ship: 'Your app in strict TypeScript' },
  { n: 18, level: 'intermediate', title: 'Project 2 · API App in TypeScript', short: ['PROJECT 2', 'API app'], ship: 'An API-driven app with no framework', project: true },

  { n: 19, level: 'advanced', title: 'Components, JSX & Props', short: ['Components', '& props'], ship: 'Your landing page as components', vue: { title: 'Template Syntax & Directives', short: ['Templates', '& directives'], ship: 'Your landing page in Vue' } },
  { n: 20, level: 'advanced', title: 'State, Events & Forms', short: ['State &', 'forms'], ship: 'A multi-step form', vue: { title: 'Composition API & Components' } },
  { n: 21, level: 'advanced', title: 'Context, Effects & Data Fetching', short: ['Effects &', 'fetching'], ship: 'A movies app', vue: { title: 'Lifecycle, Watchers & Composables', short: ['Composables', '& fetching'] } },
  { n: 22, level: 'advanced', title: 'React Router', short: ['Router', ''], ship: 'A multi-page app', vue: { title: 'Vue Router' } },
  { n: 23, level: 'advanced', title: 'Styling & Component Libraries', short: ['Styling &', 'UI libs'], ship: 'A mini UI kit' },
  { n: 24, level: 'advanced', title: 'State Management', short: ['State', 'management'], ship: 'A shopping cart', vue: { title: 'Pinia', short: ['Pinia', 'stores'] } },

  { n: 25, level: 'final', title: 'TanStack Query', short: ['TanStack', 'Query'], ship: 'An admin dashboard' },
  { n: 26, level: 'final', title: 'Testing', short: ['Testing', ''], ship: 'A tested shopping cart' },
  { n: 27, level: 'final', title: 'Performance & Accessibility', short: ['Perf &', 'a11y'], ship: 'A before-and-after audit' },
  { n: 28, level: 'final', title: 'Next.js: Basics & Routing', short: ['Next.js', ''], ship: 'A blog', vue: { title: 'Nuxt: Basics & Routing', short: ['Nuxt', ''] } },
  { n: 29, level: 'final', title: 'Next.js: Data, SEO & Deploy + AI', short: ['Ship it', '+ AI workflow'], ship: 'The blog, live, plus your AI log', vue: { title: 'Nuxt: Data, SEO & Deploy + AI' } },
  { n: 30, level: 'final', title: 'Graduation Project', short: ['GRADUATION', 'project'], ship: 'The strongest piece in your portfolio', project: true },
]

const REPO = 'https://github.com/ameenmv/frontend-roadmap-2026-2027/blob/main'

export function weekHref(n: number, track: Track): string {
  if (n === 0) return `${REPO}/README.md#week-0`
  if (n <= 8) return `${REPO}/01-beginner.md#week-${n}`
  if (n <= 18) return `${REPO}/02-intermediate.md#week-${n}`
  return `${REPO}/${track === 'vue' ? '03-vue' : '03-react'}.md#week-${n}`
}

export function resolveWeek(w: Week, track: Track) {
  const v = track === 'vue' ? w.vue : undefined
  return { ...w, title: v?.title ?? w.title, short: v?.short ?? w.short, ship: v?.ship ?? w.ship }
}
