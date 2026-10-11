const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const c={Utilities:{base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),computeDigest:(a,s)=>crypto.createHash('sha256').update(s).digest(),DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1}}};
vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/unified_article_app/unkan_arcon.gs','utf8'),c);
const d={body:'<p>本文41.1％</p>',titleIdeas:'タイトル',metaDescription:'説明',tags:'貨物',permalink:'slug'};
for(const metadata of ['<!-- UA_PRODUCT_PLAN:%7B%7D -->\n','<p><!-- UA_PRODUCT_PLAN:%7B%7D --></p>\n']) {
 assert.equal(c.uaUnkanReviewHash_({...d,body:metadata+d.body}),c.uaUnkanReviewHash_(d));
}
for(const key of Object.keys(d)) assert.notEqual(c.uaUnkanReviewHash_({...d,[key]:d[key]+'変更'}),c.uaUnkanReviewHash_(d));
assert.notEqual(c.uaUnkanReviewHash_({...d,body:'<!-- other -->'+d.body}),c.uaUnkanReviewHash_(d));
console.log('Unkan review ignores only hidden product metadata and detects every reviewed-field change: PASS');
