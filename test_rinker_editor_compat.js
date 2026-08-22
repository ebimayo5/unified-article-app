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
const previewTabs = [];
const iframeParentMessages = [];
const iframeDocument = {
  addEventListener(type, handler) { if (type === 'click') clickHandler = handler; },
  querySelector() { return null; }
};
const iframeWindow = {
  location: { origin: 'https://example.com', pathname: '/wp-admin/post.php', search: '' },
  // WordPress 7.1 also defines tb_show in the editor iframe. The compatibility
  // layer must still intercept the click and use the parent editor's Thickbox.
  tb_show() { throw new Error('local iframe Thickbox must not be used'); },
  open(url, target, features) { previewTabs.push({ url, target, features }); },
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
  closest(selector) {
    if (selector === '[data-block]') return block;
    if (selector === 'button.thickbox.add_media') return this;
    return null;
  }
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

// Affiliate links in the rendered Rinker preview must not navigate the
// WordPress 7.1 editor iframe away from the post.
let previewNavigationPrevented = false;
const previewLink = {
  href: 'https://example.com/product',
  closest(selector) {
    return selector.includes('rinkerg/gutenberg-rinker') ? this : null;
  }
};
clickHandler({
  target: previewLink,
  preventDefault() { previewNavigationPrevented = true; },
  stopPropagation() {},
  stopImmediatePropagation() {}
});
assert(previewNavigationPrevented, 'Rinker preview link navigation was not prevented in the editor');
assert(previewTabs.length === 1, 'Rinker preview link did not open a separate tab');
assert(previewTabs[0].target === '_blank', 'Rinker preview link did not target a new tab');

// The top editor must accept only the expected client ID and update Rinker attributes.
let messageHandler;
const updates = [];
let editorThickboxClosed = 0;
const editorWindow = {
  location: { origin: 'https://example.com', pathname: '/wp-admin/post.php', search: '' },
  tb_show() {},
  tb_remove() { editorThickboxClosed += 1; },
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
assert(editorThickboxClosed === 1, 'Thickbox was not closed after insertion');

// The media popup must relay Rinker's successful AJAX response to the editor.
let mediaClickHandler;
let capturedAjaxSettings;
let legacySuccessCalled = 0;
const mediaMessages = [];
function mediaJQuery() {
  return {};
}
mediaJQuery.ajax = function (settings) {
  capturedAjaxSettings = settings;
  return {};
};
const mediaWindow = {
  location: {
    origin: 'https://example.com',
    pathname: '/wp-admin/media-upload.php',
    search: '?cid=client-3'
  },
  tb_show() {},
  addEventListener() {},
  parent: { postMessage(message, origin) { mediaMessages.push({ message, origin }); } },
  setTimeout(handler) { handler(); },
  jQuery: mediaJQuery,
  ArticleCompassRinkerCompat: { origin: 'https://example.com' }
};
run({
  window: mediaWindow,
  document: {
    addEventListener(type, handler) { if (type === 'click') mediaClickHandler = handler; },
    querySelector() { return null; }
  }
});
mediaWindow.jQuery.ajax({
  data: { action: 'yyi_rinker_add_item' },
  success() { legacySuccessCalled += 1; }
});
capturedAjaxSettings.success('654');
assert(mediaMessages.length === 1, 'media popup did not relay the created item');
assert(mediaMessages[0].message.shortcode === '[itemlink post_id="654"]', 'relayed shortcode is incorrect');
assert(legacySuccessCalled === 0, 'legacy cross-frame success callback should be skipped after relay');

// Registered items use a separate classic-DOM route and must also be relayed.
const registeredButton = {
  getAttribute(name) { return name === 'data-item-post-id' ? '777' : ''; },
  closest(selector) { return selector.includes('add-items-from-list') ? this : null; }
};
mediaClickHandler({
  target: registeredButton,
  preventDefault() {},
  stopPropagation() {},
  stopImmediatePropagation() {}
});
assert(mediaMessages.length === 2, 'registered item was not relayed');
assert(mediaMessages[1].message.shortcode === '[itemlink post_id="777"]', 'registered item shortcode is incorrect');

console.log('OK (5 Rinker iframe compatibility checks)');
