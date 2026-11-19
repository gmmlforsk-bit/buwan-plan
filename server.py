#!/usr/bin/env python3
"""《四叠半补完计划》的 Python 标准库与 SQLite 服务。"""

from __future__ import annotations

from reading import document as reading_page, render as reading_content
from artwork import image_type, load_poster

import gzip
from functools import lru_cache
import hashlib
import hmac
import json
import os
import sys
import re
import time
import secrets
import sqlite3
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, urlencode, parse_qs

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("FY_DB_PATH", str(BASE_DIR / "fangying_v4.db")))
DEMO_PERSONAS = [
    ("sakuga_archaeologist", "律表考古学家", "#f59e0b", "首席作画考据官 · 帧率显微镜", "逐帧拉片党，只认原画背动与律表（タイムシート）。金田系与Web系作画信徒，看到中村丰的方块碎片和井上俊之的布料褶皱会生理性流泪。", ["作画狂魔", "金田透视", "背动神回", "骨头社死忠", "逐帧拉片"]),
    ("kamogawa_tatami", "鸭川四叠半住客", "#e07a38", "汤浅政明门徒 · 京都巡礼常客", "住在四条河原町的幻想居民。偏爱森见登美彦、汤浅政明与夏目真悟，相信世间万物皆由伪电气白兰与平行世界构成。", ["汤浅政明", "四叠半美学", "超现实变形", "高速台词", "京都实景"]),
    ("shimokitazawa_telecaster", "下北泽失真贝斯", "#f472b6", "声画对位控 · 独立摇滚乐迷", "看动画先听OST和Foley音效。菅野洋子、Nujabes、牛尾宪辅、平泽进是我的四大宗教，为了一段20秒的即兴滑棒可以循环一整晚。", ["菅野洋子", "牛尾宪辅", "爵士嘻哈", "Live神回", "具象音乐"]),
    ("wired_protocol_07", "连线世界的幽灵", "#45a176", "90年代赛博学者 · 押井学派", "Present day, Present time. 沉迷于1995-2002年间的存在主义SF、电线杆阴影与后人类哲学。只要在Wired里，我就无处不在。", ["赛博朋克", "押井守空镜", "小中千昭", "心理哲学", "反乌托邦"]),
    ("bluebird_oboe", "理科室的河豚君", "#4ea8af", "山田尚子研究 · 镜头语言派", "关注膝盖以下30厘米的镜头、失焦的前景花瓣与少女欲言又止的指尖。比起宏大叙事，更迷恋日常细节里惊心动魄的心理张力。", ["山田尚子", "京都动画", "腿部演技", "景深留白", "细腻情感"]),
    ("rose_coffin_utena", "绝对命运默示录", "#b8334a", "几原邦彦信徒 · 符号学解构者", "让世界革命吧！热衷于在螺旋阶梯、影绘少女、剧团犬咖喱拼贴画与古典悲剧中寻找女性主义与精神分析的视觉密码。", ["几原邦彦", "先锋舞台剧", "视觉隐喻", "新房昭之", "女性叙事"]),
    ("tokoga_mushi", "常暗之森的银蛊", "#52b788", "物哀美学收藏家 · 慢节奏鉴赏", "喜欢雨声、苔藓、昭和寄席的烛火与夜晚山林的虫鸣。在这个倍速播放的时代，愿意为长滨博史的一个空镜头静坐半小时。", ["物哀留白", "自然主义", "东方泛灵论", "昭和风情", "治愈致郁"]),
    ("match_cut_lotus", "莲花池的匹配剪辑", "#818cf8", "今敏剪辑研究 · 迷影结构控", "电影学院剪辑系毕业。专门研究今敏的Match Cut、渡边信一郎的交叉蒙太奇与畠山守的轴线调度，视分镜表为最高文学。", ["匹配剪辑", "今敏", "交叉蒙太奇", "电影感构图", "叙事诡计"]),
    ("spiral_drill_1995", "突破天际的钻头", "#ef4444", "GAINAX遗老 · 萝卜片守护者", "从95年EVA实时追番过来的老家伙。见证过庵野秀明的精神崩坏，也流泪看过今石洋之把银河系当飞盘扔。机甲是男人的浪漫！", ["GAINAX", "庵野秀明", "今石洋之", "超级系萝卜", "实拍特摄感"]),
    ("divergence_1048596", "世界线观测者1.048596", "#d4af37", "叙事闭环强迫症 · 剧本结构派", "El Psy Kongroo. 对草蛇灰线的伏笔回收、多线叙事收束与日常推理毫无抵抗力。只要第1话和最后1话能严丝合缝咬合，我就给满分。", ["伏笔全回收", "时间循环", "剧本杀结构", "日常推理", "神转折"]),
    ("rakugo_shinigami", "寄席高座的烛火", "#c7c0b3", "古典落语考据 · 声优演技鉴赏", "听石田彰和山寺宏一说落语能听一辈子。偏爱成人向的严肃戏剧、历史纵深感与复杂幽微的人性灰区，拒绝工业糖精。", ["昭和元禄", "声优怪物", "成人戏剧", "历史纵深", "人性博弈"]),
    ("bocchi_mango_box", "完熟芒果纸箱", "#f472b6", "新锐演出观察员 · 萌系解构党", "躲在完熟芒果纸箱里看番的社恐。喜欢看斋藤圭一郎、石立太一、武本康弘怎么把萌系日常拍出实验动画与黄金喜剧的质感。", ["斋藤圭一郎", "冷面笑匠", "实拍拼贴", "空气系神作", "社恐共鸣"]),
]
DEMO_USERS = {row[0] for row in DEMO_PERSONAS}


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hex_digest = stored.split("$", 1)
    except ValueError:
        return False
    expected = hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(expected, hex_digest)


