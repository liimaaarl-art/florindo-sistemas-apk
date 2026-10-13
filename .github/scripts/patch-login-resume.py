from pathlib import Path
import sys

p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=p.read_text(encoding='utf-8')
marker='<body class="auth-locked">'
assert marker in s, 'Tela de login não encontrada'
fast='''<script id="florindoFastResume">try{const remembered=localStorage.getItem('florindo-login-remember-v4')!=='0';const token=localStorage.getItem('florindo-neon-sync-key-v1')||'';if(remembered&&token){document.body.classList.remove('auth-locked');if(location.hash!=='#overview')history.replaceState(null,'',location.pathname+location.search+'#overview')}}catch(e){}</script>'''
s=s.replace(marker,marker+fast,1)
old="async function start(){await initStorage();route=nav.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'overview';render();"
new="async function start(){await initStorage();const fastResume=!!(neonToken()&&loginRemembered());route=fastResume?'overview':(nav.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'overview');render();"
assert old in s, 'Inicialização do aplicativo não encontrada'
s=s.replace(old,new,1)
assert 'id="florindoFastResume"' in s and "fastResume?'overview'" in s
p.write_text(s,encoding='utf-8')
print('Retomada rápida aplicada: sessão lembrada abre direto no Início sem piscar a tela de login.')
