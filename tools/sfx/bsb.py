# Outil de recherche de sons sur BigSoundBank (licence CC0) : liste les sons d'une recherche, avec leur durée et leur
# mention de licence, pour choisir ceux du jeu. Usage : python tools/sfx/bsb.py merle "common blackbird" …
import html
import re
import subprocess
import sys
import time
import urllib.parse


def get(url):
    # Une requête par seconde au plus, pour ménager le site.
    time.sleep(1)
    return subprocess.run(['curl', '-s', url], capture_output=True).stdout.decode('utf8', 'ignore')


def text(page):
    page = re.sub(r'(?s)<script.*?</script>|<style.*?</style>', '', page)
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', page)))


def search(q):
    page = get('https://bigsoundbank.com/search?q=' + urllib.parse.quote(q))
    return sorted(set(re.findall(r"href='(/[a-z0-9-]+-s(\d{3,5})\.html)'", page)))


def info(path):
    t = text(get('https://bigsoundbank.com' + path))
    lic = re.search(r'License (.{0,40}?):', t)
    desc = re.search(r'Download How to download.*?royalty-free \( More information on licenses \)', t)
    return lic.group(1) if lic else '?'


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf8')
    for q in sys.argv[1:]:
        res = search(q)
        print(f'== {q} : {len(res)} sons')
        for path, sid in res[:12]:
            print(f'  {sid}  {info(path):<22}  {path}')
