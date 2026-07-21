"""
Groq + LLaMA-3 70B agent with tool-calling loop.
Supports: book_appointment, reschedule_appointment, cancel_appointment, check_availability
"""
import asyncio
import json
import logging
import time

from groq import Groq

from config import DOCTOR_NAMES, DOCTORS, GROQ_MODEL, clinic_now, clinic_today, settings
from core.metrics import LLM_LATENCY, TOOL_CALLS

logger = logging.getLogger(__name__)
# timeout + bounded retries so a hung Groq call can't pin a request forever
client = Groq(api_key=settings.GROQ_API_KEY, timeout=30.0, max_retries=2)

DOCTORS_TEXT = "\n".join([f"  {i+1}. {d['name']} — {d['specialty']} | {d.get('availability', '')} | {', '.join(d.get('languages', []))}" for i, d in enumerate(DOCTORS)])
DOCTORS_EXAMPLE = ", ".join([f"'{d}'" for d in DOCTOR_NAMES[:3]]) + " etc."

# ── Outbound Call System Prompt ────────────────────────────
OUTBOUND_SYSTEM_PROMPT = """\
You are a multilingual AI voice assistant making an outbound call to a patient on behalf of a healthcare clinic.
Your goal is to communicate clearly, politely, and efficiently.

LANGUAGE RULE:
- Respond ONLY in the language specified in the input.
- Supported: English, Hindi (Devanagari script), Tamil (Tamil script).

RESPONSE RULES:
- Keep the message SHORT — maximum 2 sentences.
- Be polite and conversational.
- Clearly mention: patient name, doctor name, appointment date & time.
- ALWAYS end with a clear question: confirm or reschedule?

PURPOSE-SPECIFIC BEHAVIOR:
1. reminder  → Inform about upcoming appointment. Ask to confirm or reschedule.
   Example: "Hello {name}, this is a reminder for your appointment with {doctor} {date} at {time}. Would you like to confirm or reschedule?"
2. followup  → Ask about health status after visit. Offer to book a follow-up.
   Example: "Hello {name}, we're checking in after your recent visit with {doctor}. Would you like to book a follow-up appointment?"
3. missed    → Mention missed appointment politely. Offer rescheduling.
   Example: "Hello {name}, it seems you missed your appointment with {doctor} today. Would you like to reschedule it?"

STRICT RULES:
- Do NOT generate long explanations.
- Do NOT include technical details or JSON.
- Do NOT assume confirmation.
- Do NOT hallucinate any information not provided.
- Do NOT exceed 2 sentences.
- NEVER translate or transliterate names, doctor names, IDs, phone numbers, dates or times — say them as given.

OUTPUT FORMAT:
Return ONLY the spoken message text. No JSON. No extra explanation.
"""

# ── System Prompt ──────────────────────────────────────────
SYSTEM_PROMPT = """\
You are SwasthyaAI — a real-time multilingual AI voice assistant for a healthcare clinic.
You communicate naturally in English, Hindi, and Tamil.

━━ LANGUAGE RULES ━━
{lang_directive}
• Hindi → Devanagari script | Tamil → Tamil script | English → English
• NEVER translate or transliterate: the brand name "SwasthyaAI", doctor names, patient names, appointment IDs, email addresses, phone numbers, dates and times — keep them EXACTLY as given, in every language.
• Keep responses SHORT and CONVERSATIONAL: 1–2 sentences maximum.

━━ CLINIC ━━
Doctors:
{doctors_list}
Clinic hours : 09:00 AM – 05:00 PM (slots every 30 min)
Each doctor only consults within their own listed hours — check_availability returns only valid slots.
No double booking. No past-date/time booking allowed.
Today's date : {today}
Current time : {now}

━━ TOOL USAGE (MANDATORY) ━━
• NEVER GUESS or INVENT a date, time, patient name, or doctor.
• ALWAYS ASK the user for their preferred date and time if they have not provided it.
• DO NOT call check_availability until the user has explicitly stated a date.
• CRITICAL: If you are asking the user a question (e.g., to get a date), DO NOT output any tool calls. Only output text.
• NEVER assume availability — always call check_availability first once you have the date.
• NEVER call book_appointment without EXPLICIT user confirmation ("yes", "हाँ", "ஆமாம்").
• Before booking, always confirm: "Confirm: [Doctor] on [Date] at [Time]?"
• On slot conflict, suggest up to 3 alternatives from check_availability result.
• For reschedule/cancel: call list_my_appointments to find the patient's appointments — NEVER ask the user to recite an appointment ID.
• If list_my_appointments returns several, ask which one (by doctor/date), then use its appointment_id.

━━ CONVERSATION FLOW ━━
1. Greet the user and ask how you can help. DO NOT list doctors immediately.
2. Wait for the user to provide their symptoms or ask for a specific doctor before offering doctor names.
3. Treat the conversation as a NEW booking by default.
4. ONLY ask about re-appointments or follow-ups IF the user explicitly mentions their last doctor or a past appointment.
5. Collect missing info one question at a time: name → doctor → date → time.
6. Call check_availability to verify the slot is free.
7. Confirm details with user.
8. On "yes" → call the booking/action tool.
9. Confirm success with appointment ID.

━━ MEMORY ━━
Use any [Patient memory:] context provided to avoid repeating questions.

━━ RESPONSE STYLE ━━
• 1–2 sentences, conversational, friendly, no jargon.
• No bullet points in spoken replies.
"""

