from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import json
import re
from fuzzywuzzy import fuzz, process as fuzz_process

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str


# Voice Order Parsing Models
class ProductInfo(BaseModel):
    id: str
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    color: Optional[str] = None
    attributes: Optional[Dict[str, str]] = None

class VoiceParseRequest(BaseModel):
    transcript: str
    products: List[ProductInfo]

class VoiceParsedItem(BaseModel):
    productId: str
    productName: str
    quantity: int
    confidence: float
    matchReason: str
    extractedAttributes: Optional[Dict[str, str]] = None

class VoiceUnmatchedSegment(BaseModel):
    text: str
    detectedKeywords: List[str]
    suggestedProductIds: Optional[List[str]] = None

class VoiceParseResult(BaseModel):
    success: bool
    error: Optional[str] = None
    message: Optional[str] = None
    parsed: List[VoiceParsedItem]
    unmatchedSegments: Optional[List[VoiceUnmatchedSegment]] = None
    rawTranscript: str


# Helper functions for text normalization
def normalize_text(text: str) -> str:
    """Normalize text for better matching - lowercase, remove extra spaces, etc."""
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower()
    # Remove common filler words
    filler_words = ['please', 'give', 'me', 'want', 'need', 'the', 'a', 'an', 'some', 'few', 'piece', 'pieces', 'pack', 'packs', 'box', 'boxes', 'bottle', 'bottles', 'unit', 'units']
    words = text.split()
    words = [w for w in words if w not in filler_words]
    text = ' '.join(words)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_quantity_from_text(text: str) -> tuple:
    """Extract quantity from text. Returns (quantity, remaining_text)"""
    text = text.lower().strip()
    
    # Word to number mappings (English and Hindi)
    word_to_num = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'twenty': 20, 'fifty': 50, 'hundred': 100,
        # Hindi numbers
        'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5, 'panch': 5,
        'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
        'gyarah': 11, 'barah': 12, 'bees': 20, 'pachaas': 50, 'sau': 100,
        # Common variants
        'double': 2, 'triple': 3, 'half': 0.5, 'quarter': 0.25,
        'dozen': 12, 'pair': 2, 'couple': 2,
    }
    
    quantity = 1  # Default quantity
    remaining_text = text
    
    # Try to find numeric quantity at the beginning or end
    # Pattern: "5 products" or "products 5"
    num_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:piece|pieces|pack|packs|box|boxes|bottle|bottles|unit|units|kg|g|ml|l|liter|litre)?', text)
    if num_match:
        quantity = float(num_match.group(1))
        if quantity == int(quantity):
            quantity = int(quantity)
        remaining_text = text[:num_match.start()] + text[num_match.end():]
    else:
        # Try word-based numbers
        for word, num in word_to_num.items():
            pattern = r'\b' + word + r'\b'
            if re.search(pattern, text):
                quantity = num
                remaining_text = re.sub(pattern, '', text)
                break
    
    return quantity, remaining_text.strip()


# Common phonetic substitutions for Indian English/Hindi
PHONETIC_SUBS = {
    'ph': 'f', 'f': 'ph',
    'v': 'w', 'w': 'v',
    'z': 's', 's': 'z',
    'th': 't', 't': 'th',
    'ee': 'i', 'i': 'ee',
    'oo': 'u', 'u': 'oo',
    'aa': 'a', 'a': 'aa',
    'ck': 'k', 'k': 'ck',
    'x': 'ks', 'ks': 'x',
}

