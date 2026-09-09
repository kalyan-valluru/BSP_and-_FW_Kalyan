import os
import sys
import json
import base64

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

def test_gemini_vision():
    image_path = os.path.join("backend", "Demo_Inputs", "zynq_block_diagram.png")
    if not os.path.exists(image_path):
        print(f"Image not found at {image_path}")
        return

    with open(image_path, "rb") as f:
        img_bytes = f.read()

    b64 = base64.b64encode(img_bytes).decode('utf-8')
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
    
    # Method 1: OpenAI SDK via Gemini OpenAI-compatible base URL with model gemini-3.6-flash
    try:
        from openai import OpenAI
        base_url = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
        client = OpenAI(api_key=key, base_url=base_url)
        model = os.environ.get("VISION_MODEL", "gemini-3.6-flash")
        print(f"Testing OpenAI client with base_url={base_url}, model={model}...")
        
        prompt = (
            "Analyse this embedded system block diagram / board image.\n"
            "Return a strict JSON object with these exact keys:\n"
            "{\n"
            "  \"board_name\": \"...\",\n"
            "  \"vendor\": \"...\",\n"
            "  \"board_family\": \"...\",\n"
            "  \"components\": [\"...\"],\n"
            "  \"interfaces\": [\"...\"],\n"
            "  \"visible_labels\": [\"...\"],\n"
            "  \"part_numbers\": [\"...\"],\n"
            "  \"confidence\": 0.95,\n"
            "  \"evidence\": [\"...\"],\n"
            "  \"uncertain_fields\": []\n"
            "}"
        )
        response = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
                ]
            }],
            temperature=0.1,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        print("Success! Response received from Gemini OpenAI SDK method:")
        print(response.choices[0].message.content)
        return
    except Exception as e:
        print(f"OpenAI SDK method failed: {e}")

    # Method 2: Native Google Gemini REST API fallback
    try:
        import urllib.request
        model = os.environ.get("VISION_MODEL", "gemini-3.6-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [{
                "parts": [
                    {"text": "Analyse this board image and return JSON with board_name, vendor, board_family, components, interfaces, visible_labels, part_numbers, confidence, evidence, uncertain_fields."},
                    {"inline_data": {"mime_type": "image/png", "data": b64}}
                ]
            }],
            "generationConfig": {"response_mime_type": "application/json"}
        }
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("Success! Native REST response received:")
            print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Native REST method failed: {e}")

if __name__ == '__main__':
    test_gemini_vision()
