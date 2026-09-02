(() => {
  'use strict';

  if (window.__jdjpPdfAnualidadesDetalleSolicitado) return;
  window.__jdjpPdfAnualidadesDetalleSolicitado = true;

  function fechaValida(value) {
    return value instanceof Date && Number.isFinite(value.getTime());
  }

  function instalar() {
    if (
      !window.__jdjpAnualidadesFinanciamiento ||
      typeof generarPDF !== 'function' ||
      !window.jspdf?.jsPDF
    ) {
      window.setTimeout(instalar, 50);
      return;
    }

    if (window.__jdjpPdfAnualidadesDetalleInstalado) return;
    window.__jdjpPdfAnualidadesDetalleInstalado = true;

    const generarPDFAnterior = generarPDF;

    generarPDF = async function generarPDFConAnualidadesVisibles(opts = {}) {
      const ctorReal = window.jspdf?.jsPDF;
      if (typeof ctorReal !== 'function') return generarPDFAnterior(opts);

      const cantidad = Number(lastResult?.pagosAnualesEfectivos ?? lastResult?.pagosAnuales ?? 0);
      const importe = Number(lastResult?.importeAnualidad || 0);
      const fecha = fechaValida(lastResult?.fechaPrimerAnualidad)
        ? formatDateHuman(lastResult.fechaPrimerAnualidad)
        : '—';

      const lineH = 14;
      const desplazamiento = lineH * 3;

      function JsPDFConDetalle(...args) {
        const doc = new ctorReal(...args);
        let insertar = true;
        let desplazar = false;

        return new Proxy(doc, {
          get(target, prop) {
            if (prop === 'text') {
              return function textConDetalle(text, x, y, ...rest) {
                const valor = Array.isArray(text) ? '' : String(text ?? '');
                const yNum = Number(y);

                if (insertar && valor === 'Meses:' && Number.isFinite(yNum)) {
                  target.setFont('helvetica', 'bold');
                  target.text('Anualidades:', x, yNum);

                  target.setFont('helvetica', 'normal');
                  target.text(`Cantidad de Pagos: ${cantidad}`, Number(x) + 160, yNum);
                  target.text(`Importe: ${cantidad > 0 ? fmtMXN(importe) : '—'}`, Number(x) + 160, yNum + lineH);
                  target.text(`Fecha primer pago: ${cantidad > 0 ? fecha : '—'}`, Number(x) + 160, yNum + (lineH * 2));

                  target.setFont('helvetica', 'bold');
                  insertar = false;
                  desplazar = true;
                  return target.text(text, x, yNum + desplazamiento, ...rest);
                }

                if (desplazar && Number.isFinite(yNum)) {
                  return target.text(text, x, yNum + desplazamiento, ...rest);
                }

                return target.text(text, x, y, ...rest);
              };
            }

            if (prop === 'autoTable') {
              return function autoTableConDetalle(options = {}) {
                const startY = Number(options?.startY);
                const ajustadas = desplazar && Number.isFinite(startY)
                  ? { ...options, startY: startY + desplazamiento }
                  : options;
                desplazar = false;
                return target.autoTable(ajustadas);
              };
            }

            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      }

      // El wrapper anterior de anualidades consulta estas propiedades.
      // Las conservamos para que siga delegando al generador original.
      JsPDFConDetalle.API = ctorReal.API;
      JsPDFConDetalle.version = ctorReal.version;

      window.jspdf.jsPDF = JsPDFConDetalle;
      try {
        return await generarPDFAnterior(opts);
      } finally {
        window.jspdf.jsPDF = ctorReal;
      }
    };
  }

  instalar();
})();