## Stack decision

- Keep this project's TanStack Start + Vite shell (already wired for file-based routing, SSR-safe, Vercel-friendly with the Vercel adapter). All Firebase work happens client-side, so no server functions/edge concerns.
- Firebase Web SDK: Auth (email/password), Firestore (clients, quotations, settings), Storage (logo, item images, generated PDFs).
- PDF: `jspdf` + `jspdf-autotable` (browser-side). WhatsApp share via `wa.me` deep link with the uploaded PDF's Firebase Storage URL.
- Deployment: Vercel. Add `vercel.json` + switch Vite build to a static SPA output so Vercel deploys it as a plain static site (no serverless functions needed since Firebase is the backend). Provide a `.env.example` with `VITE_FIREBASE_*` keys.

## What you have to do once (one-time, non-technical)

1. Create a free Firebase project at console.firebase.google.com
2. Enable **Authentication → Email/Password**, create **Firestore Database** (start in production mode), enable **Storage**.
3. Copy the Web SDK config values (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) — paste them into Vercel's Environment Variables as `VITE_FIREBASE_API_KEY`, etc. (I'll give the exact list.)
4. Paste the same values into a local `.env` for previewing in Lovable.
5. Create your owner login in Firebase Auth → Users (email + password).

I will provide a `firestore.rules` file that locks all data to the logged-in owner, plus a `storage.rules` file for the same.

## Files I will create

**Firebase + infra**
- `src/lib/firebase.ts` — initialises app/auth/db/storage from env vars
- `src/lib/auth-context.tsx` — React context, `useAuth()`, session guard
- `src/lib/firestore.ts` — typed CRUD for clients, quotations, settings, counters (quote number is a Firestore transaction so numbers never collide)
- `src/lib/storage.ts` — upload helpers for logo, item images, PDFs
- `src/lib/format.ts` — Indian rupee/number formatting, date helpers
- `src/lib/pdf.ts` — full "Estimate" PDF generator with jsPDF (matches your reference: two-column header, red-accented table, per-item image + weight, totals box, bank block, payment terms, T&C, signatures, "Page X of Y")
- `firestore.rules`, `storage.rules`, `firebase.json` — security + config
- `.env.example`, `vercel.json`, `README-DEPLOY.md`

**Routes** (TanStack file-based, under `src/routes/`)
- `__root.tsx` — updated head/meta ("Vast Stair — Quotations"), red theme, `<Outlet />`
- `auth.tsx` — email/password login
- `_authenticated.tsx` — session guard + app shell (top bar on desktop, bottom nav on mobile: Dashboard / Clients / New / Settings)
- `_authenticated.index.tsx` → `/` — Dashboard (summary cards, big "＋ New Quotation", recent list)
- `_authenticated.clients.tsx` — Clients list + search + add/edit/delete dialog
- `_authenticated.clients.$id.tsx` — Client profile + full quotation history + "New Quotation for this Client"
- `_authenticated.quotations.new.tsx` — Quotation Builder (Step 1 client, Step 2 items, Step 3 totals, Step 4 review)
- `_authenticated.quotations.$id.tsx` — Open saved quotation, edit / duplicate / delete / change status / download PDF / share on WhatsApp
- `_authenticated.settings.tsx` — Company profile + logo upload, bank details, payment terms, T&C, GST %, currency symbol, quote-number prefix, dropdown managers (Stair Types, Materials, Units)

**Components**
- `src/components/AppShell.tsx`, `BottomNav.tsx`, `MoneyInput.tsx`, `ImageUpload.tsx`, `StatusBadge.tsx`, `ItemRow.tsx` (with image thumbnail, dims, specs, live amount), `TotalsPanel.tsx`, `PdfPreviewButton.tsx`

**Design**
- Update `src/styles.css`: `--primary` = red `#E8484D` (oklch), light off-white background, dark-gray foreground, big touch targets (min-h 3rem), rounded-2xl cards, subtle shadow. Keep it strictly semantic tokens.

## Data model (Firestore)

```text
users/{uid}
  settings (doc):
    company{name,address,phones,email,website,gst,salesPerson,logoUrl}
    bank{accountName,bankName,branch,accountNo,ifsc}
    paymentTerms (string)
    termsAndConditions (string[])
    gstPercent (number, default 18)
    currency ("₹")
    quotePrefix ("Q")
    docTitle ("Estimate" | "Quotation")
    loadingNotice (string)
    dropdowns{stairTypes[], materials[], units[]}
  counters/{yyyymmdd}: {seq}
  clients/{clientId}: name, org, phone, email, address, city, state, createdAt
  quotations/{quoteId}:
    number ("09112026-Q-00001"), date, status, clientId, clientSnapshot,
    items[]: {code,name,location,imageUrl,imagePath,material,finish,
              width,height,steps,measure{unit,value},specs[],
              qty,rateMode,rate,amount,weight}
    discount{mode,value}, gstPercent, subTotal, discountAmt, gstAmt, grandTotal,
    totals{area,weight,itemCount}, pdfUrl?, updatedAt
```

Quote number generation runs inside a Firestore `runTransaction` on `counters/{today}` so two devices can never produce the same number.

## PDF layout (matches the reference)

- A4 portrait, 10mm margins, red header bar.
- Top row: left box = company block, right box = logo top-right + client block + `Quote No. / Date / Sales Person`.
- Centered title (Estimate/Quotation from settings).
- Repeating table header on every page with columns exactly as spec: `Sales Line | Details | Width | Height | Qty | Sqft/Rft | Rate | Amount`.
- Each item row: image on the left of Details cell, item code + name + location + material + finish + spec bullets, "Weight: X Kg" under image.
- Last page: sum row, bottom-left = Total Area / Items / Weight + Bank Details, bottom-right = Sub Total / Discount / GST / **Grand Total** (highlighted red) / Avg ₹/sqft.
- Bold loading notice, Payment Terms, Terms & Conditions, acceptance line, dual signatures, "Page X of Y" footer.

## Deployment

- `vercel.json` sets framework=vite, `buildCommand=bun run build`, `outputDirectory=dist`, SPA rewrite so TanStack Router handles deep links.
- Vite config: build as static SPA (no SSR) since Firebase is the backend and it deploys to Vercel with zero serverless functions — this avoids the Cloudflare Workers server bits that don't fit the Firebase-only design.
- I'll include a short `README-DEPLOY.md` with: push repo → Import in Vercel → paste `VITE_FIREBASE_*` env vars → deploy. Plus Firebase console steps to enable Auth/Firestore/Storage and paste in `firestore.rules` + `storage.rules`.

## After I finish building

I'll ask you to paste your Firebase Web config (all 6 values) using the secrets form so previewing works inside Lovable. On Vercel you'll paste the same values as Environment Variables.

## Out of scope for v1 (say the word to add later)

- Multi-user / staff roles (schema already supports adding it later)
- Offline-first sync (basic optimistic UI included, but full offline persistence not enabled)
- Email sending of PDF (WhatsApp share covers the ask)
