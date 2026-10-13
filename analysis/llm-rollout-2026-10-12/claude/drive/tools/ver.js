// usage: node ver.js <id> [must-include phrase...] ; prefix "!" = must be absent. writes <id>_public_verification.json
const fs=require('fs');const [id,...ph]=process.argv.slice(2);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
let j;for(let i=0;i<20;i++){j=await (await fetch(`https://ebimayo5.com/wp-json/wp/v2/posts/${id}?_fields=modified,status,link,content`,{headers:{'User-Agent':'Mozilla/5.0'}})).json();if(/^2026-10-1[3-9]T/.test(j.modified))break;await sleep(4000);}
const c=j.content.rendered;
const h=await (await fetch(j.link+'?v='+Date.now(),{headers:{'User-Agent':'Mozilla/5.0'}})).text();
const body=h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
const strip=c.replace(/<[^>]+>/g,'').replace(/\s+/g,' ');
const checks=ph.map(p=>{const neg=p[0]==='!';const q=neg?p.slice(1):p;const ok=(strip.includes(q)||c.includes(q))!==neg&&(body.includes(q)!==neg);return {phrase:p,ok}});
const bf=JSON.parse(fs.readFileSync(`${__dirname}/../backup/${id}_before.json`,'utf8')).content.rendered;
const r={post_id:+id,url:j.link,status:j.status,modified:j.modified,imgs_before:(bf.match(/<img/g)||[]).length,imgs_after:(c.match(/<img/g)||[]).length,hrefs_before:(bf.match(/href="[^"]+"/g)||[]).length,hrefs_after:(c.match(/href="[^"]+"/g)||[]).length,shortcode_unrendered:/\[itemlink/.test(h),checks};
fs.writeFileSync(`${__dirname}/../${id}_public_verification.json`,JSON.stringify(r,null,1));
console.log(JSON.stringify(r));
})();