def init_db():
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                nickname TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                avatar_color TEXT NOT NULL DEFAULT '#d4af37',
                role_badge TEXT NOT NULL DEFAULT '放映室常客',
                bio TEXT NOT NULL DEFAULT '',
                taste_tags TEXT NOT NULL DEFAULT '[]',
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS follows (
                follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (follower_id, followee_id)
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                anime_id TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('want', 'watching', 'watched', 'dropped')),
                personal_score INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, anime_id)
            );

            CREATE TABLE IF NOT EXISTS episode_progress (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                anime_id TEXT NOT NULL,
                episodes_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, anime_id)
            );

            CREATE TABLE IF NOT EXISTS saved_lists (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                list_id TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, list_id)
            );

            CREATE TABLE IF NOT EXISTS custom_lists (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                subtitle TEXT NOT NULL DEFAULT '',
                lead TEXT NOT NULL DEFAULT '',
                items_json TEXT NOT NULL DEFAULT '[]',
                likes INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anime_id TEXT NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                episode_num INTEGER DEFAULT 0,
                rating INTEGER DEFAULT 0,
                is_spoiler INTEGER NOT NULL DEFAULT 0,
                likes INTEGER NOT NULL DEFAULT 0,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS comment_likes (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, comment_id)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                anime_id TEXT NOT NULL,
                from_nickname TEXT NOT NULL,
                snippet TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
            """
        )

        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            seed_v4_community(conn)


def seed_v4_community(conn: sqlite3.Connection):
    pw = hash_password("123456")
    uid = {}
    for uname, nick, color, badge, bio, tags in DEMO_PERSONAS:
        cur = conn.execute(
            """
            INSERT INTO users (username, nickname, password_hash, avatar_color, role_badge, bio, taste_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (uname, nick, pw, color, badge, bio, json.dumps(tags, ensure_ascii=False)),
        )
        uid[uname] = cur.lastrowid

    # 预置社交关注网
    for a, b in [
        ("sakuga_archaeologist", "match_cut_lotus"),
        ("sakuga_archaeologist", "shimokitazawa_telecaster"),
        ("kamogawa_tatami", "sakuga_archaeologist"),
        ("shimokitazawa_telecaster", "bluebird_oboe"),
        ("wired_protocol_07", "match_cut_lotus"),
        ("bluebird_oboe", "tokoga_mushi"),
        ("rose_coffin_utena", "rakugo_shinigami"),
        ("tokoga_mushi", "rakugo_shinigami"),
        ("match_cut_lotus", "sakuga_archaeologist"),
        ("spiral_drill_1995", "sakuga_archaeologist"),
        ("divergence_1048596", "kamogawa_tatami"),
        ("bocchi_mango_box", "shimokitazawa_telecaster"),
    ]:
        conn.execute("INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)", (uid[a], uid[b]))

    # 预置丰富的书架记录
    shelf_rows = [
        ("sakuga_archaeologist", "cowboy-bebop", "watched", 10),
        ("sakuga_archaeologist", "ping-pong", "watched", 10),
        ("sakuga_archaeologist", "gurren-lagann", "watched", 10),
        ("sakuga_archaeologist", "space-dandy", "watched", 10),
        ("sakuga_archaeologist", "nichijou", "watched", 9),
        ("sakuga_archaeologist", "bocchi-the-rock", "watching", 9),
        ("kamogawa_tatami", "tatami-galaxy", "watched", 10),
        ("kamogawa_tatami", "ping-pong", "watched", 10),
        ("kamogawa_tatami", "space-dandy", "watched", 9),
        ("kamogawa_tatami", "night-is-short", "watched", 9),
        ("shimokitazawa_telecaster", "bocchi-the-rock", "watched", 10),
        ("shimokitazawa_telecaster", "cowboy-bebop", "watched", 10),
        ("shimokitazawa_telecaster", "samurai-champloo", "watched", 10),
        ("shimokitazawa_telecaster", "liz-and-the-blue-bird", "watched", 10),
        ("wired_protocol_07", "serial-experiments-lain", "watched", 10),
        ("wired_protocol_07", "ghost-in-the-shell", "watched", 10),
        ("wired_protocol_07", "evangelion", "watched", 10),
        ("wired_protocol_07", "shinsekai-yori", "watched", 9),
        ("bluebird_oboe", "liz-and-the-blue-bird", "watched", 10),
        ("bluebird_oboe", "hyouka", "watched", 10),
        ("bluebird_oboe", "nichijou", "watched", 10),
        ("rose_coffin_utena", "utena", "watched", 10),
        ("rose_coffin_utena", "madoka-magica", "watched", 10),
        ("rose_coffin_utena", "rakugo-shinju", "watched", 10),
        ("tokoga_mushi", "mushishi", "watched", 10),
        ("tokoga_mushi", "yokohama-kaidashi", "watched", 10),
        ("tokoga_mushi", "rakugo-shinju", "watched", 10),
        ("match_cut_lotus", "millennium-actress", "watched", 10),
        ("match_cut_lotus", "cowboy-bebop", "watched", 10),
        ("match_cut_lotus", "ping-pong", "watched", 10),
        ("spiral_drill_1995", "evangelion", "watched", 10),
        ("spiral_drill_1995", "gurren-lagann", "watched", 10),
        ("divergence_1048596", "steins-gate", "watched", 10),
        ("divergence_1048596", "tatami-galaxy", "watched", 10),
        ("divergence_1048596", "odd-taxi", "watched", 10),
        ("rakugo_shinigami", "rakugo-shinju", "watched", 10),
        ("rakugo_shinigami", "millennium-actress", "watched", 10),
        ("bocchi_mango_box", "bocchi-the-rock", "watched", 10),
        ("bocchi_mango_box", "nichijou", "watched", 10),
    ]
    for uname, aid, st, sc in shelf_rows:
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, anime_id, status, personal_score) VALUES (?, ?, ?, ?)",
            (uid[uname], aid, st, sc),
        )

    # 预置各剧集深度评论与楼中楼互动（含单集随记、防剧透遮罩、高赞同感）
    def add_thread(anime_id, root_tuple, replies_list):
        u_root, ep_root, rate_root, sp_root, likes_root, txt_root, dt_root = root_tuple
        cur = conn.execute(
            """
            INSERT INTO comments (anime_id, user_id, parent_id, episode_num, rating, is_spoiler, likes, content, created_at)
            VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
            """,
            (anime_id, uid[u_root], ep_root, rate_root, sp_root, likes_root, txt_root, dt_root),
        )
        pid = cur.lastrowid
        for u_rep, ep_rep, sp_rep, likes_rep, txt_rep, dt_rep in replies_list:
            conn.execute(
                """
                INSERT INTO comments (anime_id, user_id, parent_id, episode_num, rating, is_spoiler, likes, content, created_at)
                VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
                """,
                (anime_id, uid[u_rep], pid, ep_rep, sp_rep, likes_rep, txt_rep, dt_rep),
            )

    # 01. 星际牛仔
    add_thread(
        "cowboy-bebop",
        ("match_cut_lotus", 5, 10, 1, 342, "重温第五话《堕天使们的叙事曲》，渡边信一郎在教堂高潮戏里的空间调度简直是教科书。前半段斯派克上楼的枪战用极快的硬切和吴宇森式的双枪滑步拉满肾上腺素，直到维夏斯将他从玫瑰花窗抛出——时间流速瞬间被砍慢了四倍。伴随Carla Vallet清冷的女声圣咏《Green Bird》，画面在“下坠的物理空间”与“三年前雨夜茱莉亚为他疗伤的记忆空间”之间做等距交叉蒙太奇。一快一慢、一动一静，把一个赏金猎人骨子里的求死欲拍成了宗教画。", "2026-11-16 21:15"),
        [
            ("sakuga_archaeologist", 5, 0, 128, "补充一个作画细节：这场教堂戏是竹内浩志一人包办作监并画了大量原画！注意看斯派克拿着手榴弹转身、风衣下摆拧成麻花状的背动，还有玫瑰花窗玻璃碎片在慢镜头里围绕他旋转的立体透视，那是完完全全的手绘空间感，没有任何3D辅助。", "2026-11-16 21:42"),
            ("shimokitazawa_telecaster", 5, 1, 95, "而且《Green Bird》切入的那一秒，环境音（枪声、玻璃碎裂声、雨声）是完全被抽干的！菅野洋子在这里用的是极其克制的八音盒质感伴奏，直到斯派克摔进花丛睁开眼，现实的雨声才重新涌进来。这种“听觉真空”就是神回的灵魂。", "2026-11-16 22:10"),
        ],
    )
    add_thread(
        "cowboy-bebop",
        ("sakuga_archaeologist", 26, 10, 1, 215, "把EP20和EP26放在一起看，能明显感受到BONES建社前夕南雅彦团队的作画统治力。EP20中村丰画的东甫空中悬浮对射，子弹轨迹带着金田式的折线闪电；而EP26川元利浩修正的斯派克最后的笑脸与“Bang”，线条干净得没有一丝赘肉。从狂放的表现主义到极致的古典写实，这班人什么都能画。", "2026-11-17 00:18"),
        [
            ("rakugo_shinigami", 24, 1, 82, "刚看到EP24艾德离开那集，再来读你们聊EP26真受不了……斯派克和杰特狂往嘴里塞水煮蛋那个长镜头，明明没有任何台词，山寺宏一连呼吸声都没怎么配，但我看着看着眼泪就掉下来了。成年人的告别从来不哭天抢地。", "2026-11-17 01:05"),
        ],
    )

    # 02. 虫师
    add_thread(
        "mushishi",
        ("tokoga_mushi", 2, 10, 1, 276, "《虫师》第二话「睑之光」是我向所有人安利长滨博史时的首选。“闭上眼皮是一片黑暗，再闭上第二层眼睑，才是真正的黑暗。”演出上最绝的地方在于，为了表现少女翠和Biki躲在仓库里的畏光状态，整集前15分钟的画面明度被压到了电视广播标准的极限，但暗部里却用数码摄影叠加了细碎的青绿色虫光。当银古让她“把第二层眼睑也闭上”时，黑暗深处骤然亮起的光之河，直接把生理上的失明转化成了通往宇宙本源的视觉冥想。", "2026-11-15 23:10"),
        [
            ("bluebird_oboe", 2, 1, 112, "最戳我的是结局的处理：翠装上了银古留下的义眼（其实是封装在玻璃球里的虫），虽然失去了普通人的视力，却能再次站在阳光下看着小满。长滨博史从来不给廉价的“奇迹痊愈”，他给的是与残缺共生后的平静。", "2026-11-15 23:45"),
            ("wired_protocol_07", 2, 0, 67, "增田俊郎的配乐在这一话也极其克制，金属风铃与低音大提琴的泛音就像在潮湿的木屋地板下震动，戴上耳机看会有种颅内起鸡皮疙瘩的ASMR感。", "2026-11-16 00:12"),
        ],
    )
    add_thread(
        "mushishi",
        ("tokoga_mushi", 6, 10, 1, 310, "第六话「吸露之群」把庄子的“朝菌不知晦朔，蟪蛄不知春秋”拍成了具象的视觉诗。海岛上的少女阿古屋由于寄生了吸露之虫，每天清晨随露水蒸发而迅速衰老成白发老妪，傍晚又随湿气降临恢复成妙龄少女。长滨博史在表现“一日一生”时，用了一个固定机位的延时溶图：阳光从窗棂移过，阿古屋盘坐的身躯在几秒内佝偻下去，那种对时间尺度的敬畏感太震撼了。", "2026-11-16 19:30"),
        [
            ("sakuga_archaeologist", 6, 0, 94, "这集作监是马越嘉彦亲自下场！阿古屋在黄昏海风里从老妪变回少女的那一卡，皮肤从干瘪松弛逐渐充盈、眼神重获清澈的微表情过渡，马越的线条简直有神性。", "2026-11-16 20:05"),
        ],
    )

    # 03. 乒乓
    add_thread(
        "ping-pong",
        ("kamogawa_tatami", 6, 10, 1, 489, "每年圣诞夜固定重温《乒乓》第6话！最后四分钟的平行蒙太奇如果说是2010年代TV动画演出第一名，应该没人反对吧？卡拉OK里小泉老师点了一首浜田省吾的《Midnight Flight》，歌声作为唯一的音频轨道贯穿四个空间：上海来的妈妈给孔文革和队友包热腾腾的饺子、风间龙一在冰冷的器械室孤独地流汗、月本诚在街头等星野、而自暴自弃的星野裕跳进冰冷的冬夜河水里，浮出水面后突然仰天狂笑——就在那一刻他想起了自己有多爱乒乓球！每次看到孔文革夹起饺子眼眶泛红，我都跟着爆哭。", "2026-11-16 20:15"),
        [
            ("shimokitazawa_telecaster", 6, 1, 186, "音乐设计上最绝的是：前半段还是卡拉OK包厢里半人声合唱的走调伴奏，当镜头切到星野从桥上跃入水中的瞬间，牛尾宪辅编写的清亮电子合成器琶音突然叠加进来，直接把俗气的KTV老歌升华成了圣歌！", "2026-11-16 20:40"),
            ("match_cut_lotus", 6, 1, 134, "还有色彩冷暖的对比：孔文革宿舍是饱和度极高的暖橘黄（妈妈的毛衣、台灯、热气），风间那边是死寂的钢铁冷蓝，而星野在水里抬头看见的圣诞彩灯倒影则是五彩斑斓的破碎光斑。汤浅政明对情绪色温的把控太老辣了。", "2026-11-16 21:02"),
        ],
    )
    add_thread(
        "ping-pong",
        ("sakuga_archaeologist", 11, 10, 1, 365, "EP10大平晋也负责的原画段落（星野VS风间高潮）和EP11汤浅亲自演出的决赛（星野VS月本），彻底证明了“写实不等于照搬现实照片”。大平笔下扭曲如融化蜡烛般的肌肉线条、球拍挥动时撕裂空间的铅笔碳粉质感，比任何高精度修型都更能传递出“膝盖碎裂也要飞起来”的生命张力。到了EP11，连背景和上色都省去了，两个人在纯白画布上化作童年的线条剪影对拉弧圈球，“血是铁的味道”，这就是体育动画的终极形态。", "2026-11-17 09:20"),
        [
            ("divergence_1048596", 11, 1, 76, "而且结局处理得太潇洒了！最热爱乒乓的星野去了欧洲职业联赛，最有天赋的月本却选择当小学老师辅导孩子们，孔文革入籍日本代表国家队出战。每个人都在乒乓球里找到了自己的归宿，而不是唯金牌论。", "2026-11-17 10:05"),
        ],
    )

    # 04. 孤独摇滚！
    add_thread(
        "bocchi-the-rock",
        ("shimokitazawa_telecaster", 8, 10, 1, 520, "载入令和动画史册的第8话！台风夜的下北泽STARRY，台下只有寥寥几个观众，乐队因为紧张导致《ギターと孤独と蒼い惑星》节奏全乱、濒临崩盘。就在第二首歌《あのバンド（那个乐队）》开始前，后藤一里突然往前踏出一步，踩下效果器，直接甩出一段原曲里根本没有的20秒高难度即兴Intro Solo！当她抬起头露出右眼、喊出“接下来，那个乐队”时，斋藤圭一郎和けろりら把之前攒了七集的社恐憋屈感一次性引爆，爽感堪比《爆裂鼓手》结尾！", "2026-11-16 22:30"),
        [
            ("bocchi_mango_box", 8, 1, 210, "这一集最神的不止是Live！后面庆功宴在居酒屋里，虹夏对波奇说“今后也请多关照啦，我们的吉他英雄，请带我们见识最棒的风景吧——孤独摇滚（ぼっち・ざ・ろっく）！”紧接着黑屏卡点切入虹夏唱的ED3《なにが悪い》，我当时在屏幕前直接尖叫出声！这种点题方式太犯规了！", "2026-11-16 22:55"),
            ("sakuga_archaeologist", 8, 0, 155, "考据一下作画：虽然全剧Live用了3D动作捕捉做底参考，但第8话波奇Solo那一段是けろりら（Kerorira）和Franziska van Wulfen纯手绘修正并加了极强的作画张力！注意看波奇甩头时粉色发丝的残影和琴颈的微弯透视，3D绝对做不出那种狂气的呼吸感。", "2026-11-16 23:20"),
        ],
    )

    # 05. 四叠半神话大系
    add_thread(
        "tatami-galaxy",
        ("kamogawa_tatami", 10, 10, 1, 460, "《四叠半》第10话「四叠半主义者」，夏目真悟分镜演出的封神之作！整整22分钟，只有浅沼晋太郎一个人的台词，场景永远是4.5张榻榻米大小的宿舍。但当“我”推开衣柜、推开房门，发现门外还是另一个四叠半房间时，前九话平行世界的遗物全部出现了：电影社的胶片、自行车社的轮子、英会话社的充气娃娃……“我”在无限延伸的四叠半迷宫里读自己写下的日记，最终明白所谓“玫瑰色校园生活”根本不存在，正是因为害怕受伤而躲在房间里的自己，才是最荒唐的囚徒。", "2026-11-16 18:10"),
        [
            ("divergence_1048596", 10, 1, 175, "这集在剧本结构上相当于把前九集的“横向平行世界”全部折叠成了“纵向空间迷宫”。最妙的是挂在灯绳上的那只小熊吊坠，无论在哪个四叠半房间里它都在那里，引导着主角最终意识到明石学姐一直在每个世界线的终点等他。", "2026-11-16 18:45"),
        ],
    )

    # 06. 新世纪福音战士
    add_thread(
        "evangelion",
        ("spiral_drill_1995", 19, 10, 1, 412, "重新拉片EVA第19话「男人的战斗」和第24话「最后的使者」，摩砂雪和庵野秀明在95年就已经把TV动画的视听语言玩到了后无来者的地步。第19话力天使一击削平NERV地下掩体，本田雄作监的初号机断电觉醒，像野兽一样四脚着地撕咬使徒并吞食S2机关；而第24话初号机在地下教条区握住渚薰长达64秒的完全静止画，配着贝多芬第九交响曲《欢乐颂》，直接用“时间的凝滞”把观众逼疯。", "2026-11-16 15:20"),
        [
            ("wired_protocol_07", 24, 1, 164, "那64秒静止帧之所以封神，是因为它不是单纯的省钱，而是让你被迫和真嗣一起承受“要不要捏碎世界上唯一无条件爱我的人”的心理凌迟。到了第65秒，没有捏碎的特写，只有一声沉闷的水滴声和飘落进LCL之海的头颅。", "2026-11-16 16:00"),
        ],
    )

    # 07. 攻壳机动队
    add_thread(
        "ghost-in-the-shell",
        ("wired_protocol_07", 2, 10, 0, 530, "95版《攻壳机动队》中间那段3分20秒的「新港市雨中游船空镜（Rainy Boat）」，是押井守留给世界影史的至高杰作。在追捕傀儡师的高强度赛博枪战之后，叙事突然完全停摆：川井宪次的古日语神乐《谣II - Ghost City》响起，草薙素子坐在游船上穿过以香港九龙为原型的运河，岸边百货橱窗里的量产塑料人偶与她四目相对，一架巨型客机从密集的霓虹灯牌上方轰鸣掠过。没有一句台词，却把义体人“我的Ghost究竟是真实的灵魂，还是流水线上的复制品”的存在主义孤独讲透了。", "2026-11-17 08:30"),
        [
            ("match_cut_lotus", 2, 0, 198, "押井守继承自小津安二郎的“空镜头（Pillow Shots）”在动画里拥有更可怕的控制力——因为实拍电影的空镜是等待自然发生，而动画里的每一滴雨、每一根晾衣竹竿、橱窗玻璃上的每一层反光，都是小仓宏昌和冲浦启之用画笔一笔一划“构建”出来的哲思。", "2026-11-17 09:12"),
        ],
    )

    # 08. 利兹与青鸟
    add_thread(
        "liz-and-the-blue-bird",
        ("bluebird_oboe", 3, 10, 1, 510, "在电影院看《利兹与青鸟》的体验是不可复制的。山田尚子在开场7分钟里几乎把镜头全部压在膝盖以下：希美轻快弹跳的步伐与马尾辫，对比霙小心翼翼跟在后面半步、模仿希美摸头发的拘谨。我们所有人都以为希美是打开笼子的利兹，霙是依恋她的青鸟；直到第三乐章《爱的决断》合奏响起，霙的双簧管吹出刺穿天际的高音，彻底碾压了希美的长笛——那一刻镜头切给希美颤抖的瞳孔，我们才惊觉：原来真正拥有飞向天空的旷世才华、需要被放飞的青鸟是霙，而想要锁住青鸟的利兹，恰恰是希美自己！", "2026-11-17 11:00"),
        [
            ("shimokitazawa_telecaster", 3, 1, 192, "牛尾宪辅的配乐（概念是Decoupage拼贴）和松田彬人的交响乐在电影里形成了完美的二元对立！日常戏里牛尾用北宇治校舍实录的脚步声、烧杯滴水声构建了一个易碎的玻璃鱼缸；而第三乐章松田彬人的双簧管独奏直接把这个玻璃缸震碎了！", "2026-11-17 11:35"),
        ],
    )

    # 09. 千年女优
    add_thread(
        "millennium-actress",
        ("match_cut_lotus", 2, 10, 1, 560, "今敏的《千年女优》是我走上剪辑道路的启蒙神作。在第二幕千代子跨越时代的奔跑序列里，今敏用长达3分钟的无缝匹配剪辑（Match Cut），将战国马车、江户纺车、幕末刀光、大正火车与昭和片场串联成一条不间断的运动轨迹，井上俊之绘制的各种奔跑姿态配合平泽进的《Run》，把日本电影百年史浓缩成了一个女人的追寻。而结尾千代子在病床上说出：“因为我真正喜欢的，是那个不断追逐着他的我自己啊。”紧接着火箭升空、白莲盛开，直接将通俗爱情片升华为了存在主义的史诗！", "2026-11-17 12:10"),
        [
            ("sakuga_archaeologist", 2, 0, 205, "井上俊之在访谈里提过，为了画千代子那段跨越时代的奔跑，他特意研究了不同历史时期日本女性的骨骼重心与步幅（比如穿和服木屐时膝盖内扣的小碎步，对比现代装大步流星的摆臂）。一个2分钟的镜头背后是宗师级的考据！", "2026-11-17 12:40"),
        ],
    )

    # 10. 命运石之门 / 魔法少女小圆 / 昭和元禄落语心中 / 冰菓 / 日常 / 奇巧计程车
    for aid, uname, ep, likes, txt, dt in [
        ("steins-gate", "divergence_1048596", 23, 495, "前11话用秋叶原的日常把观众的戒心完全卸下，第12话怀表停摆直接拖进无限轮回地狱。而在经历了整整11话的绝望挣扎后，第23话30岁的冈部跨时空发来视频：“欺骗你自己的同时，欺骗整个世界！”伴随《Skyclad的观测者》响起，第一话所有的谜团在最后一秒全部咬合！", "2026-11-16 14:20"),
        ("madoka-magica", "rose_coffin_utena", 10, 470, "第10话「不再依靠任何人」是一次伟大的叙事重构。整整24分钟，我们跟着麻花辫眼镜娘晓美焰一次次按下盾牌上的时间齿轮。当片尾第一次响起OP《Connect》，所有人才恍然大悟：原来这首欢快的片头曲，从头到尾写的都是晓美焰跨越上百次轮回的孤注一掷！", "2026-11-16 17:05"),
        ("rakugo-shinju", "rakugo_shinigami", 1, 360, "第一季第1话长达48分钟，石田彰饰演的八云大师在舞台上连说8分钟单口落语《死神》，畠山守居然真的敢用最朴素的固定机位与微移特写去正面硬刚落语表演，烛火熄灭的瞬间全场屏息。", "2026-11-16 19:50"),
        ("hyouka", "bluebird_oboe", 22, 405, "《冰菓》第22话武本康弘的终章「绕远路的雏人偶」，漫天樱花与撑伞队伍中千反田回眸的那一眼，以及田埂旁风吹落英中折木咽回肚子里的表白，每次重看都觉得心头一阵酸楚又无比澄澈。", "2026-11-16 13:15"),
        ("nichijou", "bocchi_mango_box", 6, 330, "京都动画把一整个剧场版规格的作画班底拿来做冷笑话是什么体验？请看《日常》第6话武本康弘分镜的「校长先生大战野鹿」和第16话山田尚子分镜的「美绪腐女原稿社死大暴走」！", "2026-11-16 12:00"),
        ("odd-taxi", "divergence_1048596", 4, 310, "千万别被动物拟人的画风骗了！第4话《田中革命》单集独白把一个普通上班族被抽卡手游和虚荣心一步步吞噬的过程拍得让人背脊发凉，而第13话的视觉真相揭晓更是神来之笔。", "2026-11-16 23:10"),
    ]:
        conn.execute(
            """
            INSERT INTO comments (anime_id, user_id, parent_id, episode_num, rating, is_spoiler, likes, content, created_at)
            VALUES (?, ?, NULL, ?, 10, 1, ?, ?, ?)
            """,
            (aid, uid[uname], ep, likes, txt, dt),
        )

    # 预置映友共创片单
    conn.executemany(
        "INSERT OR IGNORE INTO custom_lists (id, user_id, title, subtitle, lead, items_json, likes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                "custom-sakuga-gods",
                uid["sakuga_archaeologist"],
                "作画狂魔的私藏拉片室：那些超越物理法则的手绘神回",
                "社区共创 · 律表考古学家精选",
                "不需要看懂复杂设定，光是用 0.25 倍速逐帧欣赏中村丰、井上俊之、大平晋也与吉成曜的原画线条就足以颅内高潮。",
                json.dumps(
                    [
                        {"animeId": "ping-pong", "watchOrderNote": "大平晋也 EP10 铅笔速写狂飙", "reason": "把球拍抽击与人体拉伸画出了表现主义油画的张力。"},
                        {"animeId": "gurren-lagann", "watchOrderNote": "吉成曜 EP27 超银河钻头", "reason": "纯手绘闪电与机械爆甲的影史最高峰。"},
                        {"animeId": "space-dandy", "watchOrderNote": "三原三千夫 & 押山清高单集实验", "reason": "BONES 不计成本的作者作画游乐场。"},
                    ],
                    ensure_ascii=False,
                ),
                48,
            ),
            (
                "custom-soundscape-night",
                uid["shimokitazawa_telecaster"],
                "戴上耳机才能看懂的分镜：声画对位与环境采样神作",
                "社区共创 · 下北泽失真贝斯精选",
                "当配乐不再只是背景音，而是直接与人物的脚步声、呼吸声和剪辑点咬合在一起。",
                json.dumps(
                    [
                        {"animeId": "liz-and-the-blue-bird", "watchOrderNote": "牛尾宪辅的走廊脚步声采样", "reason": "烧杯、窗格与木管乐器的微观室内乐。"},
                        {"animeId": "cowboy-bebop", "watchOrderNote": "菅野洋子的太空蓝调与圣咏", "reason": "第五话教堂坠落时的听觉真空处理堪称教科书。"},
                        {"animeId": "bocchi-the-rock", "watchOrderNote": "下北泽 SHELTER 的即兴滑棒", "reason": "第8话踩下失真效果器那一秒的真实电流噪点。"},
                    ],
                    ensure_ascii=False,
                ),
                39,
            ),
        ],
    )

    # 为常驻体验角色预置未读回复提醒
    conn.executemany(
        """
        INSERT INTO notifications (user_id, comment_id, anime_id, from_nickname, snippet, is_read)
        VALUES (?, ?, ?, ?, ?, 0)
        """,
        [
            (uid["match_cut_lotus"], 2, "cowboy-bebop", "律表考古学家", "补充一个作画细节：这场教堂戏是竹内浩志一人包办作监并画了大量原画！"),
            (uid["tokoga_mushi"], 7, "mushishi", "理科室的河豚君", "最戳我的是结局的处理：长滨博史从来不给廉价的“奇迹痊愈”，他给的是与残缺共生后的平静。"),
            (uid["kamogawa_tatami"], 11, "ping-pong", "下北泽失真贝斯", "当镜头切到星野从桥上跃入水中的瞬间，牛尾宪辅编写的清亮电子合成器琶音突然叠加进来！"),
            (uid["shimokitazawa_telecaster"], 16, "bocchi-the-rock", "完熟芒果纸箱", "后面庆功宴在居酒屋里，虹夏说出“孤独摇滚”紧接着黑屏卡点切入ED3太犯规了！"),
        ],
    )


