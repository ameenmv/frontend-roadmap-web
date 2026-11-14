<script setup lang="ts">
import content from '~/data/content.json'
import { LEVELS, WEEKS, resolveWeek } from '~/data/weeks'

interface WeekContent {
  n: number
  title: string
  video?: { href: string; thumb: string; label: string; meta: string }
  fields: { label: string; html: string }[]
  body: string
  checklist: string[]
}

const CHECKS_KEY = 'cis-frontend-roadmap-checks'
const route = useRoute()
const { done, track, load, toggle, setTrack } = useJourney()

const n = computed(() => Number(route.params.n))
if (!Number.isInteger(n.value) || n.value < 0 || n.value >= WEEKS.length) {
  throw createError({ statusCode: 404, statusMessage: 'That week is not on the map', fatal: true })
}

const meta = computed(() => resolveWeek(WEEKS[n.value]!, track.value))
const level = computed(() => LEVELS[meta.value.level])
const key = computed(() => (track.value === 'vue' && `${n.value}-vue` in content ? `${n.value}-vue` : String(n.value)))
const data = computed(() => (content as Record<string, WeekContent>)[key.value]!)
const hasTracks = computed(() => `${n.value}-vue` in content)
const prev = computed(() => (n.value > 0 ? resolveWeek(WEEKS[n.value - 1]!, track.value) : null))
const next = computed(() => (n.value < WEEKS.length - 1 ? resolveWeek(WEEKS[n.value + 1]!, track.value) : null))
const pad = (v: number) => String(v).padStart(2, '0')
const isDone = computed(() => done.value.includes(n.value))

