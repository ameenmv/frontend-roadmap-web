<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { LEVELS, WEEKS, resolveWeek } from '~/data/weeks'
import { T_END, T_START, createRoad, stationT, type Road } from '~/three/road'

const { done, track, load, toggle, setTrack } = useJourney()
const route = useRoute()
const nuxtApp = useNuxtApp()

const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const scroller = ref<HTMLElement>()
const hero = ref<HTMLElement>()

const mode = ref<'loading' | '3d' | 'flat'>('loading')
const index = ref(0)
const started = ref(false)
const ended = ref(false)
const leg = ref(0)
const steer = ref(0)
const velocity = ref(0)

const weeks = computed(() => WEEKS.map((w) => resolveWeek(w, track.value)))
const week = computed(() => weeks.value[index.value]!)
const level = computed(() => LEVELS[week.value.level])
const percent = computed(() => Math.round((done.value.length / WEEKS.length) * 100))
const isDone = (n: number) => done.value.includes(n)
const pad = (n: number) => String(n).padStart(2, '0')

let road: Road | undefined
let lenis: Lenis | undefined
let ctx: gsap.Context | undefined
let tick: ((time: number) => void) | undefined

const clampIdx = (i: number) => Math.max(0, Math.min(WEEKS.length - 1, i))
const weekY = (i: number) => {
  const el = scroller.value!
  return el.offsetTop + stationT(clampIdx(i), WEEKS.length) * (el.offsetHeight - window.innerHeight)
}
const scrollToWeek = (i: number) => {
  if (!scroller.value) return
  if (lenis) lenis.scrollTo(weekY(i), { duration: 1.4 })
  else window.scrollTo({ top: weekY(i), behavior: 'smooth' })
}

const onKey = (e: KeyboardEvent) => {
  if (mode.value !== '3d' || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    scrollToWeek(started.value ? index.value + 1 : 0)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    scrollToWeek(index.value - 1)
  }
}

const webglOk = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

onMounted(async () => {
  load()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !webglOk()) {
    mode.value = 'flat'
    return
  }
  mode.value = '3d'
  await nextTick()
  gsap.registerPlugin(ScrollTrigger, SplitText)
  ScrollTrigger.config({ ignoreMobileResize: true })

  const nav = navigator as Navigator & { deviceMemory?: number }
  const low = window.innerWidth < 768 || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4

  road = createRoad(
    canvas.value!,
    weeks.value.map((w) => ({ n: w.n, color: LEVELS[w.level].color, levelName: LEVELS[w.level].name, label: w.short, project: w.project })),
    { quality: low ? 'low' : 'high' },
  )

  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })
  lenis.on('scroll', ScrollTrigger.update)
  tick = (time: number) => {
    lenis!.raf(time * 1000)
    // steering follows the road every frame; speed fades once you stop scrolling
    steer.value = road?.getSteer() ?? 0
    velocity.value *= 0.88
  }
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  // Coming back from a week page: land on that week.
  const back = Number(route.query.w)
  const resume = Number.isInteger(back) && back >= 0 && back < WEEKS.length
  if (resume) road.snap(stationT(back, WEEKS.length))

  ctx = gsap.context(() => {
    if (!resume) {
      const split = SplitText.create('.hero-title', { type: 'chars', mask: 'chars' })
      gsap
        .timeline({ defaults: { ease: 'power4.out' } })
        .from(split.chars, { yPercent: 110, duration: 1, stagger: 0.035 }, 0.2)
        .from('.hero-fade', { autoAlpha: 0, y: 16, duration: 0.8, stagger: 0.1 }, 0.75)
    }
    gsap.to('.scroll-cue', { y: 8, repeat: -1, yoyo: true, duration: 0.8, ease: 'sine.inOut' })

    ScrollTrigger.create({
      trigger: scroller.value,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate(self) {
        const p = self.progress
        road?.setProgress(p)
        const f = ((p - T_START) / (T_END - T_START)) * (WEEKS.length - 1)
        index.value = clampIdx(Math.round(f))
        leg.value = gsap.utils.clamp(0, 1, f - Math.floor(f))
        velocity.value = self.getVelocity()
        started.value = p > 0.022
        ended.value = p > 0.978
        // The title lifts away like a billboard you drive under.
        gsap.set(hero.value!, { autoAlpha: 1 - gsap.utils.clamp(0, 1, (p - 0.006) / 0.02), yPercent: -Math.max(0, p - 0.006) * 1400 })
      },
    })
  }, root.value)

  if (resume) {
    // Nuxt scrolls to the top once the page transition ends, so land on the week
    // now, again right after that, and once more as a safety net.
    const land = () => {
      ScrollTrigger.refresh()
      lenis?.resize()
      lenis?.scrollTo(weekY(back), { immediate: true, force: true })
    }
    requestAnimationFrame(land)
    nuxtApp.hooks.hookOnce('page:transition:finish', () => requestAnimationFrame(land))
    setTimeout(land, 900)
  }

  window.addEventListener('keydown', onKey)
})

watch(track, () => road?.setLabels(weeks.value.map((w) => w.short)))

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (tick) gsap.ticker.remove(tick)
  ctx?.revert()
  lenis?.destroy()
  road?.dispose()
})
</script>

