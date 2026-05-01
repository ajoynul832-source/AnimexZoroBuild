'use client';
// Ported from Zoro: _php/disqus.php
import { useEffect } from 'react';

export default function DisqusComments({ pageId, pageUrl, pageTitle }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clean up any existing Disqus instance
    if (window.DISQUS) {
      window.DISQUS.reset({
        reload: true,
        config: function () {
          this.page.identifier = pageId;
          this.page.url = pageUrl || window.location.href;
          this.page.title = pageTitle || document.title;
        }
      });
      return;
    }

    window.disqus_config = function () {
      this.page.identifier = pageId;
      this.page.url = pageUrl || window.location.href;
      this.page.title = pageTitle || document.title;
    };

    const script = document.createElement('script');
    // Replace YOUR_DISQUS_SHORTNAME with your actual Disqus shortname in .env
    const shortname = process.env.NEXT_PUBLIC_DISQUS_SHORTNAME || 'animex';
    script.src = `https://${shortname}.disqus.com/embed.js`;
    script.setAttribute('data-timestamp', +new Date());
    script.async = true;
    (document.head || document.body).appendChild(script);

    return () => {
      // Cleanup on unmount
      const el = document.getElementById('disqus_thread');
      if (el) el.innerHTML = '';
    };
  }, [pageId, pageUrl, pageTitle]);

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 24,
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>
          Comments
        </h3>
      </div>
      <div id="disqus_thread" />
      <noscript>
        Please enable JavaScript to view comments.
      </noscript>
    </div>
  );
}