# Common brand name phonetic mappings
BRAND_PHONETIC_MAP = {
    'pears': ['paras', 'piras', 'pearz', 'pers'],
    'colgate': ['kolgat', 'colget', 'kolgate'],
    'closeup': ['closup', 'clos up', 'close up'],
    'maggi': ['magi', 'maggie', 'maggii'],
    'parle': ['parley', 'parlee', 'parlei'],
    'lux': ['luks', 'luxe'],
    'surf': ['serf', 'surff'],
    'britannia': ['britania', 'britaniya'],
    'bournvita': ['bonvita', 'bournwita', 'bornvita'],
    'horlicks': ['horliks', 'horlics'],
    'dettol': ['detol', 'detal'],
    'lifebuoy': ['lifboy', 'lifeboy', 'lifbuoy'],
    'dove': ['duv', 'dov'],
    'pantene': ['panten', 'pantein'],
    'head and shoulders': ['head n shoulders', 'head shoulders'],
    'clinic plus': ['clinic', 'clinik plus'],
}

def get_phonetic_variations(word: str) -> List[str]:
    """Generate phonetic variations of a word"""
    variations = [word]
    word_lower = word.lower()
    
    # Check brand phonetic map
    for brand, alts in BRAND_PHONETIC_MAP.items():
        if word_lower == brand or word_lower in alts:
            variations.extend([brand] + alts)
    
    return list(set(variations))


def fuzzy_match_product(query: str, products: List[ProductInfo], threshold: int = 60) -> List[tuple]:
    """
    Fuzzy match a query against product names/brands/models.
    Returns list of (product, score, match_reason)
    Uses both fuzzy string matching and phonetic variations.
    """
    matches = []
    query_normalized = normalize_text(query)
    query_words = query_normalized.split()
    
    # Generate phonetic variations for each word in query
    query_variations = [query_normalized]
    for word in query_words:
        variations = get_phonetic_variations(word)
        for var in variations:
            if var != word:
                query_variations.append(query_normalized.replace(word, var))
    
    for product in products:
        best_score = 0
        match_reason = ""
        
        # Create searchable strings
        product_name = normalize_text(product.name)
        product_brand = normalize_text(product.brand or "")
        product_model = normalize_text(product.model or "")
        
        # Try all query variations
        for query_var in query_variations:
            # Full name match
            name_score = fuzz.token_set_ratio(query_var, product_name)
            if name_score > best_score:
                best_score = name_score
                match_reason = f"Name match: {product.name}"
            
            # Brand only match (important for partial mentions)
            if product_brand:
                brand_only_score = fuzz.token_set_ratio(query_var, product_brand)
                if brand_only_score > best_score:
                    best_score = brand_only_score
                    match_reason = f"Brand match: {product.brand}"
                
                # Brand + name combined match
                brand_name = f"{product_brand} {product_name}"
                brand_score = fuzz.token_set_ratio(query_var, brand_name)
                if brand_score > best_score:
                    best_score = brand_score
                    match_reason = f"Brand+Name match: {product.brand} {product.name}"
            
            # Model match
            if product_model:
                model_score = fuzz.token_set_ratio(query_var, product_model)
                if model_score > best_score:
                    best_score = model_score
                    match_reason = f"Model match: {product.model}"
            
            # Partial match (for abbreviations/short names)
            partial_score = fuzz.partial_ratio(query_var, product_name)
            if partial_score > best_score + 10:  # Only if significantly better
                best_score = partial_score
                match_reason = f"Partial match: {product.name}"
        
        if best_score >= threshold:
            matches.append((product, best_score, match_reason))
    
    # Sort by score descending
    matches.sort(key=lambda x: x[1], reverse=True)
    return matches


async def parse_with_ai(transcript: str, products: List[ProductInfo]) -> VoiceParseResult:
    """Use AI to intelligently parse voice transcript and match products"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        # Create product catalog string for context
        product_catalog = []
        for p in products:
            entry = f"ID: {p.id}, Name: {p.name}"
            if p.brand:
                entry += f", Brand: {p.brand}"
            if p.model:
                entry += f", Model: {p.model}"
            if p.color:
                entry += f", Color: {p.color}"
            if p.attributes:
                entry += f", Attributes: {json.dumps(p.attributes)}"
            product_catalog.append(entry)
        
        catalog_text = "\n".join(product_catalog)
        
        system_prompt = """You are an intelligent product matching assistant for a voice ordering system in Indian retail.

