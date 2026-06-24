/**
 * Generates the Genuine Homes stage decks (.pptx) into docs/presentations/.
 *
 * One deck per completed stage plus a project overview, all sharing a single
 * design system (cover, section header bar, gold accent, bullet/table/callout
 * renderers). Re-run with `pnpm slides` after editing the SLIDE data below.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import pptxgen from 'pptxgenjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'presentations');
mkdirSync(OUT, { recursive: true });

// ── Design system ───────────────────────────────────────────────────────────
const INK = '1F2937';
const MUTED = '6B7280';
const LINE = 'E5E7EB';
const BAND = 13.333; // slide width (LAYOUT_WIDE)
const MX = 0.6; // horizontal margin
const CW = BAND - MX * 2; // content width
const FONT = 'Segoe UI';
const MONO = 'Consolas';

const titleCfg = (t) => ({ fontFace: FONT, fontSize: 26, bold: true, color: 'FFFFFF' });

function cover(slide, theme, { kicker, title, subtitle, footer }) {
  slide.background = { color: theme.primary };
  slide.addShape('rect', { x: 0, y: 0, w: BAND, h: 0.18, fill: { color: theme.gold } });
  slide.addShape('ellipse', { x: 9.4, y: -1.8, w: 6.5, h: 6.5, fill: { color: theme.light, transparency: 88 } });
  slide.addShape('ellipse', { x: 11.0, y: 4.6, w: 4.2, h: 4.2, fill: { color: theme.gold, transparency: 86 } });
  slide.addText(kicker.toUpperCase(), { x: MX, y: 2.05, w: 11, h: 0.5, color: theme.gold, fontFace: FONT, fontSize: 15, bold: true, charSpacing: 3 });
  slide.addText(title, { x: MX, y: 2.55, w: 11.8, h: 1.7, color: 'FFFFFF', fontFace: FONT, fontSize: 44, bold: true });
  slide.addText(subtitle, { x: MX, y: 4.35, w: 11.2, h: 1.2, color: 'E8EEEA', fontFace: FONT, fontSize: 20, lineSpacingMultiple: 1.15 });
  slide.addShape('line', { x: MX, y: 6.55, w: 3.2, h: 0, line: { color: theme.gold, width: 2 } });
  slide.addText(footer, { x: MX, y: 6.65, w: 11.8, h: 0.4, color: 'C7D3CC', fontFace: FONT, fontSize: 12 });
}

function header(pptx, theme, label, title, pageNo) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addShape('rect', { x: 0, y: 0, w: BAND, h: 1.28, fill: { color: theme.primary } });
  slide.addShape('rect', { x: 0, y: 1.28, w: BAND, h: 0.07, fill: { color: theme.gold } });
  slide.addText(label.toUpperCase(), { x: MX, y: 0.2, w: 12, h: 0.3, color: theme.gold, fontFace: FONT, fontSize: 12, bold: true, charSpacing: 2 });
  slide.addText(title, { x: MX, y: 0.5, w: CW, h: 0.7, ...titleCfg() });
  slide.addShape('line', { x: MX, y: 7.0, w: CW, h: 0, line: { color: LINE, width: 1 } });
  slide.addText('Genuine Homes', { x: MX, y: 7.05, w: 6, h: 0.3, color: MUTED, fontFace: FONT, fontSize: 10 });
  if (pageNo) slide.addText(String(pageNo), { x: BAND - 1.1, y: 7.05, w: 0.5, h: 0.3, align: 'right', color: MUTED, fontFace: FONT, fontSize: 10 });
  return slide;
}

function bulletRuns(items, theme) {
  const out = [];
  for (const it of items) {
    if (typeof it === 'string') {
      out.push({ text: it, options: { bullet: { code: '25AA', indent: 20 }, breakLine: true, color: INK } });
    } else {
      out.push({ text: it.lead, options: { bullet: { code: '25AA', indent: 20 }, bold: true, color: theme.primary, breakLine: false } });
      out.push({ text: '  —  ' + it.text, options: { color: INK, breakLine: true } });
    }
  }
  return out;
}

function addBullets(slide, theme, items, box = {}) {
  slide.addText(bulletRuns(items, theme), {
    x: box.x ?? MX, y: box.y ?? 1.7, w: box.w ?? CW, h: box.h ?? 5.0,
    fontFace: FONT, fontSize: box.fontSize ?? 16, valign: 'top',
    lineSpacingMultiple: 1.25, paraSpaceAfter: 10,
  });
}

function addTable(slide, theme, headers, rows, colW) {
  const head = headers.map((h) => ({ text: h, options: { fill: { color: theme.primary }, color: 'FFFFFF', bold: true } }));
  const body = rows.map((r, ri) => r.map((c) => ({ text: c, options: { fill: { color: ri % 2 ? 'F3F6F4' : 'FFFFFF' }, color: INK } })));
  slide.addTable([head, ...body], {
    x: MX, y: 1.7, w: CW, colW,
    border: { type: 'solid', color: LINE, pt: 1 },
    fontFace: FONT, fontSize: 12.5, valign: 'middle', rowH: 0.32, margin: 5,
  });
}

function addCallout(slide, theme, { x, y, w, h, heading, text }) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.06, fill: { color: 'F3F7F4' }, line: { color: theme.primary, width: 1 } });
  slide.addShape('rect', { x, y, w: 0.12, h, fill: { color: theme.gold } });
  slide.addText(heading, { x: x + 0.3, y: y + 0.15, w: w - 0.5, h: 0.4, color: theme.primary, bold: true, fontFace: FONT, fontSize: 14 });
  slide.addText(text, { x: x + 0.3, y: y + 0.58, w: w - 0.5, h: h - 0.7, color: INK, fontFace: FONT, fontSize: 13.5, valign: 'top', lineSpacingMultiple: 1.15 });
}

function closing(pptx, theme, { label, title, lead, commands }) {
  const slide = header(pptx, theme, label, title);
  slide.addText(lead, { x: MX, y: 1.7, w: CW, h: 0.8, color: INK, fontFace: FONT, fontSize: 16, lineSpacingMultiple: 1.2 });
  slide.addShape('roundRect', { x: MX, y: 2.7, w: CW, h: 3.4, rectRadius: 0.04, fill: { color: '0F172A' } });
  slide.addText('$ ' + commands.join('\n$ '), { x: MX + 0.3, y: 2.95, w: CW - 0.6, h: 2.9, color: 'A7F3D0', fontFace: MONO, fontSize: 14, valign: 'top', lineSpacingMultiple: 1.4 });
  return slide;
}

// ── Render a deck from its data ───────────────────────────────────────────────
async function buildDeck(theme, fileName, slides) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Genuine Homes';
  pptx.company = 'Genuine Homes';
  let page = 0;
  for (const s of slides) {
    if (s.type === 'cover') {
      cover(pptx.addSlide(), theme, s);
      continue;
    }
    page += 1;
    if (s.type === 'bullets') {
      const slide = header(pptx, theme, s.label, s.title, page);
      addBullets(slide, theme, s.items, s.box);
      if (s.note) slide.addText(s.note, { x: MX, y: 6.4, w: CW, h: 0.5, italic: true, color: MUTED, fontFace: FONT, fontSize: 12 });
    } else if (s.type === 'table') {
      const slide = header(pptx, theme, s.label, s.title, page);
      addTable(slide, theme, s.headers, s.rows, s.colW);
      if (s.note) slide.addText(s.note, { x: MX, y: 6.5, w: CW, h: 0.4, italic: true, color: MUTED, fontFace: FONT, fontSize: 12 });
    } else if (s.type === 'decisions') {
      const slide = header(pptx, theme, s.label, s.title, page);
      const n = s.items.length;
      const gap = 0.3;
      const h = (5.1 - gap * (n - 1)) / n;
      s.items.forEach((d, i) => addCallout(slide, theme, { x: MX, y: 1.7 + i * (h + gap), w: CW, h, heading: d.heading, text: d.text }));
    } else if (s.type === 'split') {
      const slide = header(pptx, theme, s.label, s.title, page);
      addBullets(slide, theme, s.items, { x: MX, y: 1.7, w: 7.0, h: 5.0 });
      addCallout(slide, theme, { x: 7.9, y: 1.7, w: CW - 7.3, h: 4.9, heading: s.callout.heading, text: s.callout.text });
    } else if (s.type === 'closing') {
      page -= 1; // closing renders its own header
      closing(pptx, theme, s);
    }
  }
  await pptx.writeFile({ fileName: join(OUT, fileName) });
  console.log('  ✓ ' + fileName);
}

// ── Themes ────────────────────────────────────────────────────────────────────
const T = {
  overview: { primary: '14532D', light: 'FFFFFF', gold: 'E9A23B' },
  s0: { primary: '334E68', light: 'FFFFFF', gold: 'F0A202' },
  s1: { primary: '1D6A66', light: 'FFFFFF', gold: 'E9C46A' },
  s2: { primary: '4338CA', light: 'FFFFFF', gold: 'F59E0B' },
  s3: { primary: '2D6A4F', light: 'FFFFFF', gold: 'E9A23B' },
  s4: { primary: '0F766E', light: 'FFFFFF', gold: 'F59E0B' },
  s5: { primary: '9A3412', light: 'FFFFFF', gold: 'F59E0B' },
  s6: { primary: 'A16207', light: 'FFFFFF', gold: 'FACC15' },
};

const FOOT = 'Genuine Homes · East Africa real estate · rent · buy · installments';

// ── Deck content ────────────────────────────────────────────────────────────
const decks = [
  {
    theme: T.overview,
    file: '00-genuine-homes-overview.pptx',
    slides: [
      { type: 'cover', kicker: 'Project Overview', title: 'Genuine Homes', subtitle: 'A real estate rental & ownership platform for East Africa — launching in Uganda.', footer: FOOT },
      { type: 'bullets', label: 'What it is', title: 'One platform, three ways to get a home', items: [
        { lead: 'Rent', text: 'monthly or yearly rentals with digital agreements' },
        { lead: 'Buy outright', text: 'verified sale listings' },
        { lead: 'Buy in installments', text: 'a transparent ownership engine with deposit + schedule' },
        { lead: 'Trust', text: 'listing verification (land titles, ownership docs)' },
        { lead: 'Payments', text: "Mobile Money — MTN MoMo & Airtel Money — plus cards" },
      ] },
      { type: 'table', label: 'Roadmap', title: 'Built stage by stage', headers: ['Stage', 'Title', 'Status'], colW: [1.3, 8.3, 2.5], rows: [
        ['0', 'Monorepo foundation', 'Done'],
        ['1', 'Database schema (Prisma + PostGIS)', 'Done'],
        ['2', 'Auth module (JWT + RBAC)', 'Done'],
        ['3', 'Properties & Listings (CRUD + search)', 'Done'],
        ['4', 'Web frontend MVP', 'Done'],
        ['5', 'Payments (Flutterwave + ledger)', 'Done'],
        ['6', 'Installment engine + web charts', 'Done'],
        ['7+', 'Verification, chat, mobile app', 'Next'],
      ] },
      { type: 'table', label: 'Architecture', title: 'Technology stack', headers: ['Layer', 'Choice'], colW: [3.4, 8.7], rows: [
        ['Web frontend', 'React + TypeScript + Vite + Tailwind + TanStack Query + Zustand'],
        ['Backend', 'NestJS (TypeScript) + Prisma — modular monolith'],
        ['Database', 'PostgreSQL + PostGIS, Redis'],
        ['Payments', 'Flutterwave (MTN MoMo, Airtel Money, cards)'],
        ['Media', 'Cloudinary'],
        ['Notifications', "Firebase Cloud Messaging + Africa's Talking SMS"],
      ] },
      { type: 'closing', label: 'Get started', title: 'Run it locally', lead: 'Each stage is a git checkpoint. Spin up the infrastructure and the API:', commands: ['pnpm install', 'pnpm db:up', 'pnpm db:migrate && pnpm db:seed', 'pnpm dev:api    # http://localhost:3100/api'] },
    ],
  },
  {
    theme: T.s0,
    file: 'stage-0-monorepo-foundation.pptx',
    slides: [
      { type: 'cover', kicker: 'Stage 0', title: 'Monorepo Foundation', subtitle: 'The project skeleton: backend, web app, shared code, and local infrastructure.', footer: FOOT },
      { type: 'bullets', label: 'Goal', title: 'Why this stage', items: [
        'Stand up one repository for the whole product',
        'Share domain types between backend and frontend from day one',
        'Provide a real database to develop against locally',
      ] },
      { type: 'bullets', label: 'What was built', title: 'A pnpm workspace + local infra', items: [
        { lead: 'apps/api', text: 'the NestJS backend' },
        { lead: 'apps/web', text: 'the React web app (scaffolded in Stage 4)' },
        { lead: 'packages/shared', text: 'TypeScript types + Zod schemas shared by both' },
        { lead: 'docker-compose', text: 'PostgreSQL 16 + PostGIS 3.4 and Redis 7' },
        { lead: 'Root scripts', text: 'db:up, db:migrate, db:seed, dev:api, dev:web, build, lint, test' },
      ] },
      { type: 'decisions', label: 'Key decision', title: 'Monorepo from day one', items: [
        { heading: 'Adopt a pnpm monorepo immediately', text: 'The spec repeatedly requires sharing Zod schemas and DTO types between the API and the web app. A shared package keeps a single source of truth for domain types from the very first commit — rather than retrofitting a monorepo later.' },
      ] },
      { type: 'closing', label: 'How to run', title: 'Bootstrap the workspace', lead: 'Install dependencies and start the local database + cache:', commands: ['pnpm install', 'pnpm db:up    # Docker Desktop must be running'] },
    ],
  },
  {
    theme: T.s1,
    file: 'stage-1-database-schema.pptx',
    slides: [
      { type: 'cover', kicker: 'Stage 1', title: 'Database Schema', subtitle: 'The whole domain modelled in Prisma — with PostGIS for map search.', footer: FOOT },
      { type: 'bullets', label: 'What was built', title: 'A typed, migrated data model', items: [
        { lead: 'Core', text: 'users, properties, listings' },
        { lead: 'Money', text: 'installment_plans, installment_payments, one unified payments ledger' },
        { lead: 'Support', text: 'property_images, rental_agreements, verifications, favorites, reviews, messages, notifications' },
        { lead: 'Auth', text: 'refresh_tokens (added ahead of Stage 2)' },
        { lead: 'Wiring', text: 'a global PrismaModule + idempotent seed (admin, landlord, tenant, 2 properties, 2 listings)' },
      ] },
      { type: 'bullets', label: 'Design rules', title: 'Rules baked into the schema', items: [
        { lead: 'Money is Decimal', text: 'never float — floats lose cents' },
        { lead: 'Soft deletes', text: 'deleted_at on users/properties/listings — never lose financial history' },
        { lead: 'PostGIS', text: 'geography(Point, 4326) on properties for "within N km" search' },
        { lead: 'Conventions', text: 'snake_case columns, UUID keys, timestamptz' },
        { lead: 'Indexes', text: '(district,type), (listing_type,is_active,price), GIN on amenities, GiST on location' },
      ] },
      { type: 'decisions', label: 'Verification', title: 'Confirmed working', items: [
        { heading: 'Migration applied to Dockerised Postgres + PostGIS', text: 'All 14 tables and the hand-written GiST index were present; the seed ran successfully.' },
        { heading: 'Spatial query returned correct distances', text: 'ST_Distance gave Nakawa house 4.04 km and Gayaza plot 10.65 km from Kampala centre. The API built cleanly.' },
      ] },
      { type: 'closing', label: 'How to resume', title: 'Prepare the database', lead: 'Start Postgres, generate the client, and seed demo data:', commands: ['pnpm db:up', 'pnpm --filter @genuine-homes/api prisma:generate', 'pnpm --filter @genuine-homes/api prisma:seed'] },
    ],
  },
  {
    theme: T.s2,
    file: 'stage-2-auth-module.pptx',
    slides: [
      { type: 'cover', kicker: 'Stage 2', title: 'Auth Module', subtitle: 'JWT authentication and role-based access control for the whole platform.', footer: FOOT },
      { type: 'table', label: 'Endpoints', title: '/api/auth', headers: ['Method & path', 'Auth', 'Purpose'], colW: [3.6, 2.1, 6.4], rows: [
        ['POST /register', 'public', 'Create an account and start a session'],
        ['POST /login', 'public', 'Log in with email or phone + password'],
        ['POST /refresh', 'public', 'Exchange a refresh token for a new pair'],
        ['POST /logout', 'bearer', 'Revoke a refresh token (log out)'],
        ['GET /me', 'bearer', 'Get the current authenticated user'],
      ] },
      { type: 'bullets', label: 'Security model', title: 'How it protects accounts', items: [
        { lead: 'Passwords', text: 'argon2id hashing + a decoy verify so timing cannot enumerate users' },
        { lead: 'Tokens', text: 'short-lived access JWT + long-lived refresh JWT, each tagged by type' },
        { lead: 'Rotation', text: 'refresh tokens stored as SHA-256 hashes; reuse of a rotated token revokes every session' },
        { lead: 'RBAC', text: 'global JwtAuthGuard (secure by default, @Public opt-out) + @Roles guard' },
        { lead: 'Rate limiting', text: '100 req/min/IP, tightened to 5/min on login & register' },
      ] },
      { type: 'decisions', label: 'Key decisions', title: 'Why it is built this way', items: [
        { heading: 'JWT guards on @nestjs/jwt, not Passport', text: 'Fewer dependencies, full control over refresh-token rotation, and simpler to unit test.' },
        { heading: 'Global guard, secure by default', text: 'Every endpoint requires auth unless marked @Public — the right posture for a financial platform.' },
      ] },
      { type: 'bullets', label: 'Verification', title: 'Confirmed working', items: [
        'nest build + TypeScript type check pass',
        '16 unit tests: register, login, wrong-password & unknown-user rejection, refresh rotation, reuse detection, logout',
        'RolesGuard tests + an AppModule DI smoke test that boots the graph with Prisma stubbed (no DB)',
      ] },
      { type: 'closing', label: 'How to try it', title: 'Log in and call a protected route', lead: 'Seeded dev password is Password123!', commands: ["curl -XPOST localhost:3100/api/auth/login -d '{\"emailOrPhone\":\"+256700000003\",\"password\":\"Password123!\"}'", 'curl localhost:3100/api/auth/me -H "authorization: Bearer <accessToken>"'] },
    ],
  },
  {
    theme: T.s3,
    file: 'stage-3-properties-and-listings.pptx',
    slides: [
      { type: 'cover', kicker: 'Stage 3', title: 'Properties & Listings', subtitle: 'The catalogue: manage properties, offer them, and discover them with location-aware search.', footer: FOOT },
      { type: 'table', label: 'Endpoints', title: 'Properties & listings API', headers: ['Method & path', 'Auth', 'Purpose'], colW: [5.0, 2.2, 4.9], rows: [
        ['POST /properties', 'seller', 'Create a property'],
        ['GET /properties/:id', 'public', 'Detail: gallery + listings + coordinates'],
        ['GET /properties/mine', 'bearer', "The user's own properties (paginated)"],
        ['POST /properties/:id/listings', 'owner', 'Create a rent/sale/installment listing'],
        ['GET /listings', 'public', 'Search — facets + "near me"'],
        ['PATCH / DELETE /listings/:id', 'owner', 'Update or soft-delete a listing'],
      ] },
      { type: 'split', label: 'Listing types', title: 'Three ways to offer a property', items: [
        { lead: 'rent', text: 'requires a period (monthly/yearly)' },
        { lead: 'sale', text: 'outright purchase, no rent terms' },
        { lead: 'installment', text: 'deposit % + months within guardrails' },
        'Switching a listing type clears the now-irrelevant fields',
        'One shared rule validates the shape (listingShapeError)',
      ], callout: { heading: 'Owner-scoped by design', text: 'Only sellers (landlord / agent / developer / admin) can own properties, and every mutation is ownership-checked. Admins bypass.' } },
      { type: 'bullets', label: 'Search', title: 'Faceted + "near me"', items: [
        { lead: 'Facets', text: 'district, property type, listing type, price range, bedrooms, verified-only' },
        { lead: 'Near me', text: 'lat/lng + radius — PostGIS ST_DWithin, distance returned in metres' },
        { lead: 'Sorting', text: 'newest, price, or distance (geo defaults to nearest-first)' },
        { lead: 'Listing-centric', text: 'one hit per listing with its property embedded — matches how people search' },
      ] },
      { type: 'decisions', label: 'Key decisions', title: 'Notable choices', items: [
        { heading: 'Parameterised raw SQL for search', text: 'The PostGIS location is an Unsupported Prisma type, so search builds safe Prisma.sql fragments (never string interpolation), runs the geo query, then hydrates rows via Prisma.' },
        { heading: 'Soft-delete cascades', text: 'Deleting a property deactivates its listings, so both leave search while financial history is preserved.' },
      ] },
      { type: 'bullets', label: 'Verification', title: 'Confirmed live (Docker Postgres + PostGIS)', items: [
        'Geo search at Kampala centre / 8 km returned only the Nakawa house at 4035 m (Gayaza plot ~10.6 km correctly excluded)',
        'Created property + rent listing surfaced in a 3 km search',
        'Tenant create blocked (403); rent-without-period rejected (400)',
        'Soft-delete returned 204, then detail 404s and the listing leaves search',
        '34 unit tests green; nest build + type check pass',
      ] },
      { type: 'closing', label: 'How to try it', title: 'Search the catalogue', lead: 'Boot the API with seeded data, then query listings:', commands: ['pnpm db:up && pnpm db:migrate && pnpm db:seed', 'pnpm dev:api', "curl 'localhost:3100/api/listings?district=Kampala&listingType=rent'", "curl 'localhost:3100/api/listings?lat=0.3476&lng=32.5825&radiusM=8000'"] },
    ],
  },
  {
    theme: T.s4,
    file: 'stage-4-web-frontend.pptx',
    slides: [
      { type: 'cover', kicker: 'Stage 4', title: 'Web Frontend MVP', subtitle: 'A real React app on top of the auth and catalogue APIs — browse, search, sign in, sell.', footer: FOOT },
      { type: 'bullets', label: 'What was built', title: 'A React + Vite single-page app', items: [
        { lead: 'Stack', text: 'React + TypeScript + Vite + Tailwind + TanStack Query + Zustand + React Router' },
        { lead: 'Shared', text: 'consumes @genuine-homes/shared types AND Zod schemas for form validation' },
        { lead: 'Maps', text: 'Leaflet result markers + search radius, driven by browser geolocation' },
        { lead: 'Design', text: 'a small Tailwind design system (brand greens + gold) matching these decks' },
      ] },
      { type: 'table', label: 'Pages', title: 'Routes', headers: ['Route', 'Access', 'What it does'], colW: [3.0, 2.0, 7.1], rows: [
        ['/', 'public', 'Search: facets, near-me, cards, map, pagination'],
        ['/listings/:id', 'public', 'Detail: gallery, specs, amenities, map'],
        ['/login · /register', 'public', 'Auth forms (shared Zod validation)'],
        ['/dashboard', 'protected', 'Seller: your properties + create forms'],
      ] },
      { type: 'split', label: 'Auth flow', title: 'Sessions that just work', items: [
        { lead: 'Store', text: 'a persisted Zustand session survives reloads' },
        { lead: 'Client', text: 'axios attaches the access token to each request' },
        { lead: 'Rotation', text: 'on 401, a single-flight refresh runs, then the request replays' },
        { lead: 'Guarded', text: 'protected routes redirect to /login and back' },
      ], callout: { heading: 'One source of truth', text: 'The same Zod schemas the API mirrors validate the web forms — change a rule once in @genuine-homes/shared and both sides follow.' } },
      { type: 'decisions', label: 'Key decisions', title: 'Notable choices', items: [
        { heading: 'Dev proxy instead of CORS', text: 'Vite proxies /api to the NestJS backend, so the SPA and API share an origin in development and the client uses a relative /api base URL.' },
        { heading: 'Explicit re-exports in shared', text: 'The shared package is CommonJS (for the API + Jest); bundlers cannot see through export *, so the barrel uses explicit re-exports and Vite is told to transform the workspace package.' },
      ] },
      { type: 'bullets', label: 'Verification', title: 'Confirmed working', items: [
        'tsc type check + vite build succeed (production bundle emitted)',
        'Backend unaffected — 34 API unit tests still pass',
        'Live: the Vite dev proxy reached the API — health, listing search (2 seeded), and landlord login all succeeded through :5173',
        'SPA → proxy → API → Postgres path confirmed end-to-end',
      ] },
      { type: 'closing', label: 'How to run', title: 'Start the full stack', lead: 'Bring up the database, the API, and the web app:', commands: ['pnpm install && pnpm build:shared', 'pnpm db:up && pnpm db:migrate && pnpm db:seed', 'pnpm dev:api    # http://localhost:3100/api', 'pnpm dev:web    # http://localhost:5173'] },
    ],
  },
  {
    theme: T.s5,
    file: 'stage-5-payments.pptx',
    slides: [
      { type: 'cover', kicker: 'Stage 5', title: 'Payments Module', subtitle: 'The first stage where money moves — gateway, unified ledger, idempotent webhooks.', footer: FOOT },
      { type: 'table', label: 'Endpoints', title: '/api/payments', headers: ['Method & path', 'Auth', 'Purpose'], colW: [3.6, 2.6, 5.9], rows: [
        ['POST /initiate', 'bearer', 'Create a pending payment + checkout URL'],
        ['GET /mine', 'bearer', 'List your payments'],
        ['GET /:id', 'owner/admin', "One payment's status"],
        ['POST /webhook', 'gateway signature', 'Settle a payment (idempotent)'],
      ] },
      { type: 'split', label: 'Strategy', title: 'One interface, two gateways', items: [
        { lead: 'Flutterwave', text: 'real hosted checkout when a secret key is set' },
        { lead: 'Mock', text: 'fake checkout + simple webhook when unconfigured' },
        { lead: 'Selection', text: 'a factory picks the gateway at startup' },
        { lead: 'Methods', text: 'MoMo, Airtel Money, card, bank' },
      ], callout: { heading: 'Usable without keys', text: 'The mock gateway makes the whole flow work end-to-end in dev/CI. Dropping in Flutterwave sandbox keys flips it to the real gateway with no code change.' } },
      { type: 'decisions', label: 'Idempotency', title: 'Webhooks you can trust', items: [
        { heading: 'Only pending payments transition', text: 'The webhook updates WHERE status = pending, so a duplicate or out-of-order callback is a no-op — proven live (a repeated "failed" webhook left a settled payment successful).' },
        { heading: 'Unique provider_ref', text: 'The ledger\'s unique gateway-reference column (from Stage 1) is the second line of defence against recording the same transaction twice.' },
      ] },
      { type: 'bullets', label: 'Verification', title: 'Confirmed working', items: [
        '51 unit tests green (initiate, gateway failure, bad signature, settle, duplicate no-op, ownership, Flutterwave signature/parse)',
        'Live (mock gateway + Docker Postgres): initiate a 16M UGX deposit -> pending + checkout URL',
        'Webhook settled it successful and recorded providerRef',
        'Duplicate "failed" webhook ignored — status stayed successful',
        'GET /:id without a token -> 401; mine listed the payment',
      ] },
      { type: 'closing', label: 'How to try it', title: 'Pay, then settle', lead: 'Initiate a payment, then simulate the gateway callback:', commands: ['pnpm db:up && pnpm dev:api', "curl -XPOST .../api/payments/initiate -d '{\"purpose\":\"deposit\",\"amount\":16000000,\"provider\":\"mtn_momo\"}'", "curl -XPOST .../api/payments/webhook -d '{\"tx_ref\":\"<id>\",\"status\":\"successful\",\"id\":\"demo-1\"}'"] },
    ],
  },
  {
    theme: T.s6,
    file: 'stage-6-installments.pptx',
    slides: [
      { type: 'cover', kicker: 'Stage 6', title: 'Installment Engine', subtitle: 'The headline feature: deposit + monthly schedule, a plan state machine, and a livelier yellow web app with live charts.', footer: FOOT },
      { type: 'table', label: 'Endpoints', title: '/api/installment-plans', headers: ['Method & path', 'Purpose'], colW: [6.0, 6.1], rows: [
        ['POST /', 'Create a plan (deposit % + months)'],
        ['GET /mine · GET /:id', 'Plans + schedule + progress'],
        ['POST /:id/deposit', 'Start the deposit payment'],
        ['POST /:id/installments/:iid/pay', 'Pay a scheduled installment'],
        ['POST /:id/cancel', 'Cancel a plan awaiting its deposit'],
      ] },
      { type: 'split', label: 'How it works', title: 'Plan → schedule → ownership', items: [
        { lead: 'Exact math', text: 'Decimal deposit + schedule; last installment absorbs the remainder' },
        { lead: 'State machine', text: 'pending_deposit → active → completed (cancelled / defaulted)' },
        { lead: 'Event-driven', text: 'a settled payment emits payment.succeeded; the engine reacts' },
        { lead: 'No coupling', text: 'payments never imports installments — events decouple them' },
      ], callout: { heading: 'Deposit activates, last installment completes', text: 'Paying the deposit flips the plan to active; paying the final installment marks it paid and completes the plan — all triggered by the payment webhook.' } },
      { type: 'bullets', label: 'Web', title: 'Lively, yellow, charted', items: [
        { lead: 'Theme', text: 'recoloured to a golden-yellow brand with a bright accent' },
        { lead: 'Interactive', text: 'toasts, entrance animations, hover-lift cards, skeletons' },
        { lead: 'Live charts', text: 'payments-over-time, properties-by-status, plan progress donut (polled)' },
        { lead: 'Journey', text: 'buy-on-installment panel → plan page → mock checkout settles it in-browser' },
      ] },
      { type: 'bullets', label: 'Seed', title: 'New demo accounts', items: [
        { lead: 'daniel@gmail.com', text: 'a property developer (can list)' },
        { lead: 'roro@gmail.com', text: 'a buyer with a live 24-month plan (4 months paid)' },
        'Matching ledger rows give the charts real data on first run',
        'Dev password for all seeded users: Password123!',
      ] },
      { type: 'bullets', label: 'Verification', title: 'Confirmed working', items: [
        'nest build + tsc + vite build pass; 59 backend unit tests green',
        'Live: created a 30% / 12-month plan -> paid deposit -> plan auto-activated',
        'Paid installment #1 -> 1/12 paid (driven by the payment event)',
        'Web proxy served plans + 7 payments feeding the dashboard charts',
      ] },
      { type: 'closing', label: 'How to run', title: 'See it in the browser', lead: 'Seed, run both apps, and log in as Roro:', commands: ['pnpm db:up && pnpm db:migrate && pnpm db:seed', 'pnpm dev:api && pnpm dev:web', '# log in: roro@gmail.com / Password123! -> Dashboard', '# or open an installment listing -> "Buy on installment"'] },
    ],
  },
];

console.log('Generating decks into docs/presentations/ ...');
for (const d of decks) await buildDeck(d.theme, d.file, d.slides);
console.log('Done.');
