import json
import logging
import httpx
from typing import List, Optional
from app.core.settings import settings
from app.services.transcription.base import WordTimestamp, TranscriptionResult

logger = logging.getLogger(__name__)

def contains_non_latin(text: str) -> bool:
    """Check if string contains non-Latin/Indic characters (e.g. Telugu, Devanagari, Tamil, etc.)."""
    for ch in text:
        # Indic scripts range (Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala)
        if "\u0900" <= ch <= "\u0DFF":
            return True
        # Additional Indic / Asian character blocks
        if "\u0E00" <= ch <= "\uA4CF":
            return True
    return False

async def call_groq_chat_completion(
    messages: List[dict],
    model: str,
    api_key: str,
    temperature: float = 0.1,
) -> str:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        # Fallback to secondary model if requested model had error
        fallback_model = "qwen/qwen3.8-27b" if "gpt-oss" in model else "openai/gpt-oss-120b"
        logger.warning(f"Groq Chat API error with {model} ({response.status_code}): {response.text}. Retrying with {fallback_model}...")
        payload["model"] = fallback_model
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        raise RuntimeError(f"Groq Chat API error ({response.status_code}): {response.text}")

    data = response.json()
    return data["choices"][0]["message"]["content"]

def parse_words_json(content: str) -> Optional[List[str]]:
    """Parse JSON response which might be a list or a dict containing a list."""
    try:
        parsed = json.loads(content.strip())
        if isinstance(parsed, list):
            return [str(w) for w in parsed]
        if isinstance(parsed, dict):
            for key in ["words", "result", "transliterated_words", "output", "data"]:
                if key in parsed and isinstance(parsed[key], list):
                    return [str(w) for w in parsed[key]]
            for v in parsed.values():
                if isinstance(v, list):
                    return [str(w) for w in v]
    except Exception as e:
        logger.warning(f"Failed to parse JSON response: {e}")
    return None

async def convert_words_to_roman(
    words: List[WordTimestamp],
    language: Optional[str] = None,
) -> Optional[List[str]]:
    """
    Transliterates a batch of native-script words into casual WhatsApp-style Roman letters.
    Enforces strict 1:1 length matching with a single retry.
    """
    if not words:
        return []

    api_key = settings.GROQ_API_KEY
    if not api_key:
        logger.warning("GROQ_API_KEY not configured for Romanization step.")
        return None

    model = getattr(settings, "ROMANIZATION_MODEL", "qwen/qwen3.8-27b")
    word_texts = [w.text for w in words]
    target_count = len(word_texts)

    system_prompt = (
        f"You are an expert at transliterating Indian languages ({language or 'Indian languages'}) "
        "into casual, colloquial Romanized script as people type on WhatsApp / social media "
        "(e.g., Tenglish: 'namaskaram bagunnara', Hinglish: 'camera se compare kar rahe hain', Tanglish: 'vanakkam').\n\n"
        "RULES:\n"
        f"1. You will receive a JSON list of exactly {target_count} words in order.\n"
        f"2. You MUST return a JSON object with a 'words' key containing an array of EXACTLY {target_count} strings.\n"
        "3. Each word must correspond 1:1 in the exact same position and order as the input word.\n"
        "4. Words already in standard English or Latin alphabet (e.g. 'solar', 'install', 'subsidy', 'business', 'camera', 'phone') MUST stay in standard English spelling without alteration.\n"
        "5. Do NOT translate meanings to English words! Transliterate non-Latin words phonetically into Roman alphabet.\n"
        "6. Do NOT merge two words into one or split one word into two. Exactly 1 output word for every 1 input word.\n"
        "7. Strict JSON format: {\"words\": [\"word1\", \"word2\", ...]}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps({"words": word_texts}, ensure_ascii=False)},
    ]

    # Attempt 1
    try:
        raw_output = await call_groq_chat_completion(messages, model, api_key)
        converted = parse_words_json(raw_output)
        if converted and len(converted) == target_count:
            return converted
        else:
            actual_len = len(converted) if converted else 0
            logger.warning(
                f"Romanization attempt 1 length mismatch: expected {target_count}, got {actual_len}. Retrying..."
            )
    except Exception as e:
        logger.warning(f"Romanization attempt 1 failed: {e}. Retrying...")

    # Attempt 2 (Retry once with strict feedback)
    retry_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps({"words": word_texts}, ensure_ascii=False)},
        {
            "role": "user",
            "content": (
                f"CRITICAL ERROR: The previous output count mismatched. "
                f"The input list has EXACTLY {target_count} items. "
                f"You MUST return a JSON object {{\"words\": [...]}} with EXACTLY {target_count} items in the same 1:1 order."
            ),
        },
    ]

    try:
        raw_output_retry = await call_groq_chat_completion(retry_messages, model, api_key)
        converted_retry = parse_words_json(raw_output_retry)
        if converted_retry and len(converted_retry) == target_count:
            return converted_retry
        else:
            actual_len = len(converted_retry) if converted_retry else 0
            logger.error(
                f"Romanization retry failed count validation: expected {target_count}, got {actual_len}."
            )
    except Exception as e:
        logger.error(f"Romanization retry encountered error: {e}")

    return None

