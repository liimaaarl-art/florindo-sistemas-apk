from pathlib import Path
import sys

p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=p.read_text(encoding='utf-8')
ui=Path('backend/native-audio-fix.html').read_text(encoding='utf-8')
assert 'florindoAudioToggle' in s and '</body>' in s
s=s.replace('</body>',ui+'\n</body>',1)
assert 'FlorindoVoiceRecorder' in s and 'florindoBase64AudioBlob' in s
p.write_text(s,encoding='utf-8')
print('Interface de áudio preparada para usar o gravador nativo Android.')
