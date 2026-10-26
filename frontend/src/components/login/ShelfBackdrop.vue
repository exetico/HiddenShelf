<script setup>
// Welcome page art: drifting brand-colored light, floating dust and a
// shelf of book spines along the bottom where now and then a book is
// pulled out and pushed back. Pure CSS, decorative only, and still for
// people who ask their system for reduced motion.
//
// The "random" book sizes come from a fixed formula, so the shelf looks
// the same on every visit and in every test.
function noise(i, n) {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const TONES = ["tone-a", "tone-b", "tone-c", "tone-d", "tone-e", "tone-f"];

const books = Array.from({ length: 64 }, (_, i) => ({
  width: 12 + Math.round(noise(i, 1) * 16),
  height: 52 + Math.round(noise(i, 2) * 48),
  tone: TONES[Math.floor(noise(i, 3) * TONES.length)],
  tilt: noise(i, 4) > 0.93 ? (noise(i, 5) > 0.5 ? 7 : -7) : 0,
  bands: noise(i, 6) > 0.55,
  pull: noise(i, 7) > 0.84,
  delay: Math.round(noise(i, 8) * 140) / 10,
}));

const motes = Array.from({ length: 18 }, (_, i) => ({
  left: Math.round(noise(i, 11) * 100),
  top: 15 + Math.round(noise(i, 12) * 80),
  size: 2 + Math.round(noise(i, 13) * 4),
  duration: 14 + Math.round(noise(i, 14) * 16),
  delay: -Math.round(noise(i, 15) * 30),
}));
</script>

<template>
  <div class="shelf-backdrop" aria-hidden="true" data-testid="shelf-backdrop">
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <div class="glow glow-3"></div>
    <div class="grain"></div>
    <span
      v-for="(mote, i) in motes"
      :key="'mote-' + i"
      class="mote"
      :style="{
        left: `${mote.left}%`,
        top: `${mote.top}%`,
        width: `${mote.size}px`,
        height: `${mote.size}px`,
        animationDuration: `${mote.duration}s`,
        animationDelay: `${mote.delay}s`,
      }"
    ></span>
    <div class="shelf">
      <div class="books">
        <span
          v-for="(book, i) in books"
          :key="i"
          class="book"
          :class="[book.tone, { bands: book.bands, pull: book.pull }]"
          :style="{
            width: `${book.width}px`,
            height: `${book.height}%`,
            transform: book.tilt ? `rotate(${book.tilt}deg)` : undefined,
            animationDelay: book.pull ? `${book.delay}s` : undefined,
          }"
        ></span>
      </div>
      <div class="board"></div>
    </div>
  </div>
</template>

<style scoped>
/* Fills the page (the login view is position: relative), so the shelf
   sits at the very bottom, below the feature cards */
.shelf-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

/* Soft drifting light */
.glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(60px);
  opacity: 0.55;
  animation: drift 16s ease-in-out infinite alternate;
}
.glow-1 {
  width: 60vmax;
  height: 60vmax;
  left: -20vmax;
  top: -30vmax;
  background: radial-gradient(circle, rgb(var(--brand-300) / 0.9), transparent 65%);
}
.glow-2 {
  width: 45vmax;
  height: 45vmax;
  right: -18vmax;
  top: -12vmax;
  background: radial-gradient(circle, rgb(245 158 11 / 0.35), transparent 65%);
  animation-duration: 19s;
  animation-delay: -6s;
}
.glow-3 {
  width: 50vmax;
  height: 50vmax;
  left: 20vw;
  bottom: -35vmax;
  background: radial-gradient(circle, rgb(var(--brand-500) / 0.5), transparent 65%);
  animation-duration: 23s;
  animation-delay: -12s;
}
html.dark .glow {
  opacity: 0.35;
}

/* Fine dot grid so the light has some texture */
.grain {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgb(var(--brand-500) / 0.18) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(to bottom, black, transparent 70%);
}

/* The shelf */
.shelf {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(90px, 18vh, 170px);
  opacity: 0.5;
  mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
}
html.dark .shelf {
  opacity: 0.4;
}
.books {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  height: calc(100% - 10px);
  padding: 0 4px;
}
.book {
  flex: none;
  border-radius: 2px 2px 0 0;
  transform-origin: bottom center;
  box-shadow: inset -3px 0 0 rgb(0 0 0 / 0.12), inset 2px 0 0 rgb(255 255 255 / 0.12);
}
.book.bands {
  background-image:
    linear-gradient(to bottom, transparent 14%, rgb(255 255 255 / 0.28) 14%, rgb(255 255 255 / 0.28) 18%, transparent 18%),
    linear-gradient(to bottom, transparent 78%, rgb(255 255 255 / 0.28) 78%, rgb(255 255 255 / 0.28) 82%, transparent 82%);
}
.tone-a { background-color: rgb(var(--brand-400)); }
.tone-b { background-color: rgb(var(--brand-600)); }
.tone-c { background-color: rgb(var(--brand-300)); }
.tone-d { background-color: rgb(var(--brand-700)); }
.tone-e { background-color: rgb(180 132 76); }
.tone-f { background-color: rgb(120 140 150); }
.board {
  height: 10px;
  background: linear-gradient(to bottom, rgb(var(--brand-600)), rgb(var(--brand-800)));
}

/* Dust in the light */
.mote {
  position: absolute;
  border-radius: 9999px;
  background: rgb(var(--brand-400) / 0.7);
  box-shadow: 0 0 6px rgb(var(--brand-300) / 0.8);
  opacity: 0;
  animation: float 20s linear infinite;
}
html.dark .mote {
  background: rgb(var(--brand-200) / 0.5);
}

/* A book is pulled out a little, then pushed back */
.book.pull {
  animation: pull 14s ease-in-out infinite;
}

@keyframes drift {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(12vw, 8vh, 0) scale(1.2); }
}
@keyframes float {
  0% { opacity: 0; translate: 0 0; }
  15% { opacity: 1; }
  85% { opacity: 0.8; }
  100% { opacity: 0; translate: 3vw -45vh; }
}
@keyframes pull {
  0%, 70%, 100% { translate: 0 0; }
  76%, 88% { translate: 0 -14%; }
}
@media (prefers-reduced-motion: reduce) {
  .glow,
  .book.pull { animation: none; }
  .mote { display: none; }
}
</style>
