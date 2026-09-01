(() => {
  'use strict';

  if (window.__jdjpAnualidadesFinanciamiento) return;
  window.__jdjpAnualidadesFinanciamiento = true;

  const originalRender = render;
  const originalLimpiar = limpiar;
  const originalBuildShareText = buildShareText;

  function control(id) {
    return document.getElementById(id);
  }

  function instalarInterfaz() {
    if (control('pagosAnuales')) return;

    const mesesLabel = ui.meses?.closest('label');
    const grid = mesesLabel?.parentElement;
    if (!mesesLabel || !grid) return;

    const style = document.createElement('style');
    style.id = 'anualidadesFinanciamientoStyle';
    style.textContent = `
      .anualidad-heading{grid-column:1/-1;margin-top:4px;padding-top:14px;border-top:1px solid #e2e7eb}
      .anualidad-heading strong{display:block;font-size:16px;color:#1d2a34;margin-bottom:3px}
      .anualidad-heading small{display:block;color:#66727c;line-height:1.4}
      #tabla tbody tr.fin-anualidad td{background:#fff9e8}
      #tabla tbody tr.fin-anualidad td:nth-child(7){font-weight:800;color:#805c00}
    `;
    document.head.appendChild(style);

    const heading = document.createElement('div');
    heading.className = 'anualidad-heading';
    heading.innerHTML = '<strong>Anualidad</strong><small>Pagos adicionales programados. La primera anualidad se aplica en el pago 12 y las siguientes en los pagos 24, 36, 48, etc.</small>';

    const pagos = document.createElement('label');
    pagos.className = 'field';
    pagos.innerHTML = `
      <span>Pagos anuales</span>
      <input id="pagosAnuales" type="number" inputmode="numeric" placeholder="Ej. 3" min="0" step="1" />
      <small>Número de anualidades durante el plazo. Usa 0 si no aplica.</small>
    `;

    const importe = document.createElement('label');
    importe.className = 'field';
    importe.innerHTML = `
      <span>Importe de los pagos (anualidad)</span>
      <input id="importeAnualidad" type="number" inputmode="decimal" placeholder="Ej. 10000" min="0" step="0.01" />
      <small>Importe de cada anualidad, con IVA.</small>
    `;

    mesesLabel.insertAdjacentElement('afterend', importe);
    mesesLabel.insertAdjacentElement('afterend', pagos);
    mesesLabel.insertAdjacentElement('afterend', heading);

    const summary = document.querySelector('.summary');
    if (summary && !control('resAnualidad')) {
      const item = document.createElement('div');
      item.className = 'summary-item';
      item.innerHTML = '<div class="k">Anualidad</div><div class="v" id="resAnualidad">—</div>';
      summary.appendChild(item);
    }

    const headerRow = document.querySelector('#tabla thead tr');
    if (headerRow && !headerRow.querySelector('[data-anualidad-col]')) {
      const th = document.createElement('th');
      th.dataset.anualidadCol = '1';
      th.textContent = 'Anualidad';
      const pagoTh = Array.from(headerRow.children).find((cell) => cell.textContent.trim() === 'Pago');
      headerRow.insertBefore(th, pagoTh || null);
    }
  }

  function leerAnualidades() {
    return {
      pagosAnuales: Math.max(0, Math.trunc(Number(control('pagosAnuales')?.value || 0))),
      importeAnualidad: Math.max(0, Number(control('importeAnualidad')?.value || 0))
    };
  }

  function indicesAnualidad(meses, pagosAnuales) {
    const indices = [];
    for (let i = 1; i <= pagosAnuales; i += 1) {
      const pago = i * 12;
      if (pago <= meses) indices.push(pago);
    }
    return indices;
  }

  function pagoMensualConAnualidades(pvSub, rate, meses, importeAnualidadSub, indices) {
    if (!(meses > 0)) return 0;

    if (rate === 0) {
      return (pvSub - (importeAnualidadSub * indices.length)) / meses;
    }

    const factorMensualidades = (1 - Math.pow(1 + rate, -meses)) / rate;
    const valorPresenteAnualidades = indices.reduce(
      (acc, k) => acc + (importeAnualidadSub / Math.pow(1 + rate, k)),
      0
    );

    return (pvSub - valorPresenteAnualidades) / factorMensualidades;
  }

  function construirCorrida({ pvSub, rate, meses, primerPago, ivaRate, pagoSub, importeAnualidad, pagosAnuales }) {
    const indices = new Set(indicesAnualidad(meses, pagosAnuales));
    const anualidadSubPlaneada = round2(importeAnualidad / (1 + ivaRate));
    let saldo = pvSub;
    const rows = [];
    let totalPagosC = 0;

    for (let k = 1; k <= meses; k += 1) {
      const fecha = addMonths(primerPago, k - 1);
      const saldoInicial = saldo;
      const interes = round2(saldo * rate);
      let capitalMensual = round2(pagoSub - interes);
      let anualidadCapital = indices.has(k) ? anualidadSubPlaneada : 0;

      let capitalTotal = round2(capitalMensual + anualidadCapital);
      if (capitalTotal > saldo) {
        let exceso = round2(capitalTotal - saldo);
        const reduccionAnualidad = Math.min(anualidadCapital, exceso);
        anualidadCapital = round2(anualidadCapital - reduccionAnualidad);
        exceso = round2(exceso - reduccionAnualidad);
        if (exceso > 0) capitalMensual = round2(capitalMensual - exceso);
        capitalTotal = round2(capitalMensual + anualidadCapital);
      }

      let saldoFinal = round2(saldo - capitalTotal);
      if (k === meses && saldoFinal !== 0) {
        capitalMensual = round2(capitalMensual + saldoFinal);
        capitalTotal = round2(capitalMensual + anualidadCapital);
        saldoFinal = 0;
      }

      const baseIVA = round2(capitalTotal + interes);
      const ivaPago = round2(baseIVA * ivaRate);
      const pagoTotal = round2(baseIVA + ivaPago);
      const anualidadTotal = round2(anualidadCapital * (1 + ivaRate));

      rows.push({
        n: k,
        fecha,
        saldoInicial,
        capital: capitalTotal,
        capitalMensual,
        anualidadCapital,
        anualidadTotal,
        interes,
        iva: ivaPago,
        pago: pagoTotal,
        saldoFinal
      });

      totalPagosC += toCents(pagoTotal);
      saldo = saldoFinal;
    }

    return {
      rows,
      totalPagos: fromCents(totalPagosC),
      pagosAnualesEfectivos: rows.filter((row) => row.anualidadTotal > 0).length
    };
  }

  calcular = function calcularConAnualidades() {
    instalarInterfaz();

    const inp = getInputs();
    const anual = leerAnualidades();
    const errs = validar(inp);
    const maxAnualidades = Math.floor(inp.meses / 12);

    if (anual.pagosAnuales > maxAnualidades) {
      errs.push(`Para un plazo de ${inp.meses} meses solo pueden programarse hasta ${maxAnualidades} pago(s) anual(es).`);
    }
    if (anual.pagosAnuales > 0 && !(anual.importeAnualidad > 0)) {
      errs.push('Captura el importe de cada anualidad.');
    }
    if (anual.pagosAnuales === 0 && anual.importeAnualidad > 0) {
      errs.push('Captura cuántos pagos anuales se realizarán.');
    }

    if (errs.length) {
      alert(errs.join('\n'));
      return;
    }

    let engancheIncl = inp.engMonto > 0 ? inp.engMonto : inp.total * inp.engPct;
    engancheIncl = Math.min(engancheIncl, inp.total);
    engancheIncl = round2(engancheIncl);

    const enganchePctReal = inp.total > 0 ? (engancheIncl / inp.total) : 0;
    if (ui.enganchePct) ui.enganchePct.value = (enganchePctReal * 100).toFixed(2);

    const subtotalTotal = round2(inp.total / (1 + inp.ivaRate));
    const ivaTotal = round2(inp.total - subtotalTotal);
    const financiarIncl = round2(inp.total - engancheIncl);
    const financiarSub = round2(financiarIncl / (1 + inp.ivaRate));
    const rate = (inp.tasaAnual / 360) * inp.diasPeriodo;

    const indices = indicesAnualidad(inp.meses, anual.pagosAnuales);
    const anualidadSub = round2(anual.importeAnualidad / (1 + inp.ivaRate));
    let pagoSub = pagoMensualConAnualidades(financiarSub, rate, inp.meses, anualidadSub, indices);

    if (!Number.isFinite(pagoSub) || pagoSub < 0) {
      alert('El importe de las anualidades es demasiado alto para el monto financiado y el plazo capturado. Reduce las anualidades o su importe.');
      return;
    }

    pagoSub = round2(pagoSub);

    const corrida = construirCorrida({
      pvSub: financiarSub,
      rate,
      meses: inp.meses,
      primerPago: inp.primerPago,
      ivaRate: inp.ivaRate,
      pagoSub,
      importeAnualidad: anual.importeAnualidad,
      pagosAnuales: anual.pagosAnuales
    });

    const mensualidad = round2(pagoSub * (1 + inp.ivaRate));

    lastResult = {
      mode: 'nueva',
      ...inp,
      ...anual,
      pagosAnualesEfectivos: corrida.pagosAnualesEfectivos,
      mesesOriginal: inp.meses,
      engancheIncl,
      enganchePctReal,
      subtotalTotal,
      ivaTotal,
      financiarIncl,
      financiarSub,
      rate,
      pagoSub,
      mensualidad,
      totalPagos: corrida.totalPagos,
      rows: corrida.rows
    };

    baseResult = lastResult;
    render(lastResult);
  };

  simularAbonoCapital = function simularAbonoConAnualidades() {
    if (!baseResult) {
      alert('Primero calcula una corrida en la sección "Datos".');
      return;
    }

    const pagoN = parseInt(ui.abonoPago?.value || '0', 10);
    const extraTotal = Number(ui.abonoExtra?.value || 0);
    const mesesBase = baseResult.mesesOriginal || baseResult.meses;
    const errs = [];

    if (!(pagoN >= 1 && pagoN <= mesesBase)) errs.push(`El número de pago debe estar entre 1 y ${mesesBase}.`);
    if (!(extraTotal > 0)) errs.push('Captura un abono adicional mayor a 0.');
    if (errs.length) {
      alert(errs.join('\n'));
      return;
    }

    const extraCapitalSubPlaneado = round2(extraTotal / (1 + baseResult.ivaRate));
    const anualidadCapitalPlaneada = round2((baseResult.importeAnualidad || 0) / (1 + baseResult.ivaRate));
    const indices = new Set(indicesAnualidad(mesesBase, baseResult.pagosAnuales || 0));

    let saldo = baseResult.financiarSub;
    const rows = [];
    let totalPagosC = 0;

    for (let n = 1; n <= mesesBase; n += 1) {
      const fecha = addMonths(baseResult.primerPago, n - 1);
      const saldoInicial = saldo;
      const interes = round2(saldo * baseResult.rate);
      let capitalMensual = round2(baseResult.pagoSub - interes);
      let anualidadCapital = indices.has(n) ? anualidadCapitalPlaneada : 0;
      let abonoCapital = n === pagoN ? extraCapitalSubPlaneado : 0;

      let disponible = round2(saldo - capitalMensual);
      if (disponible < 0) disponible = 0;
      anualidadCapital = Math.min(anualidadCapital, disponible);
      disponible = round2(disponible - anualidadCapital);
      abonoCapital = Math.min(abonoCapital, Math.max(0, disponible));

      let capitalTotal = round2(capitalMensual + anualidadCapital + abonoCapital);
      if (capitalTotal > saldo) {
        capitalMensual = round2(capitalMensual - (capitalTotal - saldo));
        capitalTotal = saldo;
      }

      let saldoFinal = round2(saldo - capitalTotal);
      if (n === mesesBase && saldoFinal !== 0) {
        capitalMensual = round2(capitalMensual + saldoFinal);
        capitalTotal = round2(capitalMensual + anualidadCapital + abonoCapital);
        saldoFinal = 0;
      }

      const baseIVA = round2(capitalTotal + interes);
      const ivaPago = round2(baseIVA * baseResult.ivaRate);
      const pagoTotal = round2(baseIVA + ivaPago);
      const anualidadTotal = round2(anualidadCapital * (1 + baseResult.ivaRate));
      const abonoExtraTotal = round2(abonoCapital * (1 + baseResult.ivaRate));

      rows.push({
        n,
        fecha,
        saldoInicial,
        capital: capitalTotal,
        capitalMensual,
        anualidadCapital,
        anualidadTotal,
        interes,
        iva: ivaPago,
        pago: pagoTotal,
        saldoFinal,
        abonoExtraTotal
      });

      totalPagosC += toCents(pagoTotal);
      saldo = saldoFinal;
      if (saldo <= 0) break;
    }

    lastResult = {
      ...baseResult,
      mode: 'abono',
      meses: rows.length,
      rows,
      totalPagos: fromCents(totalPagosC),
      mensualidad: baseResult.mensualidad,
      abonoPagoN: pagoN,
      abonoExtra: extraTotal,
      pagosAnualesEfectivos: rows.filter((row) => row.anualidadTotal > 0).length
    };

    render(lastResult);

    if (ui.togglePagos && ui.panelPagos) {
      ui.togglePagos.setAttribute('aria-expanded', 'true');
      ui.panelPagos.hidden = false;
    }
  };

  render = function renderConAnualidades(res) {
    originalRender(res);

    const anualidadResumen = control('resAnualidad');
    if (anualidadResumen) {
      const cantidad = Number(res.pagosAnualesEfectivos ?? res.pagosAnuales ?? 0);
      const importe = Number(res.importeAnualidad || 0);
      anualidadResumen.textContent = cantidad > 0
        ? `${cantidad} × ${fmtMXN(importe)} · pagos 12, 24, 36…`
        : 'Sin anualidades';
    }

    const filas = Array.from(document.querySelectorAll('#tabla tbody tr'));
    filas.forEach((tr, index) => {
      const row = res.rows?.[index];
      const td = document.createElement('td');
      td.textContent = row?.anualidadTotal > 0 ? fmtMXN(row.anualidadTotal) : '—';
      const pagoCell = tr.children[6] || null;
      tr.insertBefore(td, pagoCell);
      tr.classList.toggle('fin-anualidad', Boolean(row?.anualidadTotal > 0));
    });
  };

  limpiar = function limpiarConAnualidades() {
    originalLimpiar();
    if (control('pagosAnuales')) control('pagosAnuales').value = '';
    if (control('importeAnualidad')) control('importeAnualidad').value = '';
    if (control('resAnualidad')) control('resAnualidad').textContent = '—';
  };

  buildShareText = function buildShareTextConAnualidades(res) {
    const texto = originalBuildShareText(res);
    const cantidad = Number(res.pagosAnualesEfectivos ?? res.pagosAnuales ?? 0);
    if (!(cantidad > 0)) return texto;

    const linea = `Anualidad: ${cantidad} pago(s) de ${fmtMXN(res.importeAnualidad || 0)} en los pagos 12, 24, 36…`;
    const lineas = texto.split('\n');
    const indiceTotal = lineas.findIndex((lineaActual) => lineaActual.startsWith('Total (suma de pagos):'));
    if (indiceTotal >= 0) lineas.splice(indiceTotal, 0, linea);
    else lineas.push(linea);
    return lineas.join('\n');
  };

  instalarInterfaz();
})();
