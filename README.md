# Rimora

Rimora is being built as a central, official home for translated novels and original stories.

Right now, translators often have to publish across personal websites, scattered groups, and platforms that were never designed around the way translation work actually happens. Readers have to follow the same trail in reverse. It is difficult to know where a project lives, who is working on it, or whether a translation is still active.

The idea behind Rimora is simple: bring translators and readers into one global platform. A translator should be able to create a story, publish their work, and build an audience without first needing to join or create a translation group. Readers should have one friendly place to discover stories, follow projects, and read the work people have chosen to share.

This is not meant to erase the communities and groups that already do valuable work. It is meant to give individuals and groups a dependable public home when they want one.

Rimora is still in development and far from perfect. Some parts are rough, some features are incomplete, and the product is still finding its shape. That is intentional: this repository is the working project, not a finished promise. The goal is to keep improving it until publishing and reading translated fiction feels straightforward, welcoming, and connected.

## Development

The project uses Vite, React, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

You need Node.js and npm installed locally.

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

The development server starts with hot reload. To create a production build:

```sh
npm run build
```

## Environment

Create a local `.env` file for the Supabase and application settings required by your environment. Never commit real credentials, database passwords, or API keys. Use `.env.example` for a safe list of variable names when sharing configuration.

Copy `.env.example` to `.env.local`, then set `VITE_SUPABASE_PUBLISHABLE_KEY` to the public publishable key from the Supabase dashboard for project `lsmmpperermqmpfmwmkv`. The legacy public anon key is also supported through `VITE_SUPABASE_ANON_KEY`. Never use a service-role key in the browser. Restart `npm run dev` after changing these settings; production builds must have them set at build time. Vite only exposes variables prefixed with `VITE_` to the browser.

Email/password sign-in uses Supabase Auth. Username sign-in also requires the `get_email_by_username` function from the database migrations. For Google sign-in and email verification, configure the provider and allow your application URL (including `http://localhost:8080` for local development) in Supabase Authentication's redirect URLs.

## Project Structure

- `src/` contains the React application and pages.
- `public/` contains static assets and PWA metadata.
- `supabase/functions/` contains server-side Edge Functions.
- `supabase/migrations/` contains database migrations.

The project is currently developed through the local workspace and Supabase tooling. Deployment details will become more formal as the platform moves closer to release.
