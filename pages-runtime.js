window.bwPath = () => location.pathname.replace(/^\/buwan-plan(?=\/|$)/, "") || "/";
if (sessionStorage.bwRedirect) {history.replaceState(null, "", sessionStorage.bwRedirect);sessionStorage.removeItem("bwRedirect");}
const bwFetch=window.fetch.bind(window);
window.fetch=async (input, options) => {
 const url=typeof input==="string"?input:input.url;
 if (url.startsWith("/api/")) {
  if (url==="/api/bootstrap") return new Response(JSON.stringify({user:null,unreadCount:0,watchlist:[],savedLists:[],episodeProgress:{},recentDiscussions:[],personas:[],customLists:[]}),{headers:{"Content-Type":"application/json"}});
  if (/^\/api\/anime\/.*\/comments/.test(url) && (!options || !options.method || options.method==="GET")) return new Response('{"comments":[]}',{headers:{"Content-Type":"application/json"}});
  return new Response(JSON.stringify({error:"在线账号和评论服务暂未开放"}),{status:503,headers:{"Content-Type":"application/json"}});
 }
 return bwFetch(input,options);
};
document.addEventListener("DOMContentLoaded",()=>{
 for(const id of ["navAuthBtn","personaSelect","navMine","navCommunity"]) {
  const el=document.getElementById(id);if(!el)continue;
  el.addEventListener("click", e=>{e.preventDefault();e.stopImmediatePropagation();alert("线上账号与社区服务正在准备中，您可以先浏览片库、片单和影评。");},true);
 }
 document.addEventListener("submit",e=>{if(e.target.id==="commentPostForm"){e.preventDefault();e.stopImmediatePropagation();alert("线上评论服务正在准备中。");}},true);
});
