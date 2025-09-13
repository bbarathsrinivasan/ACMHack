## ACMHack Web

Next.js (App Router, TypeScript) app with Tailwind and shadcn/ui.

### Install & Run

```powershell
# from ./web
npm install
npm run seed   # restore initial data into ./data/*.json
npm run dev    # start dev server (Turbopack)
```

Open http://localhost:3000.

### Scripts

```powershell
npm run build      # production build
npm start          # start production server
npm run lint       # eslint
npm run typecheck  # TypeScript project check
npm run seed       # restore data from ./data/seeds -> ./data
```

### Structure

- app/layout.tsx – wraps pages with the sidebar layout
- app/page.tsx – Dashboard (includes "Today’s Plan" card)
- app/assignments/page.tsx – Assignments route
- app/tutor/page.tsx – Tutor route
- app/settings/page.tsx – Settings route
- components/ui/* – shadcn/ui primitives
- components/site-shell.tsx – sidebar + top bar shell

### Styling

- Clean, minimal style using Tailwind v4 design tokens
- Rounded corners: rounded-2xl on cards and surfaces
- Soft shadows applied via shadow-sm

### UI Flow (Checklist)

- [ ] Settings → adjust availability and preferences (saved to localStorage)
- [ ] Dashboard → Generate Plan (creates 30-min study blocks before due dates)
- [ ] Calendar → drag to move / resize blocks (saves and shows Changes drawer)
- [ ] Tutor → ask a question (Guided Mode). If graded/direct answer detected, you get a refusal with hint level choices (Restate, Concept, Outline, Example, Next Step).
- [ ] Tutor → click resource chips to open helpful links

![demo](./docs/demo.gif)

> Tip: Add a short GIF at `web/docs/demo.gif` showing: settings save, plan generate, block drag/resize, and tutor refusal + hint selection.

