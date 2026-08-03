import re

with open('업무배송_스마트공문달력.html', 'r', encoding='utf-8') as f:
    html = f.read()

def extract_class(html_str, id_str):
    m = re.search(f'id="{id_str}"[^>]*class="([^"]*)"', html_str)
    if not m:
        m = re.search(f'class="([^"]*)"[^>]*id="{id_str}"', html_str)
    return m.group(1) if m else "Not found"

print("main:", re.search(r'<main[^>]*>', html).group(0))
print("layoutWrap:", extract_class(html, "layoutWrap"))
print("sideCol:", extract_class(html, "sideCol"))
print("mainCol:", extract_class(html, "mainCol"))
print("kpiWrap:", extract_class(html, "kpiWrap")) # Not sure if kpiWrap exists, let's find the grid for KPI cards

kpi_match = re.search(r'<div class="grid grid-cols-1 md:grid-cols-4[^>]*>', html)
if kpi_match:
    print("KPI Wrapper:", kpi_match.group(0))

