import React, { useState, useRef } from 'react';

function WebViewer({ url: initialUrl, isActive }) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl || '');
  const [inputUrl, setInputUrl] = useState(initialUrl || '');
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef(null);

  const getProxiedUrl = (url) => {
    if (!url) return '';
    // Add protocol if missing
    let full = url;
    if (!full.match(/^https?:\/\//)) full = 'http://' + full;
    return `/browse/${full}`;
  };

  const navigate = (url) => {
    if (!url) return;
    setCurrentUrl(url);
    setInputUrl(url);
    setLoading(true);
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#111' }}>
      {/* Address bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
        backgroundColor: '#1a1a1a', borderBottom: '1px solid #333'
      }}>
        <button
          onClick={() => { if (iframeRef.current) iframeRef.current.contentWindow.history.back(); }}
          style={{ background: '#222', border: '1px solid #444', color: '#888', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}
          title="Back"
        >◀</button>
        <button
          onClick={() => { if (iframeRef.current) iframeRef.current.contentWindow.history.forward(); }}
          style={{ background: '#222', border: '1px solid #444', color: '#888', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}
          title="Forward"
        >▶</button>
        <button
          onClick={() => navigate(currentUrl)}
          style={{ background: '#222', border: '1px solid #444', color: '#888', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}
          title="Reload"
        >⟳</button>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter') navigate(inputUrl); }}
          placeholder="Enter URL..."
          style={{
            flex: 1, padding: '4px 8px', backgroundColor: '#222', border: '1px solid #444',
            borderRadius: '3px', color: '#ccc', fontSize: '12px', outline: 'none',
            fontFamily: 'monospace'
          }}
        />
        <button
          onClick={() => navigate(inputUrl)}
          style={{ background: '#00ff00', border: 'none', color: '#000', borderRadius: '3px', cursor: 'pointer', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' }}
        >GO</button>
      </div>
      {/* Content */}
      <div style={{ flex: 1, position: 'relative' }}>
        {currentUrl ? (
          <>
            {loading && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: '#00ff00', zIndex: 10, animation: 'loading 1s infinite' }}>
                <style>{`@keyframes loading { 0% { width: 0% } 50% { width: 70% } 100% { width: 100% } }`}</style>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={getProxiedUrl(currentUrl)}
              onLoad={() => setLoading(false)}
              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            />
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: '14px' }}>
            Enter a URL to browse
          </div>
        )}
      </div>
    </div>
  );
}

export default WebViewer;
