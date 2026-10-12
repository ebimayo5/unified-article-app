// Local, read-only preview of a single public article draft. No credentials or backups served.
const fs=require('fs'),path=require('path'),http=require('http');
const id=process.argv[2];if(!/^\d+$/.test(id))throw Error('numeric ID required');
const raw=fs.readFileSync(path.resolve(__dirname,'../snapshots/drive/drafts/'+id+'_proposed.raw.html'),'utf8');
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
http.createServer((req,res)=>{
 if(req.url!=='/'+id){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
 res.end('<!doctype html><html lang="ja"><title>記事'+id+'の公開用改稿案</title><h1>記事'+id+'の公開用改稿案</h1><p>画像・商品リンクを保持した本文HTML。読み取り専用のローカルプレビュー。</p><textarea id="draft" readonly style="width:98%;height:80vh">'+escape(raw)+'</textarea></html>');
}).listen(8766,'127.0.0.1',()=>console.log('Draft preview: http://127.0.0.1:8766/'+id));
