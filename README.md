# NexusFinance
**Coste cero**. PosgreSQL en Supabase, API FastAPI en Render/Railway (free), Bot de Telegram, cron con GitHub Actions, categorización con Groq (free tier).

## Estructura
- `supabase/schema.sql` — esquema completo para ejecutar en el SQL Editor de Supabase.
- `backend/` — API FastAPI + bot de Telegram.
- `.github/workflows/cron.yml` — tareas programadas (barrido semanal y revisión de suscripciones).

## Puesta en marcha (resumen)
1. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql` en SQL Editor.
2. Copia `.env.example` a `.env` y llena: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`, `CRON_AUTH_TOKEN`.
3. Local: `uvicorn backend.main:app --reload` (necesitas `pip install -r requirements.txt`).
4. En producción (Render): variables de entorno + desplegar como servicio web con `start.sh`.
5. Configura el webhook de Telegram apuntando a `https://TU_DOMINIO/webhook/<CRON_AUTH_TOKEN>`.
6. Sube el repo a GitHub (privado) — el workflow se encarga del cron semanal y de suscripciones.

> Nota: mientras Render "duerme" el servicio gratuito, el primer mensaje tarda unos segundos en despertarlo. Normal.