/* global gtag */
(function () {
  'use strict';

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  function getCtaType(link) {
    if (link.closest('.yyi-rinker-box, .yyi-rinker-contents')) {
      return 'rinker_product';
    }

    if (link.closest(
      '.article-compass-affiliate-cta, .swell-block-button, .wp-block-button, .btn-wrap, .wp-block-cocoon-blocks-button-wrap-1'
    )) {
      return 'affiliate_cta';
    }

    return '';
  }

  function trackAffiliateCtaClick(event) {
    if (event.defaultPrevented || (typeof event.button === 'number' && event.button !== 0)) {
      return;
    }

    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) {
      return;
    }

    var ctaType = getCtaType(link);
    if (!ctaType) {
      return;
    }

    var destination;
    try {
      destination = new URL(link.href, window.location.href);
    } catch (error) {
      return;
    }

    if (destination.origin === window.location.origin || !/^https?:$/.test(destination.protocol)) {
      return;
    }

    if (typeof window.gtag !== 'function') {
      return;
    }

    window.gtag('event', 'affiliate_cta_click', {
      cta_type: ctaType,
      cta_text: cleanText(link.textContent || link.getAttribute('aria-label')),
      destination_domain: destination.hostname,
      article_path: window.location.pathname,
      link_classes: ctaType,
      link_domain: destination.hostname,
      link_url: destination.href,
      outbound: true
    });
  }

  document.addEventListener('click', trackAffiliateCtaClick, true);
}());
