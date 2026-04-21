"""
Groq + LLaMA-3 70B agent with tool-calling loop.
Supports: book_appointment, reschedule_appointment, cancel_appointment, check_availability
"""
import json
import logging
from datetime import datetime, date
from groq import Groq
from config import settings, GROQ_MODEL, DOCTOR_NAMES, DOCTORS

logger = logging.getLogger(__name__)
client = Groq(api_key=settings.GROQ_API_KEY)

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

OUTPUT FORMAT:
Return ONLY the spoken message text. No JSON. No extra explanation.
"""

# ── System Prompt ──────────────────────────────────────────
SYSTEM_PROMPT = """\
You are ClinicAI — a real-time multilingual AI voice assistant for a healthcare clinic.
You communicate naturally in English, Hindi, and Tamil.

━━ LANGUAGE RULES ━━
• DEFAULT language is English.
• ONLY switch language if the user explicitly speaks or types in Hindi or Tamil.
• ALWAYS reply in the EXACT same language and script as the current user message.
• Hindi → Devanagari script | Tamil → Tamil script | English → English
• Keep responses SHORT and CONVERSATIONAL: 1–2 sentences maximum.

━━ CLINIC ━━
Doctors:
{doctors_list}
Working hours : 09:00 AM – 05:00 PM (slots every 30 min)
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
• For reschedule/cancel, ask for appointment ID if not provided.

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
                doctors_list=DOCTORS_TEXT,
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

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": OUTBOUND_SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        max_tokens=150,
        temperature=0.4,
    )

    return (response.choices[0].message.content or "").strip()