Your task is to:
1. Parse spoken product orders from natural language
2. Extract product names, quantities, and any attributes (size, color, etc.)
3. Match extracted items with products from the provided catalog
4. Handle fuzzy/approximate product name matches intelligently
5. Understand Hindi/English mixed speech (Hinglish) common in Indian retail

CRITICAL RULES for matching:
- Users may speak brand names, product names, or nicknames
- "Colgate" might mean "Colgate Strong Teeth" or any Colgate product
- Numbers can be spoken as words (one, two) or Hindi (ek, do, teen, char, paanch, chhe, saat, aath, nau, das)
- Default quantity is 1 if not specified
- Be VERY flexible with spelling/pronunciation variations:
  * "pasta/paste/pest" -> toothpaste
  * "paras/piras/pears" -> Pears (soap brand)
  * "closeup/close up" -> Close Up
  * "maggi/magi/maggii" -> Maggi
  * "bournvita/bonvita/bournwita" -> Bournvita
  * "parle g/parleg/parle ji" -> Parle-G
- PHONETIC MATCHING: Match words that SOUND similar even if spelled differently
- Look for size/color mentions like "red", "large", "500ml", "bada", "chhota" etc.
- Common Hindi terms: "dena" (give), "chahiye" (want), "aur" (and), "bhi" (also)
- Variations in brand names due to accents should still match

ATTRIBUTE RECOGNITION:
- Sizes: small/chhota, medium/madhyam, large/bada, XL, XXL, 100g, 500ml, 1kg, etc.
- Colors: red/laal, blue/neela, green/hara, black/kala, white/safed, etc.
- When attributes are mentioned, prefer products with matching attributes

Respond ONLY with valid JSON in this exact format:
{
  "parsed_items": [
    {
      "product_id": "actual_product_id_from_catalog",
      "product_name": "matched product name",
      "quantity": 2,
      "confidence": 0.85,
      "match_reason": "Brand name 'Colgate' matched to 'Colgate Strong Teeth 100g'",
      "extracted_attributes": {"size": "100g", "color": null}
    }
  ],
  "unmatched_segments": [
    {
      "text": "some unknown product",
      "keywords": ["unknown", "product"],
      "suggested_ids": []
    }
  ]
}

If no products can be matched, return parsed_items as empty array.
Always provide confidence between 0.0 and 1.0 based on match quality.
Be AGGRESSIVE in matching - prefer a match with lower confidence over no match."""

        user_prompt = f"""Parse this voice order and match with available products:

VOICE TRANSCRIPT: "{transcript}"

PRODUCT CATALOG:
{catalog_text}

