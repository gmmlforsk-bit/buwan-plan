"""Server-rendered catalog pages. Navigation, search and pagination use ordinary links."""
import json
import sqlite3
from contextlib import closing
from html import escape
from pathlib import Path
from urllib.parse import parse_qs, quote

ROOT = Path(__file__).resolve().parent
LISTS = {row['id']: row for row in json.loads((ROOT / 'catalog/reading-lists.json').read_text())}
REVIEWS = json.loads((ROOT / "catalog/criticism.json").read_text())
SLUGS = json.loads((ROOT / 'mapping.json').read_text())
IDS = {v: k for k, v in SLUGS.items()}
NAV = '<nav aria-label="浏览"><a href="/">展映首页</a><a href="/browse/find">找片</a><a href="/browse/lists">片单</a></nav>'


def cover(i):
    for name in (f'cover-{i}.jpg', f'shelf/{i}.jpg', f'{i}.jpg'):
        if (ROOT / 'assets' / name).is_file():
            return '/assets/' + name
    return '/artwork/' + str(i)


def link(path, text):
    return '<a href="' + escape(path, quote=True) + '">' + escape(text) + '</a>'


def search_form(q=''):
    return ('<form action="/browse/find"><label for="readQuery">片名或关键词</label>'
            '<input type="search" id="readQuery" name="q" value="' + escape(q, quote=True) +
            '"><button type="submit">搜索片库</button></form>')


def works_grid(rows):
    return '<div class="reader-grid">' + ''.join(
        f'<a href="/browse/anime/{row["id"]}"><img loading="lazy" src="{cover(row["id"])}" alt="">'
        f'<strong>{escape(row["title"])}</strong><small>{escape(row["date"] or "")}</small></a>'
        for row in rows) + '</div>'


def render(path, query):
    path = path.rstrip('/') or '/browse'
    params = parse_qs(query)
    with closing(sqlite3.connect((ROOT / 'anime.sqlite').as_uri() + '?mode=ro', uri=True)) as db:
        db.row_factory = sqlite3.Row
        if path == '/browse':
            return 200, '补完计划', ('<h1>补完计划</h1><a class="reader-hero" href="/browse/anime/302">'
                    '<img src="/assets/totoro025.jpg" alt="龙猫在森林里"><strong>龙猫　↗</strong></a>' +
                    search_form() + '<h2>编辑片单</h2>' + list_links(list(LISTS.values())[-4:][::-1]) +
                    link('/browse/lists', f'浏览全部 {len(LISTS)} 张片单 →'))
        if path == '/browse/lists':
            return 200, '片单目录', '<h1>片单目录</h1>' + list_links(reversed(LISTS.values()))
        if path == '/browse/find':
            q = params.get('q', [''])[0].strip()[:200]
            try:
                page = max(1, int(params.get('page', ['1'])[0]))
            except ValueError:
                page = 1
            where = ' WHERE adult = 0'
            args = []
            for term in q.split():
                where += " AND instr(lower(title||' '||original||' '||coalesce(aliases,'')||' '||coalesce(tags,'')),lower(?)) > 0"
                args.append(term)
            count = db.execute('SELECT count(*) FROM works' + where, args).fetchone()[0]
            pages = max(1, (count+23)//24)
            page = min(page, pages)
            rows = db.execute('SELECT id,title,date FROM works' + where +
                              ' ORDER BY votes DESC,id LIMIT 24 OFFSET ?', [*args, (page-1)*24])
            base = '/browse/find?q=' + quote(q) + '&page='
            controls = [link(base + str(n), label) for n, label in
                        [(page-1, '上一页'), (page+1, '下一页')] if 1 <= n <= pages]
            return 200, '找片', ('<h1>找片</h1>' + search_form(q) +
                    f'<p>找到 {count:,} 部作品　·　第 {page} / {pages} 页</p>' +
                    works_grid(rows) + '<nav>' + ''.join(controls) + '</nav>')
        if path.startswith('/browse/list/'):
            item = LISTS.get(path.removeprefix('/browse/list/'))
            if item:
                sections = []
                for slug, reason in item['items']:
                    i = IDS.get(slug, slug.removeprefix('bgm-'))
                    row = db.execute('SELECT title FROM works WHERE id=?', (i,)).fetchone()
                    if row:
                        sections.append('<li>' + link('/browse/anime/'+i, row['title']) +
                                        '<p>' + escape(reason or '') + '</p></li>')
                return 200, item['title'], ('<h1>' + escape(item['title']) + '</h1><p>' +
                        escape(item['lead'] or '') + '</p><ol>' + ''.join(sections) + '</ol>')
        if path.startswith('/browse/anime/'):
            slug = path.removeprefix('/browse/anime/')
            i = IDS.get(slug, slug.removeprefix('bgm-'))
            row = db.execute('SELECT * FROM works WHERE id=?', (i,)).fetchone()
            if row:
                text = escape(row['summary'] or '暂未收录剧情简介。').replace('\n','<br>')
                notes = REVIEWS.get(str(row['id']), [])
                reviews = ''.join('<article><h3>' + escape(note['title']) + '</h3><p>' +
                                  escape(note['body']) + '</p></article>' for note in notes if not note.get('ep'))
                return 200, row['title'], ('<h1>' + escape(row['title']) + '</h1><p>' +
                        escape('　·　'.join(str(v) for v in [row['date'],row['format']] if v)) +
                        '</p><img class="reader-poster" src="'+cover(row['id'])+'" alt=""><p>'+text+'</p>'+
                        (('<section><h2>编辑短评</h2>' + reviews + '</section>') if reviews else '') +
                        link('/anime/'+SLUGS.get(str(row['id']), 'bgm-'+str(row['id'])), '打开互动档案 →'))
    return 404, '没有找到', '<h1>没有找到这项内容</h1>' + link('/browse/find','返回片库')


def list_links(items):
    return '<ul>' + ''.join('<li>' + link('/browse/list/'+item['id'],item['title'])+'</li>'
                           for item in items) + '</ul>'


def document(path, query):
    status, title, body = render(path, query)
    return status, ('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
            escape(title) + ' · 补完计划</title><link rel="stylesheet" href="/reader.css">'
            '<body class="reader-page"><main class="reader">'+NAV+body+'</main></body></html>').encode()
