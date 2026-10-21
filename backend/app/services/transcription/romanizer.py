import json
import logging
import httpx
from typing import List, Optional
from app.core.settings import settings
from app.services.transcription.base import WordTimestamp, TranscriptionResult

logger = logging.getLogger(__name__)

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
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
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
            # Look for common keys like 'words', 'transliterated_words', 'result'
            for key in ["words", "result", "transliterated_words", "output", "data"]:
                if key in parsed and isinstance(parsed[key], list):
                    return [str(w) for w in parsed[key]]
            # If values is a single list
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

    model = getattr(settings, "ROMANIZATION_MODEL", "llama-3.3-70b-versatile")
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
        "4. Keep English words and brand names in standard English spelling (e.g. 'camera', 'phone', 'video', 'compare').\n"
        "5. Do NOT translate meanings to English words! Transliterate phonetically into Roman alphabet.\n"
        "6. Output format: {\"words\": [\"word1\", \"word2\", ...]}"
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
                f"CRITICAL: The previous output did not match the count. "
                f"The input list has EXACTLY {target_count} items. "
                f"Return a JSON object {{\"words\": [...]}} with EXACTLY {target_count} items."
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
    Applies Roman transliteration step if style is Roman and provider is not Sarvam.
    Preserves start/end timestamps for each word.
    Logs before and after sample words.
    """
    is_roman = (style or "roman").lower() == "roman"
    provider_name = (result.provider or "").lower()

    # Rule 4: If provider is Sarvam and style is Roman, Sarvam already outputs codemix/translit
    if is_roman and provider_name == "sarvam":
        logger.info(f"Skipping LLM Romanization: provider is Sarvam with native Roman mode.")
        return result

    if not is_roman or not result.words:
        return result

    # Log before conversion
    words_before = [w.text for w in result.words]
    sample_before = words_before[:10]

    converted_texts = await convert_words_to_roman(result.words, language=language or result.language)

    if converted_texts and len(converted_texts) == len(result.words):
        # Rule 3: Keep each word's original start/end timestamps, only replace the text
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
