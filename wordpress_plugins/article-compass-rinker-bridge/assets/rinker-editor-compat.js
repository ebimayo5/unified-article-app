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
        if (typeof window.tb_show === 'function') {
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
            if (data.type !== insertMessageType || !expectedClientId || data.clientId !== expectedClientId) {
                return;
            }
            if (dispatchShortcode(data.clientId, data.postId, data.shortcode)) {
                expectedClientId = '';
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

    function bindMediaUploadRelay() {
        if (!$ || !/media-upload\.php$/i.test(window.location.pathname)) {
            return;
        }
        var params = new URLSearchParams(window.location.search);
        var clientId = params.get('cid') || '';
        if (!clientId) {
            return;
        }

        $(document).ajaxSuccess(function (event, xhr, settings) {
            if (!isRinkerAddRequest(settings)) {
                return;
            }
            var response = String(xhr && xhr.responseText || '').trim();
            var match = response.match(/^\d+$/);
            if (!match) {
                return;
            }
            var postId = match[0];
            var message = {
                type: insertMessageType,
                clientId: clientId,
                postId: postId,
                shortcode: '[itemlink post_id="' + postId + '"]'
            };
            try {
                window.parent.postMessage(message, expectedOrigin());
            } catch (error) {
                // Rinker's own classic-editor callback remains available.
            }
        });
    }

    bindIframeOpenCompatibility();
    bindEditorReceiver();
    bindMediaUploadRelay();
})(window, document, window.jQuery);
