from pathlib import Path
import os,sys,json
p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=p.read_text(encoding='utf-8')
assert 'function assistantPage()' in s
assert 'neonRPC' in s and 'florindo_login' in s
url=os.environ.get('FLORINDO_AI_URL','')
if url and not url.startswith('https://'):raise SystemExit('Endpoint precisa usar HTTPS')
ui=Path('backend/assistant.html').read_text(encoding='utf-8')
config='<script>globalThis.FLORINDO_AI_URL='+json.dumps(url)+';</script>'
# A configuração precisa existir antes do JavaScript principal iniciar, para que login e sincronização usem a Function do Neon desde a abertura do app.
assert '</head>' in s and '</body>' in s
s=s.replace('</head>',config+'\n</head>',1)
s=s.replace('</body>',ui+'\n</body>',1)
assert 'id="florindoAiForm"' in s
assert s.index('globalThis.FLORINDO_AI_URL') < s.index('async function neonRPC')
assert 'GEMINI_API_KEY' not in s
p.write_text(s,encoding='utf-8')
print('Assistente instalado no HTML. Endpoint configurado antes do app:',bool(url))
