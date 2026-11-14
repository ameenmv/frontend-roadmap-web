<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

interface TicketWeek {
  n: number
  title: string
  ship: string
  project?: boolean
}

const props = defineProps<{
  week: TicketWeek
  levelName: string
  color: string
  /** 0..1 distance travelled from this week towards the next. */
  leg: number
  done: boolean
  visible: boolean
  canPrev: boolean
  canNext: boolean
  /** Signed steering amount from the road, roughly -1..1. */
  steer: number
  /** Scroll velocity in px/s. */
  velocity: number
}>()

const emit = defineEmits<{ toggle: []; prev: []; next: [] }>()

const wrap = ref<HTMLElement>()
const body = ref<HTMLElement>()
const title = ref<HTMLElement>()
const stamp = ref<HTMLElement>()
const paint = ref<HTMLElement>()

const pad = (v: number) => String(v).padStart(2, '0')
const digits = computed(() => pad(props.week.n).split('').map(Number))
const shipLine = computed(() => props.week.ship.charAt(0).toLowerCase() + props.week.ship.slice(1))

// Paint colour shown under the wipe; it trails the real colour so the wipe can reveal it.
const shownColor = ref(props.color)

let swayTick: (() => void) | undefined
let lastN = props.week.n

onMounted(() => {
  gsap.registerPlugin(ScrambleTextPlugin)

  // Hangs from the mirror: lean into bends, shake with speed.
  const rot = gsap.quickTo(wrap.value!, 'rotation', { duration: 0.6, ease: 'power3.out' })
  const skew = gsap.quickTo(wrap.value!, 'skewY', { duration: 0.4, ease: 'power3.out' })
  const lift = gsap.quickTo(wrap.value!, 'y', { duration: 0.35, ease: 'power2.out' })
  swayTick = () => {
    const v = gsap.utils.clamp(-1, 1, props.velocity / 2600)
    const shake = Math.abs(v) > 0.05 ? Math.sin(performance.now() / 38) * Math.abs(v) * 1.4 : 0
    rot(gsap.utils.clamp(-4, 4, props.steer * 3.5 + v * 1.5))
    skew(v * -2.2)
    lift(shake)
  }
  gsap.ticker.add(swayTick)
})

onUnmounted(() => {
  if (swayTick) gsap.ticker.remove(swayTick)
})

