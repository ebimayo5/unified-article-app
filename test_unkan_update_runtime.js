const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=__dirname;
const source=fs.readFileSync(root+'/unified_article_app/wordpress.gs','utf8');
function scenario(options={}) {
  const calls=[], writes=[];
  const row={appType:'運行管理者試験対策',body:'<p>確認済みの本文</p>',titleIdeas:'確認済みタイトル',wpPostId:123,permalink:'study',tags:'変更候補',metaDescription:'確認済み説明文'};
  const original={id:123,status:'publish',slug:'study',title:{raw:'元タイトル'},content:{raw:'<p>元本文</p>'},categories:[4],tags:[7],featured_media:91};
  let current=structuredClone(original),remembered=false;
  const sheet={getRange:(r,c)=>({setValue:v=>writes.push({r,c,v})})};
  const c={console,UA_COLUMNS:{wpDraftedAt:24},uaBuildRowData_:()=>({...row}),uaGetAppConfigByLabel_:()=>({key:'unkan',useWordPress:true}),
    uaGetWpConfig_:()=>({siteUrl:'https://unkan-genba.com'}),uaFetchWpPostForEdit_:()=>structuredClone(current),
    uaAssertUnkanPublishedUpdate_:()=>{calls.push('review');if(options.rejectReview)throw Error('review missing');},
    uaExtractProductPlan_:()=>null,uaIsUnkan_:()=>true,uaStripProductPlanMarker_:s=>s,
    uaGetWpPostRawContent_:p=>p.content.raw,uaFindMissingPublishedWpImages_:()=>options.missingImage?['missing.png']:[],
    uaPickWpTitle_:s=>s,uaCleanWpSlug_:s=>s,uaResolveWpCategoryIds_:()=>[],
    uaEnsureWpTagIds_:()=>{throw Error('Must preserve tags');},
    uaCallWordPressApi_:(config,path,method,payload)=>{
      calls.push({path,method,payload});
      if(path.includes('/posts/')) {current={...current,title:{raw:payload.title},content:{raw:payload.content}};return structuredClone(current);}
      if(options.seoFailure)throw Error('SEO failure');
      return options.manualSEO?{ok:true,updated:false,preserved:true,reason:'manual_value_preserved'}:{ok:true,updated:true};
    },uaUnkanRememberUpdatedPost_:()=>{remembered=true;}};
  const stubs={...c};
  vm.createContext(c);vm.runInContext(source,c);Object.assign(c,stubs);
  let error;
  try{c.uaUpdatePublishedWpFromPanelCore_(sheet,2);}catch(e){error=e;}
  return {calls,writes,current,original,remembered,error};
}
const normal=scenario();assert.ifError(normal.error);
const mutation=normal.calls.find(x=>typeof x==='object'&&x.path.includes('/posts/'));
assert.equal(normal.calls[0],'review');
assert.equal(mutation.payload.content,'<p>確認済みの本文</p>');
assert.equal(mutation.payload.slug,'study');
assert.equal(mutation.payload.status,undefined);
assert.equal(mutation.payload.tags,undefined);assert.equal(mutation.payload.categories,undefined);assert.equal(mutation.payload.featured_media,undefined);
assert.deepEqual(normal.current.tags,normal.original.tags);assert.deepEqual(normal.current.categories,normal.original.categories);assert.equal(normal.current.featured_media,91);
assert(normal.remembered);
for(const options of [{rejectReview:true},{missingImage:true}]){
 const r=scenario(options);assert(r.error);assert.equal(r.calls.filter(x=>typeof x==='object').length,0);assert(!r.remembered);
}
const manual=scenario({manualSEO:true});assert.ifError(manual.error);assert(manual.remembered);
const failure=scenario({seoFailure:true});assert(failure.error);assert(!failure.remembered);assert.equal(failure.writes.length,0);
console.log('PASS: reviewed body sent unchanged; URL/tags/categories/image preserved; unreviewed or missing-image update blocked; manual SEO retained; SEO failure not reported as success.');