<template>
  <div ref="root" :style="{ '--level': level.color }">
    <!-- ================= the road ================= -->
    <template v-if="mode !== 'flat'">
      <canvas ref="canvas" class="fixed inset-0 h-dvh w-full bg-beginner" aria-hidden="true" />

      <header class="fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-4 px-4 py-4 sm:px-7">
        <a href="/" class="label leading-tight" @click.prevent="scrollToWeek(0)">CIS Team<br />Frontend Roadmap<br />2026—27</a>

        <div class="flex items-start gap-5">
          <div class="label text-right leading-tight" role="group" aria-label="Level 3 track">
            <span class="opacity-60">Track</span><br />
            <button
              v-for="t in (['react', 'vue'] as const)"
              :key="t"
              class="label ml-2 py-2 first-of-type:ml-0"
              :class="track === t ? 'underline decoration-2 underline-offset-4' : 'opacity-55 hover:opacity-100'"
              :aria-pressed="track === t"
              @click="setTrack(t)"
            >
              {{ t }}
            </button>
          </div>
          <p class="label text-right leading-tight" :title="`${done.length} of ${WEEKS.length} weeks done`">
            <span class="opacity-60">Done</span><br />{{ pad(done.length) }}/{{ WEEKS.length }} · {{ percent }}%
          </p>
        </div>
      </header>

      <!-- hero -->
      <section ref="hero" class="pointer-events-none fixed inset-0 z-20 flex flex-col px-4 pt-24 sm:px-7 sm:pt-[5.5rem]">
        <h1 class="hero-title display text-[23.5vw] leading-[0.92] sm:text-[12.35vw] sm:leading-none sm:whitespace-nowrap">
          Frontend<br class="sm:hidden" />
          Roadmap
        </h1>
        <div class="mt-4 flex flex-wrap items-start justify-between gap-4 sm:mt-6">
          <p class="hero-fade font-serif text-[clamp(1.5rem,3vw,3rem)] leading-[1.08] italic">
            A 31-week road trip, from your<br />first &lt;div&gt; to a live app.
          </p>
          <p class="hero-fade scroll-cue label">Scroll to drive ↓</p>
        </div>
      </section>

      <!-- week ticket -->
      <WeekTicket
        :week="week"
        :level-name="level.name"
        :color="level.color"
        :leg="leg"
        :done="isDone(week.n)"
        :visible="started && !ended"
        :can-prev="index > 0"
        :can-next="index < WEEKS.length - 1"
        :steer="steer"
        :velocity="velocity"
        @toggle="toggle(week.n)"
        @prev="scrollToWeek(index - 1)"
        @next="scrollToWeek(index + 1)"
      />

      <!-- week rail -->
      <nav class="fixed top-1/2 right-4 z-30 hidden -translate-y-1/2 flex-col md:flex" aria-label="Weeks">
        <button
          v-for="(w, i) in weeks"
          :key="w.n"
          class="group relative flex h-[15px] items-center justify-end"
          :aria-label="`Week ${w.n}: ${w.title}`"
          :aria-current="i === index && started ? 'step' : undefined"
          @click="scrollToWeek(i)"
        >
          <span class="label pointer-events-none absolute right-10 bg-ink px-2 py-1 whitespace-nowrap text-paper opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            {{ pad(w.n) }} — {{ w.title }}
          </span>
          <span v-if="i === index && started" class="label mr-2 !text-[0.65rem]">{{ pad(w.n) }}</span>
          <span
            class="block bg-ink transition-all duration-200 group-hover:w-7"
            :class="[i === index && started ? 'h-[3px] w-7' : w.project ? 'h-[3px] w-5' : 'h-px w-3', isDone(w.n) ? '!h-[5px]' : '']"
          />
        </button>
      </nav>

      <!-- finale -->
      <section class="fixed inset-0 z-20 flex flex-col justify-center px-4 transition-opacity duration-500 sm:px-7" :class="ended ? 'opacity-100' : 'pointer-events-none opacity-0'">
        <p class="label">End of the road</p>
        <h2 class="display mt-3 text-[clamp(4rem,19vw,22rem)]">Now go<br />build it.</h2>
        <div class="mt-7 flex flex-wrap gap-3">
          <button class="btn btn-ink" @click="scrollToWeek(0)">Back to week 00</button>
          <a href="https://github.com/ameenmv/frontend-roadmap-2026-2027" target="_blank" rel="noopener" class="btn">Read on GitHub ↗</a>
        </div>
      </section>

      <!-- scroll distance that drives the car -->
      <div ref="scroller" :style="{ height: `${WEEKS.length * 78 + 160}vh` }" />
    </template>

    <!-- ================= flat fallback (reduced motion / no WebGL) ================= -->
    <main v-else class="px-4 py-10 sm:px-7">
      <p class="label">CIS Team · Frontend Roadmap · 2026—27</p>
      <h1 class="display mt-4 text-[clamp(4rem,18vw,16rem)]">Frontend<br />Roadmap</h1>
      <p class="mt-4 font-serif text-3xl italic">A 31-week road trip, from your first &lt;div&gt; to a live app.</p>

      <section v-for="lv in Object.values(LEVELS)" :key="lv.id" class="mt-14" :style="{ '--level': lv.color }">
        <h2 class="label border-b-2 border-ink pb-2">{{ lv.name }} — {{ lv.range }}</h2>
        <ul>
          <li v-for="w in weeks.filter((x) => x.level === lv.id)" :key="w.n" class="border-b border-ink/25">
            <NuxtLink :to="`/week/${w.n}`" class="grid grid-cols-[4rem_1fr] items-baseline gap-x-4 py-3 hover:bg-(--level) sm:grid-cols-[6rem_1fr_1fr]">
              <span class="display text-4xl sm:text-5xl">{{ pad(w.n) }}</span>
              <span class="text-xl font-extrabold">{{ w.title }}</span>
              <span class="col-start-2 font-serif text-lg italic opacity-75 sm:col-start-3">{{ w.ship }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
