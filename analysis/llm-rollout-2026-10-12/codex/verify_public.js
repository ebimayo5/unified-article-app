// Public GET only. Verifies a completed UI publication against its saved patch.
const fs=require('fs'),path=require('path');
const id=Number(process.argv[2]);if(!Number.isInteger(id)||id<=0)throw Error('post ID required');
const base=path.resolve(__dirname,'../snapshots/drive');
(async()=>{
 const patch=JSON.parse(fs.readFileSync(path.join(__dirname,id+'_rewrite_patch.json'),'utf8'));
 const r=await fetch('https://ebimayo5.com/wp-json/wp/v2/posts/'+id+'?_fields=id,link,status,modified_gmt,title,content');if(!r.ok)throw Error(r.status);
 const p=await r.json(),raw=fs.readFileSync(path.join(base,'backups/'+id+'_before.raw.html'),'utf8');
 const imgs=[...raw.matchAll(/<img\b[^>]*src=(['"])(.*?)\1/g)].map(m=>m[2]);
 const strip=s=>s.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,'').replace(/\s+/g,'');
 const visible=strip(p.content.rendered);
 const checks={id:p.id,status:p.status,url:p.link,title:p.title.rendered,modified_gmt:p.modified_gmt,images:imgs.length,allImages:imgs.every(s=>p.content.rendered.includes(s)),patches:patch.changes.length,allChangedText:patch.changes.every(c=>visible.includes(strip(c.after))),verified_at:new Date().toISOString()};
 if(checks.status!=='publish'||!checks.allImages||!checks.allChangedText)throw Error(JSON.stringify(checks));
 fs.writeFileSync(path.join(base,id+'_after.public.json'),JSON.stringify(p,null,2));
 fs.writeFileSync(path.join(__dirname,id+'_public_verification.json'),JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify(checks));
})().catch(e=>{console.error(e.message);process.exit(1)});
