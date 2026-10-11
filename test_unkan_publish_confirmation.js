const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const repo=process.argv[2]||__dirname;
const html=fs.readFileSync(path.join(repo,'unified_article_app/ua_web_app.html'),'utf8');
const start=html.indexOf('function confirmUnkanPublishedUpdate(');
const end=html.indexOf('function runPrePublishCheck(',start);
let dialog, writes=0, standardConfirms=0;
let data={appType:'運行管理者試験対策',wpPostId:'69',status:'記事生成済み'};
const runner={withSuccessHandler(){return this;},withFailureHandler(){return this;},uaUpdatePublishedWpFromWeb(){writes++;}};
const c={document:{
  createElement(tag){return {tag,children:[],setAttribute(){},appendChild(el){this.children.push(el);},showModal(){this.open=true;},close(){this.open=false;if(this.onclose)this.onclose();},remove(){this.removed=true;},focus(){}};},
  body:{appendChild(el){dialog=el;}}
},readForm:()=>data,window:{confirm(){standardConfirms++;return false;}},
google:{script:{run:runner}},setNotice(){},setBusy(){},clearBusy(){},fillForm(){},setProgress(){},fail(){}};
vm.createContext(c);vm.runInContext(html.slice(start,end),c);
c.updatePublishedWp({});
assert.equal(writes,0);assert.equal(standardConfirms,0);assert.equal(dialog.open,true);
dialog.children[1].onclick();assert.equal(writes,0);assert.equal(dialog.removed,true);
c.updatePublishedWp({});dialog.children[2].onclick();assert.equal(writes,1);
data={...data,appType:'DRIVE BASE'};c.updatePublishedWp({});assert.equal(standardConfirms,1);assert.equal(writes,1);
console.log('Unkan in-page confirmation requires approval, supports cancel, preserves other sites: PASS');
