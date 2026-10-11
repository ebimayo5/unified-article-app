const assert=require('assert'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const base=require('path').join(__dirname,'unified_article_app') + require('path').sep;
let savedDigest='';
const context={console,Session:{getActiveUser:()=>({getEmail:()=>"owner@example.test"}),getEffectiveUser:()=>({getEmail:()=>"owner@example.test"})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,s)=>crypto.createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>({getLastRow:()=>2,getRange:(row,col)=>({getValues:()=>[[2]],getValue:()=>savedDigest})})})}};
vm.createContext(context);
for(const file of ['config.gs','unkan_arcon.gs','article.gs','wordpress.gs']) vm.runInContext(fs.readFileSync(base+file,'utf8'),context);
assert.throws(()=>context.uaUnkanWpConfig_(),/未設定/);
for(const url of ['http://laws.e-gov.go.jp/a','https://mhlw.go.jp.evil.test/a','https://user@mhlw.go.jp/a','https://mhlw.go.jp:443/a','https://example.com/']) assert.equal(context.uaUnkanSourceKind_(url),'',url);
assert.equal(context.uaUnkanSourceKind_('https://laws.e-gov.go.jp/law/example'),'law');
assert.equal(context.uaUnkanSourceKind_('https://www.mhlw.go.jp/content/example.pdf'),'law');
assert.equal(context.uaUnkanSourceKind_('https://www.npa.go.jp/bureau/traffic/example.pdf'),'physics');
const notes=context.uaUnkanPublicNotes_('公開用の講座説明\n成果報酬4545円\n■A8提携条件\n管理専用記録');
assert.equal(notes,'公開用の講座説明');
const data={row:2,appType:'運行管理者試験対策',body:'<p>休息期間は9時間。</p>',titleIdeas:'教材の選び方',permalink:'study',wpPostId:69};
savedDigest=context.uaUnkanReviewHash_(data);
context.uaAssertUnkanReview_(data);
assert.throws(()=>context.uaAssertUnkanReview_({...data,body:'<p>変更した本文</p>'}),/未完了/);
assert(context.uaUnkanContentIssues_({...data,body:'<p>成果報酬</p>'}).length);
assert(context.uaUnkanContentIssues_({...data,body:'<a href="https://example.com/?full=secret">リンク</a>'}).length);
assert(context.uaUnkanContentIssues_({...data,body:'<a href="https://px.a8.net/a">ユーキャン</a>'}).length);
context.uaUnkanOriginal_=()=>({currentHash:'stale'});
assert.throws(()=>context.uaAssertUnkanPublishedUpdate_(data,{slug:'study'}),/変更されています/);
context.uaUnkanOriginal_=()=>({currentHash:context.uaUnkanPostHash_({slug:'study'})});
context.uaAssertUnkanPublishedUpdate_(data,{slug:'study'});
assert.throws(()=>context.uaAssertUnkanPublishedUpdate_({...data,permalink:'changed'},{slug:'study'}),/未完了/);
context.uaUsesSwellBlocks_=()=>true; context.uaGetSwellButtonColor_=()=> 'blue';context.uaEscapeHtml_=s=>s;
const url='https://px.a8.net/svt/ejp?a8mat=EXAMPLE';
const cta=context.uaBuildManagedAffiliateCtaBlock_({type:'url',url,content:url},'講座を見る',{key:'unkan'});
assert(cta.includes('wp:loos/button'));assert(cta.includes('#0d3049'));assert(cta.includes('href="'+url+'"'));assert(cta.includes('nofollow sponsored noopener'));
assert.equal(context.uaApplyRakutenAffiliateBanner_('original',data,{key:'unkan'}),'original');
console.log('Unkan integration guards PASS');

context.Session.getActiveUser=()=>({getEmail:()=>''});
assert.throws(()=>context.uaAssertUnkanOperator_(),/匿名アクセス/);

// Import is idempotent, preserves original post metadata and never writes WordPress.
context.Session.getActiveUser=()=>({getEmail:()=>"owner@example.test"});
const rows={article:[[]],original:[[]]};
function mockSheet(kind) {
  return {getLastRow:()=>rows[kind].length,appendRow:value=>rows[kind].push(value),getRange:(row,col,height=1,width=1)=>({
    getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>(rows[kind][row+i-1]||[])[col+j-1]||'')),
    setValues:values=>values.forEach((value,i)=>{const target=rows[kind][row+i-1]||(rows[kind][row+i-1]=[]);value.forEach((cell,j)=>target[col+j-1]=cell);})
  })};
}
context.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:name=>mockSheet(name==='運管'?'article':'original')})};
context.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
context.uaSetupUnkanFromWeb=()=>({});
context.uaUnkanWpConfig_=()=>({siteUrl:'https://unkan-genba.com'});
context.uaBuildWpEditUrl_=(site,id)=>site+'/wp-admin/post.php?post='+id+'&action=edit';
context.uaUpsertInternalLinkCandidateForPost_=()=>{};
const importedPost={id:69,status:'publish',slug:'study',link:'https://unkan-genba.com/study/',title:{raw:'教材の選び方'},content:{raw:'<p>受験の準備</p>'},categories:[4],tags:[5],featured_media:42};
context.uaCallWordPressApi_=(config,route,method)=>{assert.equal(method,'get');assert(config.siteUrl==='https://unkan-genba.com');return [importedPost];};
assert.equal(context.uaImportUnkanPublishedFromWeb().imported,1);
const cols=vm.runInContext('UA_COLUMNS',context);
assert.equal(rows.article[1][cols.wpPostId-1],69);
assert.equal(rows.article[1][cols.permalink-1],'study');
assert.equal(rows.article[1][cols.body-1],importedPost.content.raw);
assert.equal(JSON.parse(rows.original[1][3]).featured_media,42);
rows.article[1][cols.body-1]='local edits';
assert.equal(context.uaImportUnkanPublishedFromWeb().imported,0);
assert.equal(rows.article[1][cols.body-1],'local edits');
assert.equal(rows.original.length,2);
console.log('Unkan import idempotency and metadata preservation PASS');

// SEO readiness is GET-only and rejects missing/wrong meta storage.
context.uaCallWordPressApi_=(config,route,method)=>{assert.equal(method,'get');assert.equal(route,'/wp-json/article-compass/v1/seo-status');return {ok:true,seo_meta_supported:true,seo_meta_key:'ssp_meta_description'};};
assert.equal(context.uaUnkanSeoStatus_().ok,true);
context.uaCallWordPressApi_=()=>({ok:true,seo_meta_supported:true,seo_meta_key:'wrong'});
assert.throws(()=>context.uaUnkanSeoStatus_(),/SEO連携/);
console.log('Unkan SEO read-only readiness PASS');