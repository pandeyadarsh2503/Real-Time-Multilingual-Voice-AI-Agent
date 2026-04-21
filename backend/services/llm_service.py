"""
Groq + LLaMA-3 70B agent with tool-calling loop.
Supports: book_appointment, reschedule_appointment, cancel_appointment, check_availability
"""
import json
import logging
from datetime import datetime, date
from groq import Groq
from config import settings, GROQ_MODEL, DOCTOR_NAMES

logger = logging.getLogger(__name__)
client = Groq(api_key=settings.GROQ_API_KEY)

# ── System Prompt ──────────────────────────────────────────
SYSTEM_PROMPT = """\
You are ClinicAI — a real-time multilingual AI voice assistant for a healthcare clinic.
You communicate naturally in English, Hindi, and Tamil.

━━ LANGUAGE RULES ━━
• Detect the user's language automatically.
• ALWAYS reply in the EXACT same language and script as the user.
• Hindi → Devanagari script | Tamil → Tamil script | English → English
• Keep responses SHORT: 1–2 sentences maximum.

━━ CLINIC ━━
Doctors:
  1. Dr Sharma  — Cardiologist
  2. Dr Iyer    — General Physician
  3. Dr Mehta   — Dermatologist
Working hours : 09:00 AM – 05:00 PM (slots every 30 min)
No double booking. No past-date/time booking allowed.
Today's date : {today}
Current time : {now}

━━ TOOL USAGE (MANDATORY) ━━
• NEVER assume availability — always call check_availability first.
• NEVER call book_appointment without EXPLICIT user confirmation ("yes", "हाँ", "ஆமாம்").
• Before booking, always confirm: "Confirm: [Doctor] on [Date] at [Time]?"
• On slot conflict, suggest up to 3 alternatives from check_availability result.
• For reschedule/cancel, ask for appointment ID if not provided.

━━ CONVERSATION FLOW ━━
1. Greet & detect intent (book / reschedule / cancel / check / general).
2. Collect missing info: name → doctor → date → time (one question at a time).
3. Call check_availability to verify slot is free.
4. Confirm details with user.
5. On "yes" → call the booking/action tool.
6. Confirm success with appointment ID.

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
                "Always call this BEFORE confirming or booking any appointment."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor": {
                        "type": "string",
                        "description": "Exact doctor name: 'Dr Sharma', 'Dr Iyer', or 'Dr Mehta'",
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
            "name": "cancel_appointment",
            "description": "Cancel an existing scheduled appointment.",
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
async def run_agent(messages: list, tool_executor, max_iter: int = 6) -> tuple[str, list]:
    """
    Run the Groq LLaMA-3 tool-calling loop.
    Returns (final_text_response, updated_messages_list).
    """
    msgs = list(messages)  # work on a copy

    for _ in range(max_iter):
        system = {
            "role": "system",
            "content": SYSTEM_PROMPT.format(
                today=date.today().isoformat(),
                now=datetime.now().strftime("%H:%M"),
            ),
        }

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[system] + msgs,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=512,
            temperature=0.3,
        )

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
                args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                args = {}

            logger.info(f"Tool call → {tc.function.name}({args})")
            result = await tool_executor(tc.function.name, args)
            logger.info(f"Tool result ← {result}")

            msgs.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

    return "I'm sorry, I couldn't complete that action. Please try again.", msgs