Extract all products mentioned with quantities and match them to the catalog. Handle fuzzy names intelligently."""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"voice-parse-{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=user_prompt)
        response = await chat.send_message(user_message)
        
        # Parse AI response
        # Clean the response - remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        ai_result = json.loads(response_text)
        
        parsed_items = []
        for item in ai_result.get("parsed_items", []):
            # Clean extracted_attributes - remove None values
            raw_attrs = item.get("extracted_attributes")
            cleaned_attrs = None
            if raw_attrs and isinstance(raw_attrs, dict):
                cleaned_attrs = {k: v for k, v in raw_attrs.items() if v is not None}
                if not cleaned_attrs:
                    cleaned_attrs = None
            
            parsed_items.append(VoiceParsedItem(
                productId=str(item["product_id"]),
                productName=item["product_name"],
                quantity=int(item.get("quantity", 1)),
                confidence=float(item.get("confidence", 0.7)),
                matchReason=item.get("match_reason", "AI matched"),
                extractedAttributes=cleaned_attrs
            ))
        
        unmatched = []
        for seg in ai_result.get("unmatched_segments", []):
            unmatched.append(VoiceUnmatchedSegment(
                text=seg.get("text", ""),
                detectedKeywords=seg.get("keywords", []),
                suggestedProductIds=seg.get("suggested_ids")
            ))
        
        return VoiceParseResult(
            success=len(parsed_items) > 0,
            parsed=parsed_items,
            unmatchedSegments=unmatched if unmatched else None,
            rawTranscript=transcript
        )
        
    except json.JSONDecodeError as e:
        logging.error(f"AI response JSON parse error: {e}")
        # Fall back to fuzzy matching
        return await fallback_fuzzy_parse(transcript, products)
    except Exception as e:
        logging.error(f"AI parsing error: {e}")
        # Fall back to fuzzy matching
        return await fallback_fuzzy_parse(transcript, products)


async def fallback_fuzzy_parse(transcript: str, products: List[ProductInfo]) -> VoiceParseResult:
    """Fallback to fuzzy matching when AI parsing fails"""
    parsed_items = []
    unmatched = []
    
    # Split transcript into potential product mentions
    # Simple split by common separators
    segments = re.split(r'[,;]|\band\b|\baur\b|\bor\b|\bya\b', transcript.lower())
    
    for segment in segments:
        segment = segment.strip()
        if not segment or len(segment) < 2:
            continue
        
        # Extract quantity
        quantity, product_text = extract_quantity_from_text(segment)
        
        if not product_text or len(product_text) < 2:
            product_text = segment
        
        # Try fuzzy matching
        matches = fuzzy_match_product(product_text, products, threshold=55)
        
        if matches:
            best_match = matches[0]
            product, score, reason = best_match
            
            confidence = score / 100.0
            
            parsed_items.append(VoiceParsedItem(
                productId=product.id,
                productName=product.name,
                quantity=quantity if isinstance(quantity, int) else int(quantity),
                confidence=confidence,
                matchReason=reason,
                extractedAttributes=None
            ))
        else:
            # Add to unmatched
            keywords = [w for w in product_text.split() if len(w) > 2]
            unmatched.append(VoiceUnmatchedSegment(
                text=segment,
                detectedKeywords=keywords,
                suggestedProductIds=None
            ))
    
    return VoiceParseResult(
        success=len(parsed_items) > 0,
        parsed=parsed_items,
        unmatchedSegments=unmatched if unmatched else None,
        rawTranscript=transcript
    )


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# Voice Order Parsing Endpoint
@api_router.post("/parse-voice-order", response_model=VoiceParseResult)
async def parse_voice_order(request: VoiceParseRequest):
    """
    Intelligently parse voice transcript to match products.
    Uses AI (GPT) for natural language understanding and fuzzy matching as fallback.
    """
    try:
        transcript = request.transcript.strip()
        products = request.products
        
        if not transcript:
            return VoiceParseResult(
                success=False,
                error="empty_transcript",
                message="No voice input received",
                parsed=[],
                rawTranscript=""
            )
        
        if not products:
            return VoiceParseResult(
                success=False,
                error="no_products",
                message="No products available to match",
                parsed=[],
                rawTranscript=transcript
            )
        
        logging.info(f"Parsing voice order: {transcript}")
        logging.info(f"Available products: {len(products)}")
        
        # Try AI-powered parsing first
        result = await parse_with_ai(transcript, products)
        
        # If AI parsing found nothing, try pure fuzzy matching
        if not result.parsed and not result.error:
            logging.info("AI found no matches, trying fuzzy fallback")
            result = await fallback_fuzzy_parse(transcript, products)
        
        logging.info(f"Parse result: success={result.success}, items={len(result.parsed)}")
        return result
        
    except Exception as e:
        logging.error(f"Voice parse error: {e}")
        return VoiceParseResult(
            success=False,
            error="parse_failed",
            message=f"Could not process voice input: {str(e)}",
            parsed=[],
            rawTranscript=request.transcript
        )


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
