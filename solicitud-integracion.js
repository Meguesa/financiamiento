(() => {
  'use strict';

  if (window.__financiamientoSolicitudIntegracionActiva) return;
  window.__financiamientoSolicitudIntegracionActiva = true;

  const params = new URLSearchParams(window.location.search);
  if (params.get('integracion') !== 'solicitud') return;

  const ORIGIN = window.location.origin;
  const MSG_READY = 'JDJP_FINANCIAMIENTO_READY';
  const MSG_PREFILL = 'JDJP_FINANCIAMIENTO_PREFILL';
  const MSG_APPLY = 'JDJP_FINANCIAMIENTO_APPLY';
  const MSG_ACK = 'JDJP_FINANCIAMIENTO_ACK';

  let contexto = null;
  let aplicando = false;

  function iniciar() {
    const resumen = document.querySelector('.summary')?.closest('.card');
    if (!resumen || typeof generarPDF !== 'function') {
      window.setTimeout(iniciar, 120);
      return;
    }

    instalarEstilos();
    instalarPanel(resumen);
    window.addEventListener('message', recibirMensaje);

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: MSG_READY }, ORIGIN);
    } else {
      estado('Esta ventana de integración ya no está conectada con una Solicitud de Venta.', 'warn');
    }
  }

  function instalarEstilos() {
    if (document.getElementById('finSolicitudIntegracionStyle')) return;
    const style = document.createElement('style');
    style.id = 'finSolicitudIntegracionStyle';
    style.textContent = `
      .fin-solicitud-panel{margin-bottom:18px;padding:16px 18px;border:1px solid #cfe0ef;border-left:4px solid #225b8a;border-radius:14px;background:#f6fbff}
      .fin-solicitud-panel h2{margin:0 0 5px;font-size:18px}
      .fin-solicitud-panel p{margin:0 0 12px;color:#5c6b78;line-height:1.45}
      .fin-solicitud-folio{font-weight:800;color:#225b8a}
      .fin-solicitud-status{margin-top:10px;padding:9px 11px;border-radius:9px;background:#fff;border:1px solid #dce6ee;font-size:13px}
      .fin-solicitud-status.ok{background:#edf9f1;border-color:#b9dfc5;color:#176b38}
      .fin-solicitud-status.warn{background:#fff8e7;border-color:#ead49a;color:#805c00}
    `;
    document.head.appendChild(style);
  }

  function instalarPanel(antesDe) {
    if (document.getElementById('finSolicitudIntegracionPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'finSolicitudIntegracionPanel';
    panel.className = 'card fin-solicitud-panel';
    panel.innerHTML = `
      <h2>Integración con Solicitud de Venta</h2>
      <p>Calcula la corrida normalmente y, cuando esté lista, aplícala al folio <span id="finSolicitudFolio" class="fin-solicitud-folio">pendiente</span>.</p>
      <div class="actions">
        <button id="btnAplicarSolicitud" class="btn primary" type="button" disabled>Aplicar a Solicitud de Venta</button>
      </div>
      <div id="finSolicitudStatus" class="fin-solicitud-status">Esperando los datos de la solicitud...</div>
    `;
    antesDe.parentElement.insertBefore(panel, antesDe);
    document.getElementById('btnAplicarSolicitud')?.addEventListener('click', aplicarASolicitud);
  }

  function recibirMensaje(event) {
    if (event.origin !== ORIGIN || event.source !== window.opener) return;
    const msg = event.data || {};

    if (msg.type === MSG_PREFILL) {
      contexto = msg.data || {};
      precargar(contexto);
      return;
    }

    if (msg.type === MSG_ACK) {
      aplicando = false;
      const boton = document.getElementById('btnAplicarSolicitud');
      if (boton) boton.disabled = !lastResult;
      estado(msg.message || (msg.ok ? 'Corrida aplicada correctamente.' : 'No fue posible aplicar la corrida.'), msg.ok ? 'ok' : 'warn');
    }
  }

  function precargar(data) {
    const folio = String(data.folio || '').trim().toUpperCase();
    if (!/^SV-\d{4}-\d+$/.test(folio)) {
      estado('Los datos recibidos no contienen un folio válido.', 'warn');
      return;
    }

    setValue('cliente', data.cliente || '');
    setValue('producto', data.producto || '');
    setValue('total', numero(data.total) > 0 ? numero(data.total).toFixed(2) : '');
    setValue('engancheMonto', numero(data.enganche) > 0 ? numero(data.enganche).toFixed(2) : '');
    setValue('tasaAnual', numero(data.tasaAnualPct) >= 0 ? numero(data.tasaAnualPct).toFixed(2) : '');
    setValue('meses', numero(data.meses) > 0 ? String(Math.trunc(numero(data.meses))) : '');
    if (String(data.primerPago || '').match(/^\d{4}-\d{2}-\d{2}$/)) setValue('primerPago', data.primerPago);

    const total = numero(data.total);
    const enganche = numero(data.enganche);
    if (total > 0 && enganche >= 0) setValue('enganchePct', ((enganche / total) * 100).toFixed(2));

    document.getElementById('finSolicitudFolio').textContent = folio;
    estado(`Datos precargados para ${folio}. Completa tasa, plazo o fecha si es necesario y pulsa Calcular.`, 'ok');
  }

  async function aplicarASolicitud() {
    if (aplicando) return;
    if (!contexto?.folio) {
      estado('No hay una Solicitud de Venta conectada.', 'warn');
      return;
    }
    if (!lastResult) {
      estado('Primero calcula una corrida financiera válida.', 'warn');
      return;
    }
    if (!window.opener || window.opener.closed) {
      estado('La ventana de Solicitud de Venta ya no está disponible.', 'warn');
      return;
    }

    aplicando = true;
    const boton = document.getElementById('btnAplicarSolicitud');
    if (boton) boton.disabled = true;
    estado('Generando PDF y enviando la corrida a Solicitud de Venta...', 'warn');

    try {
      const pdf = await generarPDF({ openPreview: false, returnBlob: true });
      if (!pdf?.blob) throw new Error('No fue posible generar el PDF de la corrida.');
      const pdfBuffer = await pdf.blob.arrayBuffer();

      const result = {
        total: Number(lastResult.total || 0),
        enganche: Number(lastResult.engancheIncl || 0),
        enganchePct: Number(lastResult.enganchePctReal || 0) * 100,
        montoFinanciar: Number(lastResult.financiarIncl || 0),
        tasaAnualPct: Number(lastResult.tasaAnual || 0) * 100,
        meses: Number(lastResult.meses || 0),
        primerPago: formatDateISO(lastResult.primerPago),
        mensualidad: Number(lastResult.mensualidad || 0),
        totalPagos: Number(lastResult.totalPagos || 0),
        diasPeriodo: Number(lastResult.diasPeriodo || 30),
        ivaPct: Number(lastResult.ivaRate || IVA_RATE) * 100,
        mode: String(lastResult.mode || 'nueva')
      };

      window.opener.postMessage({
        type: MSG_APPLY,
        folio: String(contexto.folio || '').trim().toUpperCase(),
        result,
        pdfFilename: `CORRIDA_FINANCIERA_${String(contexto.folio || '').trim().toUpperCase()}.pdf`,
        pdfBuffer
      }, ORIGIN, [pdfBuffer]);
    } catch (error) {
      aplicando = false;
      if (boton) boton.disabled = !lastResult;
      estado(`No fue posible enviar la corrida: ${error.message || error}`, 'warn');
    }
  }

  function estado(text, tipo = '') {
    const control = document.getElementById('finSolicitudStatus');
    if (!control) return;
    control.className = `fin-solicitud-status ${tipo}`.trim();
    control.textContent = String(text || '');
  }

  function setValue(id, value) {
    const control = document.getElementById(id);
    if (control) control.value = value == null ? '' : String(value);
  }

  function numero(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  // Activar el botón cada vez que render() termina con una corrida válida.
  const activarCuandoHayaResultado = window.setInterval(() => {
    const boton = document.getElementById('btnAplicarSolicitud');
    if (!boton) return;
    boton.disabled = aplicando || !lastResult || !contexto?.folio;
  }, 350);
  window.addEventListener('beforeunload', () => window.clearInterval(activarCuandoHayaResultado));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
