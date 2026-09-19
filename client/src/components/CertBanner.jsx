import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';

/**
 * Offers the root CA when this device has not got it.
 *
 * An untrusted certificate is not only the red cross in the address bar: Chrome
 * disables service workers and is warier about other features, which is why it
 * is worth prompting rather than leaving people to click through the warning
 * forever.
 *
 * The signal is that service worker registration failed (see index.html) —
 * Chrome refuses it outright on a page with a certificate error.
 */
export default function CertBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (location.protocol !== 'https:') return;      // nothing to offer over http
    try {
      if (localStorage.getItem('muxterm-cert-dismissed') === '1') return;
    } catch (e) {}

    // Registration resolves after load, so look a little after mounting.
    let tries = 0;
    const t = setInterval(() => {
      const state = window.__muxtermCert;
      if (state === 'untrusted') { setShow(true); clearInterval(t); }
      else if (state === 'trusted' || ++tries > 12) clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem('muxterm-cert-dismissed', '1'); } catch (e) {}
    setShow(false);
  };

  return (
    <Box sx={{
      flexShrink: 0, px: 1.5, py: 1, backgroundColor: 'rgba(255,167,38,0.12)',
      borderBottom: '1px solid #4a3c00', display: 'flex', alignItems: 'center',
      gap: 1, flexWrap: 'wrap'
    }}>
      <Box sx={{ color: '#ffa726', fontSize: '12px', flex: 1, minWidth: 180 }}>
        Este dispositivo no confía en el certificado de muxterm. Instalarlo quita el aviso
        del navegador y habilita funciones que Chrome bloquea sin él.
      </Box>
      <Button
        size="small" variant="outlined"
        href="/ca.crt"
        sx={{ fontSize: '11px', textTransform: 'none', color: '#ffa726', borderColor: '#ffa726' }}
      >
        Descargar certificado
      </Button>
      <Button size="small" onClick={dismiss} sx={{ fontSize: '11px', textTransform: 'none', color: '#888' }}>
        No mostrar más
      </Button>
    </Box>
  );
}
