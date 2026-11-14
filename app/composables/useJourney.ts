import type { Track } from '~/data/weeks'

const KEY = 'cis-frontend-roadmap'

interface Saved {
  done: number[]
  track: Track
}

/** Progress + chosen track, persisted in the browser. */
export function useJourney() {
  const done = useState<number[]>('journey-done', () => [])
  const track = useState<Track>('journey-track', () => 'react')
  const loaded = useState('journey-loaded', () => false)

  const load = () => {
    if (loaded.value) return
    loaded.value = true
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const s = JSON.parse(raw) as Partial<Saved>
      if (Array.isArray(s.done)) done.value = s.done.filter((n) => Number.isInteger(n))
      if (s.track === 'react' || s.track === 'vue') track.value = s.track
    } catch {
      /* corrupted or blocked storage: start fresh */
    }
  }

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ done: done.value, track: track.value } satisfies Saved))
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }

  const toggle = (n: number) => {
    done.value = done.value.includes(n) ? done.value.filter((x) => x !== n) : [...done.value, n]
    save()
  }

  const setTrack = (t: Track) => {
    track.value = t
    save()
  }

  return { done, track, load, toggle, setTrack }
}
