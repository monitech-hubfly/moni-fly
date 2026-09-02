'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  title: string;
};

/** Iframe same-origin: ajusta altura ao conteúdo para evitar scroll duplo. */
export function DocumentoInternoIframe({ src, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [heightPx, setHeightPx] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );

  const syncHeight = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.documentElement) return;
    const contentH = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0,
      doc.documentElement.offsetHeight,
    );
    setHeightPx(Math.max(contentH, window.innerHeight));
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let ro: ResizeObserver | null = null;

    const onLoad = () => {
      syncHeight();
      const doc = iframe.contentDocument;
      if (!doc?.documentElement) return;
      ro?.disconnect();
      ro = new ResizeObserver(() => syncHeight());
      ro.observe(doc.documentElement);
      if (doc.body) ro.observe(doc.body);
    };

    iframe.addEventListener('load', onLoad);
    if (iframe.contentDocument?.readyState === 'complete') onLoad();

    window.addEventListener('resize', syncHeight);
    return () => {
      iframe.removeEventListener('load', onLoad);
      ro?.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, [src, syncHeight]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      style={{
        width: '100%',
        border: 'none',
        display: 'block',
        minHeight: '100vh',
        height: `${heightPx}px`,
      }}
    />
  );
}