# ── Tool Definitions ───────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": (
                "Check available appointment slots for a doctor on a specific date. "
                "DO NOT call this tool if the user hasn't provided a date. "
                "Always call this BEFORE confirming or booking any appointment."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor": {
                        "type": "string",
                        "description": f"Exact doctor name: {DOCTORS_EXAMPLE}",
                    },
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format",
                    },
                },
                "required": ["doctor", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": (
                "Book a clinic appointment. "
                "DO NOT guess or invent any parameters. "
                "Call ONLY after the user has explicitly confirmed (said yes/haan/aamaa)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name":   {"type": "string", "description": "Patient full name"},
                    "doctor": {"type": "string", "description": "Doctor name"},
                    "date":   {"type": "string", "description": "YYYY-MM-DD"},
                    "time":   {"type": "string", "description": "HH:MM (24-hour)"},
                },
                "required": ["name", "doctor", "date", "time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reschedule_appointment",
            "description": "Reschedule an existing appointment to a new date and time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "appointment_id": {"type": "string", "description": "Appointment ID (e.g. A1B2C3D4)"},
                    "new_date":       {"type": "string", "description": "YYYY-MM-DD"},
                    "new_time":       {"type": "string", "description": "HH:MM (24-hour)"},
                },
                "required": ["appointment_id", "new_date", "new_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_my_appointments",
            "description": (
                "List the current patient's upcoming appointments (IDs, doctors, dates, times). "
                "Call this FIRST whenever the user wants to cancel, reschedule, or asks about "
                "their appointments — do not ask them for an appointment ID."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_appointment",
            "description": "Cancel one of the patient's own appointments (get the ID from list_my_appointments).",
            "parameters": {
                "type": "object",
                "properties": {
                    "appointment_id": {"type": "string", "description": "Appointment ID to cancel"},
                },
                "required": ["appointment_id"],
            },
        },
    },
]


# ── Agent Loop ─────────────────────────────────────────────
LANG_NAMES = {
    "en": ("English", "English"),
    "hi": ("Hindi", "Devanagari script"),
    "ta": ("Tamil", "Tamil script"),
}

DEFAULT_LANG_RULES = (
    "• DEFAULT language is English.\n"
    "• ONLY switch language if the user explicitly speaks or types in Hindi or Tamil.\n"
    "• ALWAYS reply in the EXACT same language and script as the current user message."
)


def _lang_directive(reply_language: str | None) -> str:
    """The app's language selector overrides per-message detection."""
    if reply_language in LANG_NAMES:
        name, script = LANG_NAMES[reply_language]
        directive = (
            f"• APP LANGUAGE: the user selected {name} in the app. "
            f"EVERY reply — including confirmations, questions and error messages — "
            f"must be written ONLY in {name} ({script}), no matter which language "
            f"the user message or the tool results are in. Never fall back to English."
        )
        if reply_language != "en":
            directive += (
                "\n• CRITICAL EXCEPTION — NEVER translate or transliterate proper nouns and data: "
                "\"SwasthyaAI\", doctor names, patient names, appointment IDs, emails, "
                "phone numbers, dates and times stay EXACTLY as given, in Latin script, "
                "even inside a sentence in another script. Do NOT attach case suffixes to the "
                "Latin name — restructure the sentence around it instead.\n"
                "  WRONG: 'डॉ शर्मा', 'டாக்டர் சர்மாவுடன்'\n"
                "  RIGHT: 'Dr Sharma के साथ', 'Dr Sharma உடன் உங்கள் சந்திப்பு'"
            )
        return directive
    return DEFAULT_LANG_RULES


