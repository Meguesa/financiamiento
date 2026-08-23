(() => {
  'use strict';

  if (window.__financiamientoSolicitudIntegracionActiva) return;
  window.__financiamientoSolicitudIntegracionActiva = true;

  const params = new URLSearchParams(window.location.search);
  if (params.get('integracion') !== 'solicitud') return;

  const ORIGIN = window.location.origin;
  const MSG_APPLY = 'JDJP_FINANCIAMIENTO_APPLY';
  const MSG_ACK = 'JDJP_FINANCIAMIENTO_ACK';

  let contexto = leerContextoUrl();
  let aplicando = false;

  function numero(value) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  function leerContextoUrl() {
    const folio = String(params.get('folio') || '').trim().toUpperCase();
    const total = numero(params.get('total'));

    if (!/^SV-\d{4}-\d+$/.test(folio) || !(total > 0)) return null;

    return {
      folio,
      cliente: String(params.get('cliente') || '').trim(),
      producto: String(params.get('producto') || '').trim(),
      total,
      enganche: Math.max(0, numero(params.get('enganche'))),
      tasaAnualPct: Math.max(0, numero(params.get('tasa'))),
      meses: Math.max(0, Math.trunc(numero(params.get('meses')))),
      primerPago: String(params.get('primerPago') || '').trim()
    };
  }

  function iniciar() {
    const resumen = document.querySelector('.summary')?.closest('.card');
    if (!resumen || typeof generarPDF !== 'function') {
      window.setTimeout(iniciar, 100);
      return;
    }

    instalarEstilos();
    instalarPanel(resumen);
    window.addEventListener('message', recibirMensaje);

    if (!contexto) {
      estado('La URL no contiene los datos necesarios de la Solicitud de Venta. Regresa a la solicitud y vuelve a pulsar Calcular financiamiento.', 'warn');
      console.warn('[Financiamiento] Precarga invalida o incompleta.', Object.fromEntries(params.entries()));
      return;
    }

    precargar(contexto);
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
      <div id="finSolicitudStatus" class="fin-solicitud-status">Leyendo datos de la solicitud...</div>
    `;

    antesDe.parentElement.insertBefore(panel, antesDe);
    document.getElementById('btnAplicarSolicitud')?.addEventListener('click', aplicarASolicitud);
  }

  function precargar(data) {
    setValue('cliente', data.cliente || '');
    setValue('producto', data.producto || '');
    setValue('total', Number(data.total).toFixed(2));
    setValue('engancheMonto', Number(data.enganche || 0).toFixed(2));
    setValue('enganchePct', data.total > 0 ? ((Number(data.enganche || 0) / Number(data.total)) * 100).toFixed(2) : '0.00');
    setValue('tasaAnual', data.tasaAnualPct > 0 ? Number(data.tasaAnualPct).toFixed(2) : '');
    setValue('meses', data.meses > 0 ? String(data.meses) : '');

    if (/^\d{4}-\d{2}-\d{2}$/.test(data.primerPago || '')) {
      setValue('primerPago', data.primerPago);
    }

    const folioControl = document.getElementById('finSolicitudFolio');
    if (folioControl) folioControl.textContent = data.folio;

    estado(`Datos precargados para ${data.folio}. Revisa las condiciones y pulsa Calcular.`, 'ok');
    console.info('[Financiamiento] Datos recibidos directamente desde Solicitud de Venta:', data);
  }

  function setValue(id, value) {
    const control = document.getElementById(id);
    if (!control) return;
    control.value = value == null ? '' : String(value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function recibirMensaje(event) {
    if (event.origin !== ORIGIN) return;
    if (window.opener && event.source !== window.opener) return;

    const msg = event.data || {};
    if (msg.type !== MSG_ACK) return;

    aplicando = false;
    const boton = document.getElementById('btnAplicarSolicitud');
    if (boton) boton.disabled = !lastResult;
    estado(msg.message || (msg.ok ? 'Corrida aplicada correctamente.' : 'No fue posible aplicar la corrida.'), msg.ok ? 'ok' : 'warn');
  }

  async function aplicarASolicitud() {
    if (aplicando) return;

    if (!contexto?.folio) {
      estado('No hay una Solicitud de Venta asociada a esta corrida.', 'warn');
      return;
    }

    if (!lastResult) {
      estado('Primero calcula una corrida financiera válida.', 'warn');
      return;
    }

    if (!window.opener || window.opener.closed) {
      estado('La pestaña de Solicitud de Venta ya no está disponible. Vuelve a abrir Financiamiento desde la solicitud.', 'warn');
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
      const payload = {
        type: MSG_APPLY,
        folio: contexto.folio,
        result: {
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
        },
        pdfFilename: `CORRIDA_FINANCIERA_${contexto.folio}.pdf`,
        pdfBuffer
      };

      window.opener.postMessage(payload, ORIGIN, [pdfBuffer]);
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

  const activarCuandoHayaResultado = window.setInterval(() => {
    const boton = document.getElementById('btnAplicarSolicitud');
    if (!boton) return;
    boton.disabled = aplicando || !lastResult || !contexto?.folio || !window.opener || window.opener.closed;
  }, 350);

  window.addEventListener('beforeunload', () => {
    window.clearInterval(activarCuandoHayaResultado);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