// Exit checklist, remembered per week and track.
const checks = ref<Record<string, number[]>>({})
const ticked = computed(() => checks.value[key.value] ?? [])
const allTicked = computed(() => data.value.checklist.length > 0 && ticked.value.length === data.value.checklist.length)
const tick = (i: number) => {
  const cur = ticked.value
  checks.value = { ...checks.value, [key.value]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] }
  try {
    localStorage.setItem(CHECKS_KEY, JSON.stringify(checks.value))
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

onMounted(() => {
  load()
  try {
    const raw = localStorage.getItem(CHECKS_KEY)
    if (raw) checks.value = JSON.parse(raw)
  } catch {
    /* ignore corrupted storage */
  }
})

useHead(() => ({
  title: `Week ${pad(n.value)} · ${meta.value.title} · Frontend Roadmap`,
  meta: [
    { name: 'description', content: `Week ${n.value} of the CIS Team Frontend Roadmap: ${meta.value.title}. You ship: ${meta.value.ship}.` },
    { name: 'theme-color', content: level.value.color },
  ],
}))
</script>

<template>
  <div :style="{ '--level': level.color }">
    <header class="bg-(--level) px-4 pt-4 pb-8 sm:px-7 sm:pb-12">
      <div class="flex items-start justify-between gap-4">
        <NuxtLink :to="`/?w=${n}`" class="btn btn-ink">← The road</NuxtLink>
        <div v-if="hasTracks" class="label text-right leading-tight" role="group" aria-label="Track">
          <span class="opacity-60">Track</span><br />
          <button
            v-for="t in (['react', 'vue'] as const)"
            :key="t"
            class="label ml-2 first-of-type:ml-0"
            :class="track === t ? 'underline decoration-2 underline-offset-4' : 'opacity-55 hover:opacity-100'"
            :aria-pressed="track === t"
            @click="setTrack(t)"
          >
            {{ t }}
          </button>
        </div>
      </div>

      <div class="mt-8 grid items-end gap-x-8 gap-y-2 md:grid-cols-[auto_1fr]">
        <p class="display text-[clamp(8rem,30vw,26rem)] leading-[0.78]" aria-hidden="true">{{ pad(n) }}</p>
        <div class="pb-2">
          <p class="label">{{ level.name }} — Week {{ pad(n) }} of 30<template v-if="meta.project"> — Milestone</template></p>
          <h1 class="display mt-3 text-[clamp(2.6rem,7vw,7rem)]">{{ meta.title }}</h1>
          <p class="mt-4 font-serif text-[clamp(1.3rem,2.4vw,2rem)] leading-tight italic">You ship: {{ meta.ship.charAt(0).toLowerCase() + meta.ship.slice(1) }}.</p>
        </div>
      </div>
    </header>

    <main class="px-4 py-10 sm:px-7 sm:py-14">
      <div class="grid gap-10 lg:grid-cols-12">
        <!-- watch -->
        <aside v-if="data.video" class="lg:col-span-5">
          <div class="lg:sticky lg:top-6">
            <a :href="data.video.href" target="_blank" rel="noopener" class="group block border-2 border-ink bg-ink transition-[translate,box-shadow] hover:-translate-1 hover:shadow-[6px_6px_0_var(--level)]">
              <div class="relative aspect-video overflow-hidden">
                <img :src="data.video.thumb" :alt="data.video.label" class="size-full object-cover" loading="lazy" />
                <span class="label absolute bottom-0 left-0 bg-(--level) px-3 py-2 text-ink">▶ Watch</span>
              </div>
              <div class="flex items-baseline justify-between gap-4 p-4 text-paper">
                <span class="text-lg font-extrabold">{{ data.video.label }}</span>
                <span class="label shrink-0" v-html="data.video.meta" />
              </div>
            </a>
          </div>
        </aside>

        <div :class="data.video ? 'lg:col-span-7' : 'lg:col-span-9'">
        <!-- facts -->
        <dl>
          <div v-for="(f, i) in data.fields" :key="i" class="field grid gap-x-6 gap-y-1 border-t-2 border-ink py-4 sm:grid-cols-[8rem_1fr]">
            <dt class="label pt-1">{{ f.label || 'Note' }}</dt>
            <dd class="text-lg leading-relaxed" v-html="f.html" />
          </div>
        </dl>

      <article class="prose max-w-3xl" :class="data.fields.length ? 'mt-12' : ''" v-html="data.body" />

      <!-- exit checklist -->
      <section v-if="data.checklist.length" class="mt-14 max-w-3xl">
        <h2 class="display text-[clamp(1.9rem,4vw,2.8rem)]">Exit checklist</h2>
        <p class="mt-2 font-serif text-xl italic opacity-75">Answer all of it without looking, and you are done here.</p>
        <ul class="mt-5 border-b-2 border-ink">
          <li v-for="(item, i) in data.checklist" :key="i" class="border-t-2 border-ink">
            <button class="field flex w-full items-start gap-4 py-3.5 text-left text-lg" :aria-pressed="ticked.includes(i)" @click="tick(i)">
              <span class="mt-0.5 grid size-6 shrink-0 place-items-center border-2 border-ink text-sm font-extrabold" :class="ticked.includes(i) ? 'bg-ink text-paper' : ''">{{ ticked.includes(i) ? '✓' : '' }}</span>
              <span :class="ticked.includes(i) ? 'line-through opacity-50' : ''" v-html="item" />
            </button>
          </li>
        </ul>
        <div class="mt-6 flex flex-wrap items-center gap-4">
          <button class="btn" :class="isDone ? 'btn-ink' : ''" :aria-pressed="isDone" @click="toggle(n)">{{ isDone ? '✓ Week done' : 'Mark week done' }}</button>
          <p v-if="allTicked && !isDone" class="font-serif text-xl italic">All ticked. Mark it done.</p>
        </div>
      </section>
        </div>
      </div>
    </main>

    <!-- prev / next -->
    <nav class="grid border-t-2 border-ink sm:grid-cols-2" aria-label="Other weeks">
      <NuxtLink v-if="prev" :to="`/week/${prev.n}`" class="group bg-(--bg) px-4 py-8 transition-colors hover:bg-ink hover:text-paper sm:px-7" :style="{ '--bg': LEVELS[prev.level].color }">
        <span class="label">← Week {{ pad(prev.n) }}</span>
        <span class="display mt-2 block text-[clamp(1.8rem,3.6vw,3.2rem)]">{{ prev.title }}</span>
      </NuxtLink>
      <span v-else />
      <NuxtLink
        v-if="next"
        :to="`/week/${next.n}`"
        class="group border-ink bg-(--bg) px-4 py-8 text-right transition-colors hover:bg-ink hover:text-paper max-sm:border-t-2 sm:border-l-2 sm:px-7"
        :style="{ '--bg': LEVELS[next.level].color }"
      >
        <span class="label">Week {{ pad(next.n) }} →</span>
        <span class="display mt-2 block text-[clamp(1.8rem,3.6vw,3.2rem)]">{{ next.title }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>
