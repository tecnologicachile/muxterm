const fs = require('fs');
const path = require('path');

class PersistenceTracer {
  constructor() {
    this.enabled = process.env.TRACE_PERSISTENCE === 'true';
    this.outputToFile = process.env.TRACE_PERSISTENCE_FILE === 'true';
    this.logFile = path.join(__dirname, '../../trace-persistence.log');
    this.sessionData = new Map(); // Para trackear datos por sesión
    
    if (this.enabled && this.outputToFile) {
      // Limpiar archivo al inicio
      fs.writeFileSync(this.logFile, `=== PERSISTENCE TRACE STARTED: ${new Date().toISOString()} ===\n`);
    }
  }

  trace(category, action, data = {}) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const message = this._formatMessage(category, action, data, timestamp);
    
    // Siempre a consola
    console.log(message);
    
    // Opcionalmente a archivo
    if (this.outputToFile) {
      fs.appendFileSync(this.logFile, message + '\n');
    }
  }

  startCapture(terminalId, sessionId) {
    if (!this.enabled) return;
    
    const captureId = `${sessionId}-${terminalId}-${Date.now()}`;
    this.sessionData.set(captureId, {
      terminalId,
      sessionId,
      startTime: Date.now(),
      steps: []
    });
    
    this.trace('CAPTURE', 'START', {
      terminalId,
      sessionId,
      captureId
    });
    
    return captureId;
  }

  captureStep(captureId, step, data) {
    if (!this.enabled || !this.sessionData.has(captureId)) return;
    
    const capture = this.sessionData.get(captureId);
    capture.steps.push({
      step,
      data,
      timestamp: Date.now()
    });
    
    this.trace('CAPTURE', step, {
      captureId,
      ...data,
      elapsed: `${Date.now() - capture.startTime}ms`
    });
  }

  endCapture(captureId, success = true) {
    if (!this.enabled || !this.sessionData.has(captureId)) return;
    
    const capture = this.sessionData.get(captureId);
    const totalTime = Date.now() - capture.startTime;
    
    this.trace('CAPTURE', success ? 'COMPLETE' : 'FAILED', {
      captureId,
      totalTime: `${totalTime}ms`,
      steps: capture.steps.length
    });
    
    // Generar resumen
    if (success) {
      this._generateSummary(captureId, capture);
    }
    
    this.sessionData.delete(captureId);
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

  _formatMessage(category, action, data, timestamp) {
    const prefix = `[TRACE:${category}]`;
    const time = timestamp.split('T')[1].split('.')[0]; // Solo HH:MM:SS
    
    // Formatear data de manera legible
    let dataStr = '';
    if (Object.keys(data).length > 0) {
      dataStr = Object.entries(data)
        .map(([key, value]) => {
          if (typeof value === 'object') {
            return `${key}:${JSON.stringify(value)}`;
          }
          return `${key}:${value}`;
        })
        .join(' | ');
    }
    
    return `${time} ${prefix} ${action}${dataStr ? ' - ' + dataStr : ''}`;
  }

  _generateSummary(captureId, capture) {
    const summary = {
      terminalId: capture.terminalId,
      sessionId: capture.sessionId,
      totalTime: Date.now() - capture.startTime,
      steps: capture.steps.map(s => ({
        name: s.step,
        time: s.timestamp - capture.startTime
      }))
    };
    
    this.trace('SUMMARY', 'FLOW_COMPLETE', summary);
  }

  // Método helper para comparar buffers
  compareBuffers(buffer1, buffer2, label = 'BUFFER_COMPARE') {
    if (!this.enabled) return;
    
    const comparison = {
      buffer1Length: buffer1?.length || 0,
      buffer2Length: buffer2?.length || 0,
      identical: buffer1 === buffer2,
      sizeDiff: Math.abs((buffer1?.length || 0) - (buffer2?.length || 0))
    };
    
    if (!comparison.identical && buffer1 && buffer2) {
      // Encontrar primera diferencia
      for (let i = 0; i < Math.min(buffer1.length, buffer2.length); i++) {
        if (buffer1[i] !== buffer2[i]) {
          comparison.firstDiffAt = i;
          comparison.firstDiffPreview = {
            buffer1: buffer1.substring(Math.max(0, i - 20), i + 20),
            buffer2: buffer2.substring(Math.max(0, i - 20), i + 20)
          };
          break;
        }
      }
    }
    
    this.trace('COMPARE', label, comparison);
  }
}

// Singleton
module.exports = new PersistenceTracer();