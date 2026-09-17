# NexusFinance — variables de entorno compartidas entre módulos.
import os

from dotenv import load_dotenv

load_dotenv()

from groq import Groq

DATABASE_URL = os.environ.get("DATABASE_URL", "")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
CRON_AUTH_TOKEN = os.environ.get("CRON_AUTH_TOKEN", "")
ALLOWED_USER_IDS = {int(x) for x in os.environ.get("ALLOWED_USER_IDS", "").split(",") if x.strip()}

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None