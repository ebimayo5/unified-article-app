(function (window, document, $) {
    'use strict';

    var config = window.ArticleCompassRinkerCompat || {};
    var openMessageType = 'article-compass-rinker-open';
    var insertMessageType = 'article-compass-rinker-insert';
    var expectedClientId = '';

    function expectedOrigin() {
        return config.origin || window.location.origin;
    }

    function clientIdFromButton(button) {
        var block = button && button.closest ? button.closest('[data-block]') : null;
        if (block && block.getAttribute('data-block')) {
            return block.getAttribute('data-block');
        }
        try {
            return window.wp && window.wp.data
                ? window.wp.data.select('core/block-editor').getSelectedBlockClientId()
                : '';
        } catch (error) {
            return '';
        }
    }

    function mediaUploadUrl(clientId) {
        var base = config.mediaUploadUrl || '/wp-admin/media-upload.php';
        return base + '?type=yyi_rinker&tab=yyi_rinker_search_amazon&cid=' +
            encodeURIComponent(clientId) + '&TB_iframe=true';
    }

    function bindIframeOpenCompatibility() {
        // WordPress 7.1 exposes Thickbox inside the editor canvas as well.
        // Rinker's local handler can therefore open the search popup, but its
        // classic DOM callback cannot reach the block editor living across the
        // iframe boundary. Always route editor-canvas clicks through the top
        // editor window, even when the iframe has its own tb_show function.
        if (!window.parent || window.parent === window) {
            return;
        }
        try {
            if (!window.parent || typeof window.parent.tb_show !== 'function') {
                return;
            }
        } catch (error) {
            return;
        }

        document.addEventListener('click', function (event) {
            // Rinker's rendered preview contains ordinary affiliate anchors.
            // In WordPress 7.1 the editor canvas is an iframe, so following
            // one replaces the editing canvas with the shop page. Keep links
            // active on the public site and open them in a separate tab when
            // clicked from the editor.
            var previewLink = event.target && event.target.closest
                ? event.target.closest('[data-type="rinkerg/gutenberg-rinker"] .yyi-rinker-contents a[href]')
                : null;
            if (previewLink) {
                event.preventDefault();
                try {
                    window.open(previewLink.href, '_blank', 'noopener,noreferrer');
                } catch (error) {
                    // Keep the editor canvas in place even if a browser blocks
                    // the new tab.
                }
                return;
            }

            var button = event.target && event.target.closest
                ? event.target.closest('button.thickbox.add_media')
                : null;
            if (!button || button.textContent.trim() !== '商品リンク追加') {
                return;
            }
            var clientId = clientIdFromButton(button);
            if (!clientId) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            window.parent.postMessage({
                type: openMessageType,
                clientId: clientId
            }, expectedOrigin());
            window.parent.tb_show('商品リンク追加', mediaUploadUrl(clientId));
        }, true);
    }

    function dispatchShortcode(clientId, postId, shortcode) {
        if (!clientId || !shortcode) {
            return false;
        }

        try {
            if (window.wp && window.wp.data) {
                var selector = window.wp.data.select('core/block-editor');
                var dispatcher = window.wp.data.dispatch('core/block-editor');
                if (selector && dispatcher && selector.getBlock(clientId)) {
                    dispatcher.updateBlockAttributes(clientId, {
                        content: shortcode,
                        content_text: shortcode,
                        post_id: String(postId || '')
                    });
                    return true;
                }
            }
        } catch (error) {
            // Fall through to the controlled-input compatibility path.
        }

        try {
            var canvas = document.querySelector('iframe[name="editor-canvas"]');
            var canvasDocument = canvas && canvas.contentDocument;
            var block = canvasDocument && canvasDocument.querySelector('[data-block="' + clientId + '"]');
            var input = block && block.querySelector('.rinkerg-richtext');
            if (input) {
                var valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                valueSetter.call(input, shortcode);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.focus();
                return true;
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    function bindEditorReceiver() {
        window.addEventListener('message', function (event) {
            if (event.origin !== expectedOrigin()) {
                return;
            }
            var data = event.data || {};
            if (data.type === openMessageType) {
                expectedClientId = String(data.clientId || '');
                return;
            }
            if (data.type !== insertMessageType || !data.clientId) {
                return;
            }
            // The open notification can be lost when the editor canvas is a
            // blob iframe. A same-origin message is still safe to accept when
            // it targets a real block in the current editor; dispatchShortcode
            // performs that existence check. Keep the expected ID check when
            // the notification was received.
            if (expectedClientId && data.clientId !== expectedClientId) {
                return;
            }
            if (dispatchShortcode(data.clientId, data.postId, data.shortcode)) {
                expectedClientId = '';
                // Close the top-level Thickbox after the block has actually
                // accepted the shortcode. Closing from the media iframe is
                // unreliable in WordPress 7.1's nested iframe editor.
                if (typeof window.tb_remove === 'function') {
                    window.tb_remove();
                }
            }
        });
    }

    function isRinkerAddRequest(settings) {
        var data = settings && settings.data;
        if (typeof data === 'string') {
            return /(?:^|&)action=yyi_rinker_add_item(?:&|$)/.test(data);
        }
        return !!(data && data.action === 'yyi_rinker_add_item');
    }

    function extractPostId(response) {
        if (typeof response === 'number' && isFinite(response)) {
            return String(Math.floor(response));
        }
        if (typeof response === 'string') {
            var trimmed = response.trim();
            if (/^\d+$/.test(trimmed)) {
                return trimmed;
            }
            try {
                return extractPostId(JSON.parse(trimmed));
            } catch (error) {
                return '';
            }
        }
        if (response && typeof response === 'object') {
            var candidates = [
                response.post_id,
                response.postId,
                response.id,
                response.data
            ];
            for (var i = 0; i < candidates.length; i += 1) {
                var found = extractPostId(candidates[i]);
                if (found) {
                    return found;
                }
            }
        }
        return '';
    }

    function bindMediaUploadRelay() {
        if (!$ || !/media-upload\.php$/i.test(window.location.pathname)) {
            return;
        }
        var params = new URLSearchParams(window.location.search);
        var clientId = params.get('cid') || '';
        if (!clientId) {
            return;
        }

        function relay(postId) {
            postId = String(postId || '').trim();
            if (!/^\d+$/.test(postId)) {
                return false;
            }
            var message = {
                type: insertMessageType,
                clientId: clientId,
                postId: postId,
                shortcode: '[itemlink post_id="' + postId + '"]'
            };
            try {
                window.parent.postMessage(message, expectedOrigin());
                return true;
            } catch (error) {
                return false;
            }
        }

        // Registered products bypass yyi_rinker_add_item and use Rinker's
        // classic same-document callback. Relay their existing post ID before
        // that callback runs so Gutenberg receives it across the iframe.
        document.addEventListener('click', function (event) {
            var button = event.target && event.target.closest
                ? event.target.closest('button.add-items-from-list[data-item-post-id]')
                : null;
            if (!button || !relay(button.getAttribute('data-item-post-id'))) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            window.setTimeout(function () {
                if (window.parent && typeof window.parent.tb_remove === 'function') {
                    window.parent.tb_remove();
                }
            }, 0);
        }, true);

        // Rinker's success callback runs before jQuery's global ajaxSuccess
        // event. On WordPress 7.1 that callback throws while trying to access
        // the block editor across iframe boundaries, so ajaxSuccess is never
        // reached. Wrap $.ajax and relay the created post ID before Rinker's
        // legacy callback can run. The classic editor is untouched because
        // this bridge is enabled only when a Gutenberg client ID is present.
        var originalAjax = $.ajax;
        if (typeof originalAjax === 'function') {
            $.ajax = function (url, options) {
                var settings = typeof url === 'object' ? url : options;
                if (settings && isRinkerAddRequest(settings)) {
                    var originalSuccess = settings.success;
                    settings.success = function (response) {
                        var postId = extractPostId(response);
                        if (postId && relay(postId)) {
                            return;
                        }
                        if (typeof originalSuccess === 'function') {
                            return originalSuccess.apply(this, arguments);
                        }
                    };
                }
                return originalAjax.apply(this, arguments);
            };
        }
    }

    bindIframeOpenCompatibility();
    bindEditorReceiver();
    bindMediaUploadRelay();
})(window, document, window.jQuery);