LARGE_SCRIPTS = ("/catalog/index.js", "/catalog/facts.js")


@lru_cache(maxsize=4)
def compressed_script(path, mtime_ns):
    return gzip.compress(path.read_bytes(), compresslevel=3, mtime=0)


class FangyingV4Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        path = urlparse(self.path).path
        if path in LARGE_SCRIPTS:
            self.send_header("Vary", "Accept-Encoding")
        if path == "/index.html":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length > 1048576: raise ValueError("提交内容过大")
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _send_json(self, status: int, payload: dict, extra_headers: dict | None = None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for k, v in extra_headers.items():
                for value in (v if isinstance(v, list) else [v]):
                    self.send_header(k, value)
        self.end_headers()
        self.wfile.write(body)

    def _current_user(self):
        c = cookies.SimpleCookie()
        c.load(self.headers.get("Cookie", ""))
        morsel = c.get("completion_demo") or c.get("fy_v4_session")
        if not morsel:
            return None
        with get_db() as conn:
            row = conn.execute(
                """
                SELECT u.id, u.username, u.nickname, u.avatar_color, u.role_badge, u.bio, u.taste_tags
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = ?
                """,
                (morsel.value,),
            ).fetchone()
            if not row:
                return None
            d = dict(row)
            d["taste_tags"] = json.loads(d["taste_tags"] or "[]")
            return d

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in LARGE_SCRIPTS and re.search(r"(?:^|,)\s*gzip\s*(?:,|$)", self.headers.get("Accept-Encoding", "")):
            source = BASE_DIR / path[1:]
            body = compressed_script(source, source.stat().st_mtime_ns)
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/read" or path.startswith("/read/"):
            suffix = path[len("/read"):].rstrip("/") or "/"
            destination = suffix if re.fullmatch(r"/(?:find|lists|(?:list|anime)/[a-zA-Z0-9_-]+)?", suffix) else "/"
            query = urlencode(parse_qs(parsed.query), doseq=True)
            self.send_response(302)
            self.send_header("Location", destination + ("?" + query if query else ""))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        if path == "/browse" or path.startswith("/browse/"):
            status, body = reading_page(path, parsed.query)
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        poster = re.fullmatch(r"/artwork/([1-9][0-9]{0,8})", path)
        if poster:
            data = load_poster(poster[1])
            if data is None:
                self.send_error(404, "Poster unavailable")
                return
            self.send_response(200)
            self.send_header("Content-Type", image_type(data))
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=604800")
            self.end_headers()
            self.wfile.write(data)
            return

        if path == "/api/bootstrap":
            user = self._current_user()
            with get_db() as conn:
                unread = 0
                my_watchlist = []
                my_saved_lists = []
                my_ep_progress = {}
                if user:
                    unread = conn.execute(
                        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
                        (user["id"],),
                    ).fetchone()[0]
                    my_watchlist = [
                        dict(r)
                        for r in conn.execute(
                            "SELECT anime_id, status, personal_score, updated_at FROM watchlist WHERE user_id = ?",
                            (user["id"],),
                        ).fetchall()
                    ]
                    my_saved_lists = [
                        r[0]
                        for r in conn.execute("SELECT list_id FROM saved_lists WHERE user_id = ?", (user["id"],)).fetchall()
                    ]
                    for r in conn.execute("SELECT anime_id, episodes_json FROM episode_progress WHERE user_id = ?", (user["id"],)).fetchall():
                        my_ep_progress[r["anime_id"]] = json.loads(r["episodes_json"] or "[]")

                recent_rows = conn.execute(
                    """
                    SELECT c.id, c.anime_id, c.episode_num, c.rating, c.likes, c.is_spoiler, c.content, c.created_at,
                           u.username, u.nickname, u.avatar_color, u.role_badge
                    FROM comments c
                    JOIN users u ON u.id = c.user_id
                    ORDER BY c.id DESC
                    LIMIT 18
                    """
                ).fetchall()

                personas = conn.execute(
                    """
                    SELECT u.id, u.username, u.nickname, u.avatar_color, u.role_badge, u.bio, u.taste_tags,
                           (SELECT COUNT(*) FROM watchlist w WHERE w.user_id = u.id) AS watched_count,
                           (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comment_count
                    FROM users u
                    ORDER BY u.id ASC
                    """
                ).fetchall()

                persona_works = {}
                for watch in conn.execute("SELECT user_id, anime_id FROM watchlist"):
                    persona_works.setdefault(watch["user_id"], []).append(watch["anime_id"])
                custom_lists = conn.execute(
                    """
                    SELECT cl.*, u.nickname, u.username, u.avatar_color, u.role_badge
                    FROM custom_lists cl
                    JOIN users u ON u.id = cl.user_id
                    ORDER BY cl.likes DESC, cl.created_at DESC
                    """
                ).fetchall()

            return self._send_json(
                200,
                {
                    "user": user,
                    "unreadCount": unread,
                    "watchlist": my_watchlist,
                    "savedLists": my_saved_lists,
                    "episodeProgress": my_ep_progress,
                    "recentDiscussions": [dict(r) for r in recent_rows],
                    "personas": [{**dict(p), "is_demo": p["username"] in DEMO_USERS, "anime_ids": persona_works.get(p["id"], []), "taste_tags": json.loads(p["taste_tags"] or "[]")} for p in personas],
                    "customLists": [{**dict(cl), "items": json.loads(cl["items_json"] or "[]")} for cl in custom_lists],
                },
            )

        if path.startswith("/api/anime/") and path.endswith("/comments"):
            anime_id = path.split("/")[3]
            base_id = anime_id.split("-reel-")[0]
            with get_db() as conn:
                rows = conn.execute(
                    """
                    SELECT c.id, c.anime_id, c.user_id, c.parent_id, c.episode_num, c.rating,
                           c.is_spoiler, c.likes, c.content, c.created_at,
                           u.username, u.nickname, u.avatar_color, u.role_badge
                    FROM comments c
                    JOIN users u ON u.id = c.user_id
                    WHERE c.anime_id IN (?, ?)
                    ORDER BY c.id ASC
                    """,
                    (anime_id, base_id),
                ).fetchall()
            return self._send_json(200, {"comments": [dict(r) for r in rows]})

        if path.startswith("/api/users/"):
            target_username = path.split("/")[3]
            viewer = self._current_user()
            with get_db() as conn:
                u = conn.execute(
                    "SELECT id, username, nickname, avatar_color, role_badge, bio, taste_tags, created_at FROM users WHERE username = ?",
                    (target_username,),
                ).fetchone()
                if not u:
                    return self._send_json(404, {"error": "未找到该映友"})
                ud = dict(u)
                ud["taste_tags"] = json.loads(ud["taste_tags"] or "[]")
                wlist = [
                    dict(r)
                    for r in conn.execute(
                        "SELECT anime_id, status, personal_score, updated_at FROM watchlist WHERE user_id = ? ORDER BY updated_at DESC",
                        (u["id"],),
                    ).fetchall()
                ]
                comms = [
                    dict(r)
                    for r in conn.execute(
                        "SELECT id, anime_id, episode_num, rating, likes, is_spoiler, content, created_at FROM comments WHERE user_id = ? ORDER BY id DESC",
                        (u["id"],),
                    ).fetchall()
                ]
                followers_count = conn.execute("SELECT COUNT(*) FROM follows WHERE followee_id = ?", (u["id"],)).fetchone()[0]
                following_count = conn.execute("SELECT COUNT(*) FROM follows WHERE follower_id = ?", (u["id"],)).fetchone()[0]
                is_following = False
                if viewer:
                    is_following = bool(
                        conn.execute(
                            "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
                            (viewer["id"], u["id"]),
                        ).fetchone()
                    )
            return self._send_json(
                200,
                {
                    "profile": ud,
                    "watchlist": wlist,
                    "comments": comms,
                    "followersCount": followers_count,
                    "followingCount": following_count,
                    "isFollowing": is_following,
                },
            )

        if path == "/api/me/overview":
            user = self._current_user()
            if not user:
                return self._send_json(401, {"error": "请先登录"})
            with get_db() as conn:
                notifs = [
                    dict(r)
                    for r in conn.execute(
                        """
                        SELECT id, comment_id, anime_id, from_nickname, snippet, is_read, created_at
                        FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30
                        """,
                        (user["id"],),
                    ).fetchall()
                ]
            return self._send_json(200, {"notifications": notifs})

        if path in ("/find", "/lists") or path.startswith(("/anime/", "/list/")):
            _, _, preview = reading_content("/browse" + path, parsed.query)
            shell = (BASE_DIR / "index.html").read_text(encoding="utf-8")
            start = shell.index('<section class="hero exhibition-hero">')
            end = shell.index('<!-- end opening content -->', start)
            preview = preview.replace('href="/browse/', 'href="/').replace('action="/browse/find"', 'action="/find"')
            shell = shell[:start] + '<div class="reader">' + preview + '</div>' + shell[end:]
            body = shell.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if (
            path.startswith("/list/")
            or path.startswith("/anime/")
            or path.startswith("/user/")
            or path in ("/", "/index.html", "/mine", "/community", "/find", "/lists", "/play")
        ):
            self.path = "/index.html"
        if not (self.path == "/" or self.path == "/index.html" or path == "/catalog/criticism.json" or re.fullmatch(r"/(?:[a-z_-]+\.(?:js|css)|catalog/[a-z-]+\.js|assets/[\w-]+\.(?:jpg|woff2)|assets/shelf/[1-9]\d*\.jpg|catalog/[\d.Z-]+/\d+\.js)", self.path.split("?")[0])):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        try:
            self._handle_post()
        except (ValueError, TypeError, AttributeError, KeyError):
            self._send_json(400, {"error":"请求参数无效"})
        except sqlite3.IntegrityError:
            self._send_json(409, {"error":"记录已存在或关联目标不存在"})

    def _handle_post(self):
        parsed = urlparse(self.path)
        path = parsed.path
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc != self.headers.get("Host"):
            return self._send_json(403, {"error":"请求来源不匹配"})
        try:
            data = self._read_json()
            if not isinstance(data, dict): raise ValueError()
        except (ValueError, UnicodeError):
            return self._send_json(400, {"error":"请求数据无效"})

        if path == "/api/auth/register":
            username = (data.get("username") or "").strip().lstrip("@")
            nickname = (data.get("nickname") or "").strip()
            password = data.get("password") or ""
            bio = (data.get("bio") or "热爱深夜展映与分镜考据的馆内访客。").strip()
            guest_watchlist = data.get("guestWatchlist") or []
            guest_lists = data.get("guestLists") or []

            if not re.fullmatch(r"[a-zA-Z0-9_-]{2,40}", username) or not 1 <= len(nickname) <= 40 or not 4 <= len(password) <= 128:
                return self._send_json(400, {"error": "账号须为 2–40 位字母、数字、下划线或短横线，昵称 1–40 字，密码 4–128 位"})

            with get_db() as conn:
                exists = conn.execute(
                    "SELECT 1 FROM users WHERE username = ? OR nickname = ?",
                    (username, nickname),
                ).fetchone()
                if exists:
                    return self._send_json(409, {"error": "该账号或唯一昵称已被注册，请换一个"})

                cur = conn.execute(
                    """
                    INSERT INTO users (username, nickname, password_hash, avatar_color, role_badge, bio, taste_tags)
                    VALUES (?, ?, ?, '#d4af37', '新晋馆员', ?, '["深夜放映","独立审美"]')
                    """,
                    (username, nickname, hash_password(password), bio),
                )
                user_id = cur.lastrowid

                for item in guest_watchlist:
                    aid = str(item.get("animeId") or "").strip()
                    st = item.get("status") if item.get("status") in ("want", "watching", "watched", "dropped") else "want"
                    sc = int(item.get("personalScore") or 0)
                    if aid:
                        conn.execute(
                            "INSERT OR IGNORE INTO watchlist (user_id, anime_id, status, personal_score) VALUES (?, ?, ?, ?)",
                            (user_id, aid, st, sc),
                        )
                for lid in guest_lists:
                    if lid:
                        conn.execute(
                            "INSERT OR IGNORE INTO saved_lists (user_id, list_id) VALUES (?, ?)",
                            (user_id, str(lid)),
                        )

                for aid, episodes in (data.get("guestEpisodeProgress") or {}).items():
                    checked = sorted({n for n in episodes if type(n) == int and 0 < n <= 10000})
                    conn.execute("INSERT OR IGNORE INTO episode_progress(user_id,anime_id,episodes_json) VALUES(?,?,?)", (user_id,aid,json.dumps(checked)))
                token = secrets.token_urlsafe(32)
                conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))

            return self._send_json(
                201,
                {"ok": True},
                {"Set-Cookie": [f"fy_v4_session={token}; Path=/; HttpOnly; SameSite=Lax", "completion_demo=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"]},
            )

        if path == "/api/auth/login":
            username = (data.get("username") or "").strip().lstrip("@")
            password = data.get("password") or ""
            with get_db() as conn:
                row = conn.execute(
                    "SELECT id, password_hash FROM users WHERE username = ? OR nickname = ? ORDER BY (username = ?) DESC LIMIT 1",
                    (username, username, username),
                ).fetchone()
                if not row or not verify_password(password, row["password_hash"]):
                    return self._send_json(401, {"error": "账号或密码不正确"})
                token = secrets.token_urlsafe(32)
                conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, row["id"]))
            return self._send_json(
                200,
                {"ok": True},
                {"Set-Cookie": [f"fy_v4_session={token}; Path=/; HttpOnly; SameSite=Lax", "completion_demo=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"]},
            )

        if path == "/api/auth/quick-switch":
            username = (data.get("username") or "").strip().lstrip("@")
            if username not in DEMO_USERS:
                return self._send_json(403, {"error":"注册账号请使用密码登录"})
            with get_db() as conn:
                row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
                if not row:
                    return self._send_json(404, {"error": "角色不存在"})
                token = secrets.token_urlsafe(32)
                conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, row["id"]))
            return self._send_json(
                200,
                {"ok": True},
                {"Set-Cookie": f"completion_demo={token}; Path=/; HttpOnly; SameSite=Lax"},
            )

        if path == "/api/auth/logout":
            c = cookies.SimpleCookie()
            c.load(self.headers.get("Cookie", ""))
            morsel = c.get("completion_demo") or c.get("fy_v4_session")
            if morsel:
                with get_db() as conn:
                    conn.execute("DELETE FROM sessions WHERE token = ?", (morsel.value,))
            return self._send_json(
                200,
                {"ok": True},
                {"Set-Cookie": f"{morsel.key if morsel else 'fy_v4_session'}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"},
            )

        user = self._current_user()
        if not user:
            return self._send_json(401, {"error": "请先登录"})

        if path == "/api/me/profile":
            bio = (data.get("bio") or "").strip()
            if len(bio) > 200:
                return self._send_json(400, {"error": "签名最多 200 字"})
            with get_db() as conn:
                conn.execute("UPDATE users SET bio=? WHERE id=?", (bio,user["id"]))
            return self._send_json(200, {"ok": True})

        if path == "/api/me/watchlist":
            anime_id = str(data.get("animeId") or "").strip()
            status = data.get("status")
            score = int(data.get("personalScore") or 0)
            with get_db() as conn:
                if status in ("want", "watching", "watched", "dropped"):
                    conn.execute(
                        """
                        INSERT INTO watchlist (user_id, anime_id, status, personal_score, updated_at)
                        VALUES (?, ?, ?, ?, datetime('now'))
                        ON CONFLICT(user_id, anime_id) DO UPDATE SET
                            status = excluded.status,
                            personal_score = CASE WHEN excluded.personal_score > 0 THEN excluded.personal_score ELSE watchlist.personal_score END,
                            updated_at = datetime('now')
                        """,
                        (user["id"], anime_id, status, score),
                    )
                else:
                    conn.execute("DELETE FROM watchlist WHERE user_id = ? AND anime_id = ?", (user["id"], anime_id))
            return self._send_json(200, {"ok": True})

        if path == "/api/me/episode-progress":
            anime_id = str(data.get("animeId") or "").strip()
            episodes = data.get("episodes") or []
            if not isinstance(episodes,list) or len(episodes)>10000 or any(type(n)!=int or not 0<n<=10000 for n in episodes):
                return self._send_json(400, {"error":"集数无效"})
            episodes=sorted(set(episodes))
            with get_db() as conn:
                conn.execute(
                    """
                    INSERT INTO episode_progress (user_id, anime_id, episodes_json, updated_at)
                    VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id, anime_id) DO UPDATE SET
                        episodes_json = excluded.episodes_json,
                        updated_at = datetime('now')
                    """,
                    (user["id"], anime_id, json.dumps(episodes)),
                )
            return self._send_json(200, {"ok": True})

        if path == "/api/me/saved-lists":
            list_id = str(data.get("listId") or "").strip()
            saved = bool(data.get("saved", True))
            with get_db() as conn:
                if saved:
                    conn.execute("INSERT OR IGNORE INTO saved_lists (user_id, list_id) VALUES (?, ?)", (user["id"], list_id))
                else:
                    conn.execute("DELETE FROM saved_lists WHERE user_id = ? AND list_id = ?", (user["id"], list_id))
            return self._send_json(200, {"ok": True})

        if path == "/api/me/follow":
            target_id = int(data.get("targetUserId") or 0)
            if target_id == user["id"] or target_id <= 0:
                return self._send_json(400, {"error": "无法关注自己"})
            with get_db() as conn:
                exists = conn.execute(
                    "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
                    (user["id"], target_id),
                ).fetchone()
                if exists:
                    conn.execute("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", (user["id"], target_id))
                    following = False
                else:
                    conn.execute("INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)", (user["id"], target_id))
                    following = True
            return self._send_json(200, {"following": following})

        if path == "/api/custom-lists":
            title = (data.get("title") or "").strip()
            subtitle = (data.get("subtitle") or "映友共创策展").strip()
            lead = (data.get("lead") or "").strip()
            items = data.get("items") or []
            if not title or not items:
                return self._send_json(400, {"error": "请填写标题并至少选一部作品"})
            list_id = f"custom-{secrets.token_hex(4)}"
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO custom_lists (id, user_id, title, subtitle, lead, items_json) VALUES (?, ?, ?, ?, ?, ?)",
                    (list_id, user["id"], title, subtitle, lead, json.dumps(items, ensure_ascii=False)),
                )
            return self._send_json(201, {"id": list_id})

        if path.startswith("/api/anime/") and path.endswith("/comments"):
            anime_id = path.split("/")[3]
            content = (data.get("content") or "").strip()
            parent_id = data.get("parentId") or None
            episode_num = int(data.get("episodeNum") or 0)
            rating = int(data.get("rating") or 0)
            is_spoiler = 1 if data.get("isSpoiler") else 0
            if not content:
                return self._send_json(400, {"error": "内容不能为空"})
            with get_db() as conn:
                if not 0 <= rating <= 10 or not 0 <= episode_num <= 10000 or len(content)>10000:
                    return self._send_json(400, {"error":"评论参数超出范围"})
                if parent_id:
                    parent = conn.execute(
                        "SELECT user_id, episode_num FROM comments WHERE id=? AND anime_id=? AND parent_id IS NULL",
                        (parent_id, anime_id),
                    ).fetchone()
                    if not parent:
                        return self._send_json(400, {"error":"回复目标无效"})
                    episode_num = parent["episode_num"]
                cur = conn.execute(
                    """
                    INSERT INTO comments (anime_id, user_id, parent_id, episode_num, rating, is_spoiler, content)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (anime_id, user["id"], parent_id, episode_num, rating, is_spoiler, content),
                )
                comment_id = cur.lastrowid
                if parent_id:
                    if parent["user_id"] != user["id"]:
                        conn.execute(
                            """
                            INSERT INTO notifications (user_id, comment_id, anime_id, from_nickname, snippet)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (parent["user_id"], comment_id, anime_id, user["nickname"], "回复含剧透" if is_spoiler else content[:56]),
                        )
            return self._send_json(201, {"id": comment_id})

        if path.startswith("/api/comments/") and path.endswith("/like"):
            comment_id = int(path.split("/")[3])
            with get_db() as conn:
                conn.execute("BEGIN IMMEDIATE")
                if not conn.execute("SELECT 1 FROM comments WHERE id=?", (comment_id,)).fetchone():
                    return self._send_json(404, {"error":"留言不存在"})
                already = conn.execute(
                    "SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ?",
                    (user["id"], comment_id),
                ).fetchone()
                if already:
                    conn.execute("DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?", (user["id"], comment_id))
                    conn.execute("UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?", (comment_id,))
                else:
                    conn.execute("INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)", (user["id"], comment_id))
                    conn.execute("UPDATE comments SET likes = likes + 1 WHERE id = ?", (comment_id,))
                likes = conn.execute("SELECT likes FROM comments WHERE id = ?", (comment_id,)).fetchone()[0]
            return self._send_json(200, {"likes": likes})

        if path == "/api/me/notifications/read":
            with get_db() as conn:
                conn.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user["id"],))
            return self._send_json(200, {"ok": True})

        return self._send_json(404, {"error": "Not found"})


if __name__ == "__main__":
    init_db()
    port = int(sys.argv[1] if len(sys.argv)>1 else os.environ.get("PORT", "18765"))
    server = ThreadingHTTPServer((os.environ.get("FY_BIND", "127.0.0.1"), port), FangyingV4Handler)
    print(f"《补完计划》已启动：http://127.0.0.1:{port}/")
    server.serve_forever()
