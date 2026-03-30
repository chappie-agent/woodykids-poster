# WoodyKids Post Builder

A Next.js 14 (App Router) application for creating and scheduling social media posts for WoodyKids on Instagram and Facebook via Zernio.

## Features

- **Session Management**: Accept session data from the /post skill, store in Supabase
- **Photo Grid**: Select and reorder product images with visual numbering
- **Caption Builder**: Choose from pre-written openers, bodies, and closers, or write custom text
- **Hashtag Selection**: Toggle hashtags to include in the post
- **Live Preview**: Instagram phone mockup showing first selected photo and composed caption
- **Smart Scheduling**:
  - Now (immediate)
  - Next standard time (weekdays 19:00, weekends 13:00)
  - Today at standard time
  - Tomorrow at standard time
  - Custom date/time
- **Multi-Platform**: Select Instagram, Facebook, or both
- **Word Counter**: Live word count of composed caption
- **Integration**: Posts uploaded to Zernio for scheduling

## Project Structure

```
woodykids-poster-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── sessions/route.ts    # Session CRUD endpoints
│   │   │   └── schedule/route.ts    # Post scheduling & upload
│   │   ├── session/[id]/page.tsx    # Main dashboard (interactive builder)
│   │   ├── page.tsx                 # Home (list pending sessions)
│   │   ├── layout.tsx               # Root layout with Inter font
│   │   └── globals.css              # Tailwind + custom styles
│   └── lib/
│       ├── supabase.ts              # Supabase client setup
│       └── types.ts                 # TypeScript interfaces
├── next.config.js                   # Next.js configuration
├── tailwind.config.js               # WoodyKids brand colors
├── tsconfig.json                    # TypeScript config
├── postcss.config.js                # PostCSS + autoprefixer
├── package.json                     # Dependencies
├── .env.example                     # Environment variables template
└── .gitignore                       # Git ignore rules
```

## Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ZERNIO_API_KEY`
   - `ZERNIO_INSTAGRAM_ACCOUNT_ID` (pre-filled: 69ca53996cb7b8cf4cb0fdf4)
   - `ZERNIO_FACEBOOK_ACCOUNT_ID` (pre-filled: 69ca54956cb7b8cf4cb1015c)

3. **Create Supabase tables**:
   ```sql
   -- sessions table
   create table sessions (
     id uuid primary key default gen_random_uuid(),
     product_ids text[],
     images jsonb,
     caption_options jsonb,
     status text default 'pending',
     created_at timestamp default now(),
     updated_at timestamp default now()
   );

   -- posts table
   create table posts (
     id uuid primary key default gen_random_uuid(),
     session_id uuid references sessions(id),
     caption text,
     image_urls text[],
     platforms text[],
     scheduled_for timestamp,
     timezone text,
     zernio_post_id text,
     status text default 'scheduled',
     created_at timestamp default now(),
     updated_at timestamp default now()
   );
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## API Endpoints

### POST /api/sessions
Creates a new session. Called from the /post skill.

**Request**:
```json
{
  "product_ids": ["prod1", "prod2"],
  "images": [
    { "id": "img1", "url": "https://cdn.shopify.com/...", "product_id": "prod1" }
  ],
  "caption_options": {
    "openers": ["Hey there!", "Welcome!"],
    "bodies": ["Check this out", "Look what's new"],
    "closers": ["Cheers", "See you soon"],
    "hashtags": ["#houten", "#speelgoed"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "session_id": "uuid",
  "url": "https://app.example.com/session/uuid"
}
```

### GET /api/sessions
Lists all pending sessions.

**Response**:
```json
{
  "success": true,
  "sessions": [{ "id": "uuid", "status": "pending", ... }]
}
```

### POST /api/schedule
Schedules a post. Downloads images, uploads to Zernio, creates post.

**Request**:
```json
{
  "session_id": "uuid",
  "caption": "Full composed caption...",
  "image_urls": ["https://cdn.shopify.com/..."],
  "platforms": ["instagram", "facebook"],
  "scheduled_for": "2026-03-30T19:00:00Z",
  "timezone": "Europe/Amsterdam"
}
```

**Response**:
```json
{
  "success": true,
  "post_id": "uuid",
  "zernio_post_id": "zernio-id"
}
```

## Styling

The app uses Tailwind CSS with WoodyKids brand colors:
- **Primary**: #5a7247 (forest green)
- **Secondary**: #7a9963 (sage green)
- **Background**: #f5f0eb (cream)
- **Accent**: #b8d4a3 (light sage)

Custom Tailwind components available:
- `.btn-primary` - Primary action button
- `.btn-secondary` - Secondary action button
- `.btn-outline` - Outlined button
- `.chip` / `.chip.active` - Hashtag/toggle chips
- `.card` - Content card with shadow
- `.option-card` / `.option-card.selected` - Caption option cards

## Deployment

Deploy to Vercel:

```bash
vercel deploy
```

The app will automatically:
- Set up environment variables from your Vercel dashboard
- Use the Vercel domain for session URLs
- Enable Supabase real-time updates if configured

## Key Interactions

### Photo Selection
- Click any product image to select/deselect
- Selected images show a numbered badge
- Use arrow buttons in the selection strip to reorder

### Caption Composition
- Select pre-written options or toggle "Eigen tekst schrijven"
- Compose from openers (opening), bodies (main content), closers (sign-off)
- Click hashtags to toggle them on/off
- Word count updates live

### Scheduling
- Choose when to post with preset options or custom date/time
- Standard times: weekdays 19:00, weekends 13:00 (Dutch time)
- Select Instagram, Facebook, or both platforms

### Preview
- Instagram phone mockup shows first selected image
- Caption preview updates in real-time
- Word count indicator below preview

## Notes

- All text is in Dutch (nl-NL)
- Images are sourced from Shopify CDN
- Zernio API integration handles media upload and post creation
- Timezone is hardcoded to Europe/Amsterdam
- Service worker not required for this MVP
