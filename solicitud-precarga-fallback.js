(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('integracion') !== 'solicitud') return;

  const STORAGE_LATEST = 'JDJP_FINANCIAMIENTO_PREFILL_LATEST';

  function setValue(id, value) {
    const control = document.getElementById(id);
    if (control) control.value = value == null ? '' : String(value);
  }

  function numero(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function aplicar(data) {
    if (!data || typeof data !== 'object') return false;
    const folio = String(data.folio || '').trim().toUpperCase();
    if (!/^SV-\d{4}-\d+$/.test(folio)) return false;

    setValue('cliente', data.cliente || '');
    setValue('producto', data.producto || '');
    setValue('total', numero(data.total) > 0 ? numero(data.total).toFixed(2) : '');
    setValue('engancheMonto', numero(data.enganche) > 0 ? numero(data.enganche).toFixed(2) : '');
    setValue('tasaAnual', numero(data.tasaAnualPct) > 0 ? numero(data.tasaAnualPct).toFixed(2) : '');
    setValue('meses', numero(data.meses) > 0 ? String(Math.trunc(numero(data.meses))) : '');

    if (String(data.primerPago || '').match(/^\d{4}-\d{2}-\d{2}$/)) {
      setValue('primerPago', data.primerPago);
    }

    const total = numero(data.total);
    const enganche = numero(data.enganche);
    if (total > 0 && enganche >= 0) {
      setValue('enganchePct', ((enganche / total) * 100).toFixed(2));
    }

    const folioControl = document.getElementById('finSolicitudFolio');
    if (folioControl) folioControl.textContent = folio;

    const status = document.getElementById('finSolicitudStatus');
    if (status) {
      status.className = 'fin-solicitud-status ok';
      status.textContent = `Datos precargados para ${folio}. Completa tasa, plazo o fecha si es necesario y pulsa Calcular.`;
    }

    console.info('[Financiamiento] Precarga recuperada desde Solicitud de Venta:', folio);
    return true;
  }

  function iniciar() {
    let envelope = null;
    try {
      const raw = localStorage.getItem(STORAGE_LATEST);
      if (raw) envelope = JSON.parse(raw);
    } catch (error) {
      console.warn('[Financiamiento] No fue posible leer la precarga temporal:', error);
      return;
    }

    if (!envelope?.data) return;
    if (Number(envelope.expiresAt || 0) > 0 && Date.now() > Number(envelope.expiresAt)) {
      try { localStorage.removeItem(STORAGE_LATEST); } catch (_) {}
      return;
    }

    let intentos = 0;
    const timer = window.setInterval(() => {
      intentos += 1;
      const listo = document.getElementById('total') && document.getElementById('engancheMonto');
      if (!listo && intentos < 30) return;
      window.clearInterval(timer);
      if (listo) aplicar(envelope.data);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
