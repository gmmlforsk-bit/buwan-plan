# 补完计划 · 可运行的现站

Mac 上可以双击「打开补完计划.command」。也可以在本目录运行 `python3 server.py 18765` 并访问 http://127.0.0.1:18765/ 。Windows 上可以用 `py -3 server.py 18765`。需要 Python 3.10 或更新版本，使用标准库，无需安装项目依赖。请通过这个本机网址打开页面，搜索和社区页面需要站点提供资源与接口。

| 文件 | 用途 |
|---|---|
| index.html、style.css、magazine.css | 页面结构及两份样式。magazine.css 后加载，用于全站深绿界面。 |
| app.js、search-worker.js | 路由、搜索、分页、25 部首页轮播与总览、120 期片单（6 条编排线与 3 种排版模式）、90 分钟决策区、单集聚焦、紧凑索引与互动。 |
| catalog/index.js、catalog/facts.js、catalog/mapping.js、catalog-bridge.js | 31,265 条作品索引、元数据及与编辑内容的映射。anime.sqlite 供独立查询作品，页面直接读取 JavaScript 数据。 |
| curated_lists.js、episodes_and_reviews.js | 120 期主题片单（覆盖按时间、观看对象、审美、主创、讨论问题、补完路线）、旗舰作品导读及分集材料。 |
| cover-library.js、covers.js、image-sizes.js、assets、visual_engine.js | 图片映射与尺寸、图片目录、编辑封面和资料图表。 |
| screening-room.js | 放映游戏室（/play）。每局五题，可从答案打开作品，返回后继续。 |
| server.py | 本机服务。首次启动时在本机生成社区数据库 fangying_v4.db，内含 12 位演示成员。 |
    
建议用首页、`/find`、`/lists`、`/anime/ping-pong?from=home`、`/community`、`/mine` 检查前端改动。运行中的页面以数据库与源码里的真实状态为准。

首页轮播默认 3.8 秒。全部 25 部使用本地图片，其他作品通过本站 /artwork/ 路径按编号读取封面，手机、平板和桌面均保留原图比例。新增图片的原始链接保存在 cover-library.js 和 image-sizes.js。

## 作品图

`artwork.py` 通过 `catalog/posters.json` 优先读取收录的作品图源，按编号查询 Bangumi 的图片接口作补充。原图成功读取后会保存在本机用户的 `.cache/buwan-plan/posters` 目录，下次浏览可直接复用。可通过环境变量 `FY_ART_CACHE` 指定缓存目录。未能取得真实图片的条目显示明确署名的编辑绘制封面。

首页、旧链接 /read 和双击入口统一打开完整展映站。展映首屏先显示，再接入完整片库和社交互动。需要纯文字检索时，可从页脚打开 /browse。

作品页新增 69 篇编辑短评，覆盖 32 部作品，其中《孤独摇滚！》含 5 篇分集短评。讨论页可按作品找短评、按集筛选讨论，并可从作品的全部讨论查看 Bangumi 评分快照和观众留言来源。首页 25 部选映为长短片名预留位置，换片时剧照短暂叠化。切页、筛选、详情标签和弹窗使用局部淡入，并响应系统的减少动态设置。
