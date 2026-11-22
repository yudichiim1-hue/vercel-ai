# Yemot IVR Server on Vercel

## Setup
1. Push repository to GitHub and import into Vercel.
2. Add environment variables in Vercel (`YM_API_TOKEN`, `DEEPGRAM_API_KEY`, `GEMINI_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY`, and optional Supabase keys).
3. Configure Yemot IVR extension:

```ini
type=api
api_link=https://YOUR-VERCEL-DOMAIN.vercel.app/api/ivr
api_log=no
white_list=yes
```
