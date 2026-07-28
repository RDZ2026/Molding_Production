# nVent Hoffman — Molding Report App

## One-time GitHub setup (do this once)

1. Go to your GitHub repo → **Settings** → **Pages**
2. Under "Source", select **GitHub Actions**
3. Save

That's it. From now on, every time you upload files to the `main` branch, GitHub automatically builds and deploys the app in about 60 seconds.

---

## Before your first deploy — update your GAS URL

Open `src/api.js` and replace `YOUR_GAS_DEPLOYMENT_URL_HERE` with your actual Google Apps Script URL.

```js
export const GAS_URL = 'https://script.google.com/macros/s/YOUR_ACTUAL_URL/exec';
```

---

## How to update the app going forward

1. Make your changes in the `src/` folder
2. Upload the changed files to GitHub (drag and drop into the repo)
3. Wait ~60 seconds for GitHub Actions to build
4. App is live at: `https://rdz2026.github.io/Molding_Production/`

---

## File structure

```
src/
  api.js              ← GAS URL lives here
  constants.js        ← Press numbers, default goals, reasons
  translations.js     ← All English/Spanish text
  helpers.js          ← Utility functions and hooks
  styles.css          ← All CSS styling
  App.jsx             ← Main app, login flow
  main.jsx            ← Entry point (don't touch)
  components/
    Auth.jsx          ← Language screen, login screen
    Charts.jsx        ← Bar charts, trend charts
    Common.jsx        ← Switch, Stars, CopyBtn, PartSearch, UndoOverlay
    LeadViews.jsx     ← Lead home, EH prediction, production report
    ManagerView.jsx   ← All manager tabs and subviews
    MolderViews.jsx   ← Molder profiles and detail
    Modals.jsx        ← User, operator, part, note modals
    PressCards.jsx    ← Press card and EH press card
```

---

## GAS backend

The `gas_script.js` file is unchanged. Paste it into Google Apps Script, run `setup()` once, deploy as new version. No changes needed during migration.

---

## Adding first shift (future)

When ready to add first shift, the changes will go in:
- `src/translations.js` — add shift labels
- `src/App.jsx` — add shift routing
- `src/components/ManagerView.jsx` — add combined views
- GAS backend — add shift column to sheets

The file size ceiling is now gone so this is straightforward to add.
