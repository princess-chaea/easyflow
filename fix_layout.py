import re

with open('업무배송_스마트공문달력.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Change mainGrid
# Original (bad fix): class="flex flex-col gap-lg items-start w-full" id="mainGrid"
html = re.sub(
    r'class="flex flex-col gap-lg items-start w-full" id="mainGrid"',
    r'class="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-lg items-start w-full" id="mainGrid"',
    html
)

# 2. Add col-span-full to the KPI section
# <section class="w-full px-lg pb-lg no-print">
html = html.replace(
    '<section class="w-full px-lg pb-lg no-print">',
    '<section class="w-full no-print col-span-full">'
)

# 3. Change sideCol to be vertical again
html = re.sub(
    r'<aside class="order-1 flex flex-wrap gap-base w-full no-print items-start[^"]*" id="sideCol">',
    r'<aside class="order-1 flex flex-col gap-base w-full no-print" id="sideCol">',
    html
)

# 4. Remove max width from main container if any
# The user wants "전체 페이지에서 넓게 보고 싶은데"
# We had <div class="w-full px-lg py-lg"> wrapping mainGrid
# And <main class="pt-[64px] min-h-screen" id="main">
# Are there any max-w-7xl inside main?
html = html.replace('max-w-7xl', 'w-full px-lg') # Just in case

with open('업무배송_스마트공문달력.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Fixed layout.")
