# SOMART

Luxury eyewear & fashion accessories store built with Next.js 16, Tailwind CSS 4, MongoDB Atlas (Mongoose) and Cloudinary.

## Features

- **Storefront** — animated hero, category showcase, featured pieces; dark mode by default with a light/dark toggle
- **Catalog** — `/products` with category filters (eyeglasses, sunglasses, accessories) and detail pages
- **Admin panel** — `/admin` (login required): create/edit/delete products, quick stock & featured toggles, photo uploads to Cloudinary
- **API** — `/api/products` (GET public; POST/PATCH/DELETE admin-only), `/api/upload` (admin-only Cloudinary upload), `/api/admin/login|logout`

## Setup

1. Create `.env.local`:

   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/somart-optical?appName=Cluster0
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ADMIN_EMAIL=...
   ADMIN_PASSWORD=...
   AUTH_SECRET=<openssl rand -hex 32>
   ```

2. Install and seed sample inventory:

   ```bash
   npm install
   npm run seed
   ```

3. Run:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) — admin at [/admin](http://localhost:3000/admin).

## Project structure

- `src/lib/db.ts` — cached Mongoose connection; `src/lib/auth.ts` — JWT cookie sessions (jose)
- `src/models/Product.ts` — product schema
- `src/app/api/` — REST endpoints (products, upload, admin auth)
- `src/app/admin/` — admin dashboard & login
- `scripts/seed.mjs` — upserts sample products (safe to re-run)
