/** Tailwind is only used by the pages that previously loaded the Tailwind CDN script. */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './vidya/basic-economics-trainer.html',
    './vidya/eminems-human-action.html',
    './src/games/basic-economics-trainer/**/*.{js,ts}',
    './src/games/eminems-human-action/**/*.{js,ts}',
  ],
};