async def apply_romanization_if_needed(
    result: TranscriptionResult,
    style: Optional[str] = "roman",
    language: Optional[str] = None,
) -> TranscriptionResult:
    """
    Applies Roman transliteration step if style is Roman and text contains non-Latin script.
    Runs for EVERY provider (including Sarvam, Groq, and Local).
    Preserves start/end timestamps for each word.
    Logs before and after sample words.
    """
    is_roman = (style or "roman").lower() == "roman"
    if not is_roman or not result.words:
        return result

    # Check if text contains non-Latin script (Telugu, Hindi, Tamil, etc.)
    full_text = result.text or " ".join(w.text for w in result.words)
    if not contains_non_latin(full_text):
        logger.info(
            f"Transcription result for provider '{result.provider}' is already in Latin script. Skipping Romanization."
        )
        return result

    # Log before conversion
    words_before = [w.text for w in result.words]
    sample_before = words_before[:10]

    converted_texts = await convert_words_to_roman(result.words, language=language or result.language)

    if converted_texts and len(converted_texts) == len(result.words):
        # Keep each word's original start/end timestamps, only replace the text
        new_words = []
        for orig_w, roman_txt in zip(result.words, converted_texts):
            new_words.append(
                WordTimestamp(
                    text=roman_txt.strip(),
                    start=orig_w.start,
                    end=orig_w.end,
                    confidence=orig_w.confidence,
                )
            )

        result.words = new_words
        result.text = " ".join(converted_texts)
        sample_after = [w.text for w in result.words[:10]]

        # Rule 5: Print in backend log: provider used, style, and first 10 words before/after
        log_banner = (
            f"\n{'='*70}\n"
            f" [ROMANIZATION SUCCESS]\n"
            f" Provider : {result.provider}\n"
            f" Route    : {result.route_used or 'Default'}\n"
            f" Style    : {style}\n"
            f" Language : {language or result.language}\n"
            f" Words Before (first 10) : {sample_before}\n"
            f" Words After  (first 10) : {sample_after}\n"
            f"{'='*70}\n"
        )
        logger.info(log_banner)
        print(log_banner, flush=True)

    else:
        # Fall back to native script and flag toast
        result.fallback_occurred = True
        result.fallback_message = "Roman transliteration count mismatch. Subtitles displayed in native script."
        log_fail = (
            f"\n{'='*70}\n"
            f" [ROMANIZATION FALLBACK]\n"
            f" Provider : {result.provider}\n"
            f" Style    : {style} (Fell back to native script)\n"
            f" Words    : {sample_before}\n"
            f"{'='*70}\n"
        )
        logger.warning(log_fail)
        print(log_fail, flush=True)

    return result
