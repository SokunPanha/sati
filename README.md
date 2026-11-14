# Sati · សតិ

ចិត្តស្ងប់ ផ្ដោតលើរឿងម្ដងមួយ · Calm mind. One thing at a time.

A Khmer-first personal focus PWA to manage tasks, habits and what to do first: Top 3 per day,
45-min focus sessions, a 4-box board (Do now / Schedule / Limit / Drop), habits (daily routines),
reminders, history, multiple profiles. Nuxt 4 + Nuxt UI 4 + @vite-pwa/nuxt +
@nuxtjs/i18n (km default, en). All data is stored in IndexedDB on the device (Dexie), one database per profile.

## Run on your Mac / ដំណើរការលើ Mac
```bash
npm install
npm run dev        # http://localhost:3000 (service worker is off in dev)
npm run build      # static build → .output/public
node scripts/serve.mjs 4173   # preview the build WITH the service worker
node scripts/verify.mjs       # end-to-end test (needs Google Chrome installed; serve on :4173 first)
```

Landing / download page: **`/download`** (opens without a profile). It installs the PWA with one tap where
the browser allows it (Android, desktop Chrome/Edge) and shows step-by-step install for iPhone. Share
`https://<your-domain>/download` as the download link. Its phone screenshots live in `public/landing/`
and are regenerated with `node scripts/landing-shots.mjs` (then `cwebp`, see the script header).

## Deploy to Vercel / ដាក់ឱ្យប្រើលើ Vercel
Push to GitHub and import in Vercel, or run `npx vercel`. `vercel.json` already sets
the build command, output folder (`.output/public`), SPA fallback and no-cache for `sw.js`.
Notifications and install need HTTPS (Vercel gives you that).

## Install on the phone / ដំឡើងលើទូរស័ព្ទ
- Android (Chrome): open the site → menu → *Install app*.
- iPhone (iOS 16.4+): Safari → Share → *Add to Home Screen*, then open Sati from the home screen
  and allow notifications. On iPhone, notifications only work for the installed app.

## Notifications / ការជូនដំណឹង
System notifications (lock screen, sound, vibration) are shown through the service worker
(`registration.showNotification`). There is **no push server**, so the local scheduler
(`app/composables/useScheduler.ts`) fires alerts while the app is open or was recently
used; when the app is opened it catches up on anything missed. For alerts at an exact
time with the app fully closed you would need Web Push (a small server) later.

## Project map
- `app/pages` – Today (`index`), focus, plan, review, history, reminders, notifications, settings, welcome,
  `download` (landing page)
- `app/components` – sheets (capture, sort, reminder, profiles, task picker), tab bar (centre + button),
  `BoxPicker` / `RepeatPicker` (shared by the capture and sort sheets), splash…
- `app/composables` – `useDb` (Dexie, per-profile DB), `useTasks`, `useFocus`, `useReminders`,
  `useScheduler`, `useNotify`, `useProfile`, `useSettings`
- `app/service-worker/sw.ts` – precache, offline shell, font cache, `notificationclick`
- `i18n/locales/km.json`, `en.json` – all UI text (Khmer should be reviewed by a native speaker)
- `scripts/verify.mjs` – end-to-end test with headless Chrome (`npm i` then serve + run)
- `scripts/landing-shots.mjs` – retakes the app screenshots used on the landing page
- `scripts/make-icons.sh` – regenerates PWA icons from `public/icons/icon.svg`
