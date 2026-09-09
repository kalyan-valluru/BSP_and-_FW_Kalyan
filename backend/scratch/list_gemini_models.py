import os
import sys
import json
import urllib.request

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""

# List models using REST API
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("Available models:")
        for m in data.get('models', []):
            name = m.get('name')
            methods = m.get('supportedGenerationMethods', [])
            if 'generateContent' in methods:
                print(f" - {name}")
except Exception as e:
    print(f"Failed to list models: {e}")