// New week: tear the old body off, print the new one, scramble the title.
watch(
  () => props.week.n,
  async (n) => {
    if (!body.value) return
    const forward = n > lastN
    lastN = n
    const old = body.value.cloneNode(true) as HTMLElement
    old.removeAttribute('aria-live')
    old.querySelectorAll('button, a').forEach((el) => el.setAttribute('tabindex', '-1'))
    old.classList.add('torn')
    body.value.parentElement!.appendChild(old)
    gsap.to(old, {
      yPercent: forward ? 140 : -140,
      rotation: forward ? gsap.utils.random(-14, -6) : gsap.utils.random(6, 14),
      x: gsap.utils.random(-40, 40),
      autoAlpha: 0,
      duration: 0.7,
      ease: 'power2.in',
      onComplete: () => old.remove(),
    })

    await nextTick()
    gsap.fromTo(body.value, { clipPath: forward ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.55, ease: 'steps(9)', overwrite: true })
    if (title.value) {
      gsap.to(title.value, { duration: 0.7, scrambleText: { text: props.week.title.toUpperCase(), chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ<>/{}#', speed: 0.6 }, overwrite: true })
    }
  },
)

// New level: wipe the new colour across the ticket.
watch(
  () => props.color,
  (c) => {
    if (!paint.value) {
      shownColor.value = c
      return
    }
    gsap.fromTo(
      paint.value,
      { clipPath: 'inset(0 100% 0 0)', backgroundColor: c },
      {
        clipPath: 'inset(0 0% 0 0)',
        duration: 0.6,
        ease: 'expo.inOut',
        overwrite: true,
        onComplete: () => {
          shownColor.value = c
          gsap.set(paint.value!, { clipPath: 'inset(0 100% 0 0)' })
        },
      },
    )
  },
)

// Done: slam a stamp onto the ticket.
watch(
  () => props.done,
  (d, was) => {
    if (!stamp.value || d === was) return
    if (d) {
      gsap.fromTo(stamp.value, { scale: 2.6, rotation: -28, autoAlpha: 0 }, { scale: 1, rotation: -12, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.2)' })
      gsap.fromTo(wrap.value!, { x: 0 }, { x: 6, duration: 0.05, repeat: 5, yoyo: true, ease: 'none', clearProps: 'x' })
    } else gsap.to(stamp.value, { autoAlpha: 0, scale: 0.8, duration: 0.2 })
  },
)
</script>

<template>
  <div
    ref="wrap"
    class="fixed inset-x-2 bottom-2 z-30 origin-top transition-[translate,opacity] duration-500 ease-out sm:inset-x-auto sm:bottom-7 sm:left-7 sm:w-[28rem]"
    :class="visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[130%] opacity-0'"
  >
    <div class="ticket relative overflow-hidden text-ink" :style="{ backgroundColor: shownColor }">
      <div ref="paint" class="pointer-events-none absolute inset-0 z-0" style="clip-path: inset(0 100% 0 0)" />

      <!-- stub: odometer + leg progress -->
      <div class="relative z-10 flex items-end justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
        <div>
          <p class="label opacity-70">Week</p>
          <p class="odometer display mt-1 flex text-[3.4rem] leading-none" :aria-label="`Week ${week.n} of 30`">
            <span v-for="(d, i) in digits" :key="i" class="odo-cell">
              <span class="odo-strip" :style="{ transform: `translateY(-${d * 10}%)` }">
                <span v-for="k in 10" :key="k">{{ k - 1 }}</span>
              </span>
            </span>
            <span class="ml-1 self-start pt-1 font-mono text-sm opacity-60">/30</span>
          </p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <p class="label text-right">{{ week.project ? 'Milestone' : levelName }}</p>
          <div class="flex gap-1.5">
            <button class="tbtn" aria-label="Previous week" :disabled="!canPrev" @click="emit('prev')">←</button>
            <button class="tbtn" aria-label="Next week" :disabled="!canNext" @click="emit('next')">→</button>
          </div>
        </div>
      </div>
      <div class="relative z-10 mx-5 mb-1 h-[3px] bg-ink/20 sm:mx-6" aria-hidden="true">
        <div class="h-full bg-ink" :style="{ width: `${Math.round(leg * 100)}%` }" />
      </div>

      <!-- perforation -->
      <div class="perf relative z-10" aria-hidden="true" />

      <!-- body: torn off and reprinted per week -->
      <div class="relative z-10 grid">
        <div ref="body" class="ticket-body col-start-1 row-start-1 px-5 pt-3 pb-5 sm:px-6" aria-live="polite">
          <h2 ref="title" class="display text-[clamp(2rem,4vw,3rem)]">{{ week.title }}</h2>
          <p class="mt-2 font-serif text-xl leading-snug italic">You ship: {{ shipLine }}.</p>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <NuxtLink :to="`/week/${week.n}`" class="btn btn-ink">Open week →</NuxtLink>
            <button class="btn" :aria-pressed="done" @click="emit('toggle')">{{ done ? 'Undo' : 'Mark done' }}</button>
          </div>
        </div>
      </div>

      <span ref="stamp" class="stamp pointer-events-none absolute top-5 left-[8.5rem] z-20 sm:left-[9.5rem]" :style="{ opacity: done ? 1 : 0, transform: 'rotate(-12deg)' }" aria-hidden="true">
        Done
      </span>
    </div>
  </div>
</template>

<style scoped>
.ticket {
  --notch: 11px;
  box-shadow: 6px 6px 0 var(--color-ink);
}
.perf {
  height: calc(var(--notch) * 2);
  background:
    radial-gradient(circle at 0 50%, var(--color-paper) var(--notch), transparent calc(var(--notch) + 0.5px)) left / 50% 100% no-repeat,
    radial-gradient(circle at 100% 50%, var(--color-paper) var(--notch), transparent calc(var(--notch) + 0.5px)) right / 50% 100% no-repeat;
}
.perf::after {
  content: '';
  position: absolute;
  inset-inline: calc(var(--notch) + 6px);
  inset-block-start: 50%;
  border-block-start: 2px dashed color-mix(in oklab, var(--color-ink) 55%, transparent);
}
.ticket-body.torn {
  grid-column-start: 1;
  grid-row-start: 1;
  pointer-events: none;
}
.odo-cell {
  display: inline-block;
  height: 1em;
  overflow: hidden;
}
.odo-strip {
  display: flex;
  flex-direction: column;
  transition: transform 0.55s cubic-bezier(0.6, -0.25, 0.25, 1.35);
}
.odo-strip > span {
  height: 1em;
}
.tbtn {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border: 2px solid var(--color-ink);
  font-weight: 800;
  transition: background-color 0.15s, color 0.15s;
}
.tbtn:hover {
  background: var(--color-ink);
  color: var(--color-paper);
}
.tbtn:disabled {
  opacity: 0.3;
  pointer-events: none;
}
.stamp {
  padding: 0.15em 0.45em;
  border: 4px double var(--color-ink);
  font-family: var(--font-display);
  font-size: 2.6rem;
  line-height: 1;
  text-transform: uppercase;
  mix-blend-mode: multiply;
}
</style>
