(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('integracion') !== 'solicitud') return;

  const STORAGE_LATEST = 'JDJP_FINANCIAMIENTO_PREFILL_LATEST';
  const STORAGE_PREFIX = 'JDJP_FINANCIAMIENTO_PREFILL_';
  const BRIDGE_ID = String(params.get('bridge') || '').trim();

  function numero(value) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  function texto(value) {
    return String(value ?? '').trim();
  }

  function setValue(id, value) {
    const control = document.getElementById(id);
    if (!control) return false;

    const next = value == null ? '' : String(value);
    if (control.value !== next) {
      control.value = next;
      try { control.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      try { control.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    }
    return true;
  }

  function normalizar(data) {
    if (!data || typeof data !== 'object') return null;

    const folio = texto(data.folio).toUpperCase();
    if (!/^SV-\d{4}-\d+$/.test(folio)) return null;

    const total = numero(data.total);
    if (!(total > 0)) return null;

    return {
      folio,
      cliente: texto(data.cliente),
      producto: texto(data.producto),
      total,
      enganche: Math.max(0, numero(data.enganche)),
      tasaAnualPct: Math.max(0, numero(data.tasaAnualPct)),
      meses: Math.max(0, Math.trunc(numero(data.meses))),
      primerPago: texto(data.primerPago)
    };
  }

  function aplicar(data, fuente) {
    const d = normalizar(data);
    if (!d) return false;

    const controlesListos =
      document.getElementById('cliente') &&
      document.getElementById('producto') &&
      document.getElementById('total') &&
      document.getElementById('engancheMonto') &&
      document.getElementById('enganchePct') &&
      document.getElementById('tasaAnual') &&
      document.getElementById('meses') &&
      document.getElementById('primerPago');

    if (!controlesListos) return false;

    setValue('cliente', d.cliente);
    setValue('producto', d.producto);
    setValue('total', d.total.toFixed(2));
    setValue('engancheMonto', d.enganche.toFixed(2));
    setValue('enganchePct', ((d.enganche / d.total) * 100).toFixed(2));
    setValue('tasaAnual', d.tasaAnualPct > 0 ? d.tasaAnualPct.toFixed(2) : '');
    setValue('meses', d.meses > 0 ? String(d.meses) : '');

    if (/^\d{4}-\d{2}-\d{2}$/.test(d.primerPago)) {
      setValue('primerPago', d.primerPago);
    }

    document.body.dataset.solicitudFolio = d.folio;
    document.body.dataset.solicitudPrefillSource = fuente || 'desconocida';

    const folioControl = document.getElementById('finSolicitudFolio');
    if (folioControl) folioControl.textContent = d.folio;

    const status = document.getElementById('finSolicitudStatus');
    if (status) {
      status.className = 'fin-solicitud-status ok';
      status.textContent = `Datos precargados para ${d.folio}. Revisa la corrida y pulsa Calcular.`;
    }

    console.info('[Financiamiento] Precarga aplicada correctamente.', {
      fuente,
      folio: d.folio,
      cliente: d.cliente,
      producto: d.producto,
      total: d.total,
      enganche: d.enganche,
      tasa: d.tasaAnualPct,
      meses: d.meses,
      primerPago: d.primerPago
    });

    return true;
  }

  function dataDesdeUrl() {
    const folio = texto(params.get('folio')).toUpperCase();
    if (!/^SV-\d{4}-\d+$/.test(folio)) return null;

    return normalizar({
      folio,
      cliente: params.get('cliente') || '',
      producto: params.get('producto') || '',
      total: params.get('total'),
      enganche: params.get('enganche'),
      tasaAnualPct: params.get('tasa'),
      meses: params.get('meses'),
      primerPago: params.get('primerPago') || ''
    });
  }

  function leerEnvelope(raw) {
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw);
      const expiresAt = numero(envelope?.expiresAt);
      if (expiresAt > 0 && Date.now() > expiresAt) return null;
      return normalizar(envelope?.data || null);
    } catch (_) {
      return null;
    }
  }

  function dataDesdeStorage() {
    try {
      if (BRIDGE_ID) {
        const bridgeData = leerEnvelope(localStorage.getItem(`${STORAGE_PREFIX}${BRIDGE_ID}`));
        if (bridgeData) return bridgeData;
      }
      return leerEnvelope(localStorage.getItem(STORAGE_LATEST));
    } catch (error) {
      console.warn('[Financiamiento] No fue posible leer storage:', error);
      return null;
    }
  }

  function valueFromOpener(doc, id) {
    return texto(doc.getElementById(id)?.value);
  }

  function numeroFromOpener(doc, id) {
    return numero(valueFromOpener(doc, id));
  }

  function dataDesdeOpener() {
    try {
      if (!window.opener || window.opener.closed) return null;
      const doc = window.opener.document;
      if (!doc) return null;

      let folio = texto(params.get('folio')).toUpperCase();
      if (!/^SV-\d{4}-\d+$/.test(folio)) {
        folio = texto(doc.querySelector('.folio-box strong')?.textContent).toUpperCase();
      }
      if (!/^SV-\d{4}-\d+$/.test(folio)) return null;

      const cliente = [
        valueFromOpener(doc, 'clienteNombres'),
        valueFromOpener(doc, 'clienteApellidoPaterno'),
        valueFromOpener(doc, 'clienteApellidoMaterno')
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

      const producto = [
        valueFromOpener(doc, 'paquete'),
        valueFromOpener(doc, 'tipoVentaProcap')
      ].filter(Boolean).join(' · ');

      return normalizar({
        folio,
        cliente,
        producto,
        total: numeroFromOpener(doc, 'precioTotal'),
        enganche: Math.max(0, numeroFromOpener(doc, 'enganche')),
        tasaAnualPct: Math.max(0, numeroFromOpener(doc, 'interesFinanciamiento')),
        meses: Math.max(0, Math.trunc(numeroFromOpener(doc, 'mensualidades'))),
        primerPago: valueFromOpener(doc, 'fechaPrimerVencimiento')
      });
    } catch (error) {
      console.warn('[Financiamiento] No fue posible leer directamente la Solicitud:', error);
      return null;
    }
  }

  function obtenerData() {
    const desdeUrl = dataDesdeUrl();
    if (desdeUrl) return { data: desdeUrl, fuente: 'URL' };

    const desdeStorage = dataDesdeStorage();
    if (desdeStorage) return { data: desdeStorage, fuente: 'storage' };

    const desdeOpener = dataDesdeOpener();
    if (desdeOpener) return { data: desdeOpener, fuente: 'Solicitud abierta' };

    return null;
  }

  function iniciar() {
    console.info('[Financiamiento] Iniciando precarga resiliente de Solicitud de Venta.');

    let intentos = 0;
    let exitosConsecutivos = 0;

    const intentar = () => {
      intentos += 1;
      const encontrado = obtenerData();
      const ok = encontrado ? aplicar(encontrado.data, encontrado.fuente) : false;

      if (ok) exitosConsecutivos += 1;
      else exitosConsecutivos = 0;

      // Reaplicar varias veces evita que otro script inicializador borre los valores después.
      if (exitosConsecutivos >= 5 || intentos >= 60) {
        window.clearInterval(timer);
        if (!ok) {
          console.warn('[Financiamiento] No fue posible obtener datos para la precarga después de varios intentos.', {
            folioURL: params.get('folio'),
            totalURL: params.get('total'),
            bridge: BRIDGE_ID,
            openerDisponible: Boolean(window.opener && !window.opener.closed)
          });
        }
      }
    };

    intentar();
    const timer = window.setInterval(intentar, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