async def run_agent(
    messages: list,
    tool_executor,
    max_iter: int = 6,
    reply_language: str | None = None,
) -> tuple[str, list]:
    """
    Run the Groq LLaMA-3 tool-calling loop.
    Returns (final_text_response, updated_messages_list).
    """
    msgs = list(messages)  # work on a copy

    system = {
        "role": "system",
        "content": SYSTEM_PROMPT.format(
            today=clinic_today().isoformat(),
            now=clinic_now().strftime("%H:%M"),
            doctors_list=DOCTORS_TEXT,
            lang_directive=_lang_directive(reply_language),
        ),
    }

    for _ in range(max_iter):
        # The Groq SDK is synchronous — run it in a worker thread so a
        # multi-second LLM call never blocks the event loop.
        llm_start = time.perf_counter()
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=GROQ_MODEL,
            messages=[system] + msgs,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=512,
            temperature=0.3,
        )
        LLM_LATENCY.observe(time.perf_counter() - llm_start)

        msg = response.choices[0].message

        # ── No tool call → final text response ────────────
        if not msg.tool_calls:
            text = (msg.content or "").strip()
            msgs.append({"role": "assistant", "content": text})
            return text, msgs

        # ── Build assistant message with tool_calls ────────
        tool_calls_payload = [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in msg.tool_calls
        ]
        msgs.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": tool_calls_payload,
        })

        # ── Execute each tool ──────────────────────────────
        for tc in msg.tool_calls:
            try:
                raw = (tc.function.arguments or "").strip()
                # Parameterless tools legitimately arrive as "", "null" or "{}".
                args = json.loads(raw) if raw else {}
                if args is None:
                    args = {}
                if not isinstance(args, dict):
                    raise ValueError("arguments must be a JSON object")
            except (json.JSONDecodeError, ValueError) as e:
                # Feed the parse failure back to the model instead of
                # executing a tool with missing arguments.
                logger.warning(f"Malformed tool arguments for {tc.function.name}: {e}")
                msgs.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps({
                        "error": "Invalid tool arguments. Re-emit the call with valid JSON."
                    }),
                })
                continue

            logger.info(f"Tool call → {tc.function.name}({args})")
            try:
                result = await tool_executor(tc.function.name, args)
            except Exception:
                logger.exception(f"Tool {tc.function.name} raised")
                result = {"error": "The tool failed unexpectedly. Apologise and ask the user to try again."}
            TOOL_CALLS.labels(
                tool=tc.function.name,
                outcome="error" if (isinstance(result, dict) and result.get("error")) else "success",
            ).inc()
            logger.info(f"Tool result ← {result}")

            msgs.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

    return "I'm sorry, I couldn't complete that action. Please try again.", msgs


# ── Conversation Summarizer (context compression) ──────────
SUMMARY_PROMPT = """\
Summarize this clinic-assistant conversation in 3-5 short factual
sentences. Preserve exactly: patient name, doctors discussed, dates,
times, appointment IDs, booking/cancellation outcomes, and stated
preferences. No filler, no commentary."""


async def summarize_conversation(messages: list) -> str:
    """Condense older turns into a short factual summary for the prompt."""
    transcript = "\n".join(
        f"{m.get('role')}: {m.get('content')}"
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    )
    if not transcript:
        return ""

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": transcript[-6000:]},
        ],
        max_tokens=200,
        temperature=0.1,
    )
    return (response.choices[0].message.content or "").strip()


# ── Outbound Call Message Generator ────────────────────────
async def generate_outbound_message(
    name: str,
    doctor: str,
    date: str,
    time: str,
    purpose: str,   # "reminder" | "followup" | "missed"
    language: str,  # "English" | "Hindi" | "Tamil"
) -> str:
    """
    Generate a short, spoken outbound call message for the patient.
    Returns plain text — no JSON, no extra formatting.
    """
    user_prompt = (
        f"Generate an outbound call message with the following context:\n"
        f"Name: {name}\n"
        f"Doctor: {doctor}\n"
        f"Date: {date}\n"
        f"Time: {time}\n"
        f"Purpose: {purpose}\n"
        f"Language: {language}\n"
        f"\nReturn ONLY the spoken message text."
    )

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": OUTBOUND_SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        max_tokens=150,
        temperature=0.4,
    )

    return (response.choices[0].message.content or "").strip()
