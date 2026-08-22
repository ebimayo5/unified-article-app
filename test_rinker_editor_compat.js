const fs = require('fs');
const vm = require('vm');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, 'wordpress_plugins/article-compass-rinker-bridge/assets/rinker-editor-compat.js'),
  'utf8'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(context) {
  context.URLSearchParams = URLSearchParams;
  context.Event = class Event {
    constructor(type, options) { this.type = type; this.bubbles = !!(options && options.bubbles); }
  };
  vm.runInNewContext(source, context);
}

// The iframe button must open Thickbox through the parent editor window.
let clickHandler;
const opened = [];
const iframeParentMessages = [];
const iframeDocument = {
  addEventListener(type, handler) { if (type === 'click') clickHandler = handler; },
  querySelector() { return null; }
};
const iframeWindow = {
  location: { origin: 'https://example.com', pathname: '/wp-admin/post.php', search: '' },
  parent: {
    tb_show(title, url) { opened.push({ title, url }); },
    postMessage(message, origin) { iframeParentMessages.push({ message, origin }); }
  },
  addEventListener() {},
  jQuery: null,
  ArticleCompassRinkerCompat: {
    mediaUploadUrl: 'https://example.com/wp-admin/media-upload.php',
    origin: 'https://example.com'
  }
};
run({ window: iframeWindow, document: iframeDocument });
const block = { getAttribute(name) { return name === 'data-block' ? 'client-1' : ''; } };
const button = {
  textContent: '商品リンク追加',
  closest(selector) { return selector === '[data-block]' ? block : this; }
};
let prevented = false;
clickHandler({
  target: button,
  preventDefault() { prevented = true; },
  stopPropagation() {},
  stopImmediatePropagation() {}
});
assert(prevented, 'iframe button was not intercepted');
assert(opened.length === 1 && /cid=client-1/.test(opened[0].url), 'parent Thickbox was not opened');
assert(iframeParentMessages[0].message.type === 'article-compass-rinker-open', 'open message was not sent');

// The top editor must accept only the expected client ID and update Rinker attributes.
let messageHandler;
const updates = [];
const editorWindow = {
  location: { origin: 'https://example.com', pathname: '/wp-admin/post.php', search: '' },
  tb_show() {},
  addEventListener(type, handler) { if (type === 'message') messageHandler = handler; },
  wp: {
    data: {
      select() { return { getBlock(id) { return id === 'client-2' ? {} : null; } }; },
      dispatch() { return { updateBlockAttributes(id, attrs) { updates.push({ id, attrs }); } }; }
    }
  },
  jQuery: null,
  ArticleCompassRinkerCompat: { origin: 'https://example.com' }
};
run({ window: editorWindow, document: { addEventListener() {}, querySelector() { return null; } } });
messageHandler({ origin: 'https://example.com', data: { type: 'article-compass-rinker-open', clientId: 'client-2' } });
messageHandler({
  origin: 'https://example.com',
  data: {
    type: 'article-compass-rinker-insert',
    clientId: 'client-2',
    postId: '321',
    shortcode: '[itemlink post_id="321"]'
  }
});
assert(updates.length === 1, 'shortcode was not delivered to the block editor');
assert(updates[0].attrs.post_id === '321', 'Rinker post ID was not updated');

// The media popup must relay Rinker's successful AJAX response to the editor.
let ajaxSuccessHandler;
const mediaMessages = [];
function mediaJQuery() {
  return { ajaxSuccess(handler) { ajaxSuccessHandler = handler; } };
}
const mediaWindow = {
  location: {
    origin: 'https://example.com',
    pathname: '/wp-admin/media-upload.php',
    search: '?cid=client-3'
  },
  tb_show() {},
  addEventListener() {},
  parent: { postMessage(message, origin) { mediaMessages.push({ message, origin }); } },
  jQuery: mediaJQuery,
  ArticleCompassRinkerCompat: { origin: 'https://example.com' }
};
run({ window: mediaWindow, document: { addEventListener() {}, querySelector() { return null; } } });
ajaxSuccessHandler(null, { responseText: '654' }, { data: { action: 'yyi_rinker_add_item' } });
assert(mediaMessages.length === 1, 'media popup did not relay the created item');
assert(mediaMessages[0].message.shortcode === '[itemlink post_id="654"]', 'relayed shortcode is incorrect');

console.log('OK (3 Rinker iframe compatibility checks)');
