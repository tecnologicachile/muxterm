class ClientPersistenceTracer {
  constructor() {
    // En el cliente, leemos de window para permitir activación dinámica
    this.enabled = window.TRACE_PERSISTENCE === true || 
                  localStorage.getItem('TRACE_PERSISTENCE') === 'true';
    this.prefix = '[TRACE:CLIENT]';
  }

  enable() {
    this.enabled = true;
    localStorage.setItem('TRACE_PERSISTENCE', 'true');
    console.log(`${this.prefix} Persistence tracing enabled`);
  }

  disable() {
    this.enabled = false;
    localStorage.removeItem('TRACE_PERSISTENCE');
    console.log(`${this.prefix} Persistence tracing disabled`);
  }

  trace(category, action, data = {}) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const dataStr = Object.entries(data)
      .map(([k, v]) => `${k}:${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' | ');

    console.log(`${timestamp} ${this.prefix}[${category}] ${action}${dataStr ? ' - ' + dataStr : ''}`);
  }

  traceBuffer(action, buffer, metadata = {}) {
    if (!this.enabled) return;

    const preview = buffer ? {
      length: buffer.length,
      preview: buffer.substring(0, 100).replace(/\n/g, '\\n'),
      lastChars: buffer.substring(buffer.length - 50).replace(/\n/g, '\\n'),
      hasContent: buffer.trim().length > 0
    } : { empty: true };

    this.trace('BUFFER', action, {
      ...metadata,
      ...preview
    });
  }

  traceTerminalState(terminal, action) {
    if (!this.enabled || !terminal) return;

    const state = {
      rows: terminal.rows,
      cols: terminal.cols,
      bufferLength: terminal.buffer?.active?.length,
      cursorX: terminal.buffer?.active?.cursorX,
      cursorY: terminal.buffer?.active?.cursorY
    };

    this.trace('TERMINAL', action, state);
  }

  traceSocketEvent(event, data) {
    if (!this.enabled) return;

    const preview = {};
    if (data) {
      if (data.terminalId) preview.terminalId = data.terminalId;
      if (data.sessionId) preview.sessionId = data.sessionId;
      if (data.data && typeof data.data === 'string') {
        preview.dataLength = data.data.length;
        preview.dataPreview = data.data.substring(0, 50).replace(/\n/g, '\\n');
      }
    }

    this.trace('SOCKET', event, preview);
  }

  // Método para comparar contenido antes/después
  compareContent(before, after, label = 'CONTENT_COMPARE') {
    if (!this.enabled) return;

    const comparison = {
      beforeLength: before?.length || 0,
      afterLength: after?.length || 0,
      identical: before === after,
      lengthDiff: (after?.length || 0) - (before?.length || 0)
    };

    // Si son diferentes, encontrar dónde divergen
    if (!comparison.identical && before && after) {
      for (let i = 0; i < Math.min(before.length, after.length); i++) {
        if (before[i] !== after[i]) {
          comparison.firstDiffAt = i;
          comparison.diffContext = {
            before: before.substring(Math.max(0, i - 20), i + 20),
            after: after.substring(Math.max(0, i - 20), i + 20)
          };
          break;
        }
      }
    }

    this.trace('COMPARE', label, comparison);
  }
}

// Singleton y exponerlo globalmente para debugging
const tracer = new ClientPersistenceTracer();

// Exponerlo en window para poder activarlo desde la consola
if (typeof window !== 'undefined') {
  window.persistenceTracer = tracer;
  window.enablePersistenceTrace = () => tracer.enable();
  window.disablePersistenceTrace = () => tracer.disable();
}

export default tracer;