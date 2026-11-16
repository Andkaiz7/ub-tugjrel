import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 512, 'height': 512})
    pg.goto((root / 'tools' / 'ubm_icon.html').as_uri())
    pg.wait_for_function('window.done')
    pg.locator('#c').screenshot(path=str(root / 'ugee-buu-mart' / 'icon.png'))
    b.close()
print('icon written')
