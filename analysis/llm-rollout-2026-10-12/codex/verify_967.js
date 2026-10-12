const fs=require('fs');
const path=require('path');
(async()=>{
 const r=await fetch('https://ebimayo5.com/wp-json/wp/v2/posts/967?_fields=id,link,status,modified_gmt,title,content');
 if(!r.ok)throw Error(r.status);
 const p=await r.json(),raw=fs.readFileSync(path.resolve(__dirname,'../snapshots/drive/backups/967_before.raw.html'),'utf8');
 const imgs=[...raw.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 const checks={id:p.id,status:p.status,url:p.link,modified_gmt:p.modified_gmt,all8Images:imgs.length===8&&imgs.every(x=>p.content.rendered.includes(x)),answerLead:p.content.rendered.includes('搭載ナビへの適合'),comparison:p.content.rendered.includes('比較する軸'),source:p.content.rendered.includes('https://naviokun.ocnk.net/product/236'),oldGreyRemoved:!p.content.rendered.includes('法律上グレー')};
 if(Object.values(checks).some(x=>x===false))throw Error(JSON.stringify(checks));
 fs.writeFileSync(path.resolve(__dirname,'../snapshots/drive/967_after.public.json'),JSON.stringify(p,null,2));
 const result={...checks,verified_at:new Date().toISOString()};
 fs.writeFileSync(path.join(__dirname,'967_public_verification.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exit(1)});
