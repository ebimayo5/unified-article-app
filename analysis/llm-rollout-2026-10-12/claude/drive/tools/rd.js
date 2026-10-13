// usage: node rd.js <id>  -> saves backup/<id>_before.json, prints plain text + links
const fs=require('fs');const id=process.argv[2];
(async()=>{
const j=await (await fetch(`https://ebimayo5.com/wp-json/wp/v2/posts/${id}?_fields=id,modified,content,link,title,status`,{headers:{'User-Agent':'Mozilla/5.0'}})).json();
const f=`${__dirname}/../backup/${id}_before.json`;
if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify(j));
const c=j.content.rendered;
let t=c.replace(/<(script|style)[\s\S]*?<\/\1>/g,'').replace(/<\/(p|h2|h3|li|div|tr|figcaption)>/g,'\n').replace(/<[^>]+>/g,'').replace(/&#8230;/g,'…').replace(/&amp;/g,'&').replace(/&#038;/g,'&');
console.log('['+id+'] '+j.title.rendered+' | '+j.status+' | modified '+j.modified+' | chars '+c.length);
console.log(t.replace(/\t+/g,'').replace(/\n\s*\n+/g,'\n'));
console.log('LINKS:');console.log([...c.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replace(/&#038;/g,'&')).filter(u=>!/ebimayo5\.com\/archives/.test(u)||true).join('\n'));
console.log('IMGS',(c.match(/<img/g)||[]).length);
})();
