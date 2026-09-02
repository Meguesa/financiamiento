<?php
declare(strict_types=1);

// Unica dependencia compartida con el Portal: autenticacion/sesion.
require_once dirname(__DIR__) . '/includes/bootstrap.php';
portal_require_authentication();

$user = portal_user();
$name = htmlspecialchars((string) ($user['name'] ?? 'Usuario'), ENT_QUOTES, 'UTF-8');
$email = htmlspecialchars((string) ($user['email'] ?? ''), ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="es-MX">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ventas con Financiamiento | Portal JdJP</title>
  <link rel="stylesheet" href="./styles.css?v=20260823-header-map-1" />
  <link rel="stylesheet" href="./portal-integration.css?v=20260823-2" />
  <link rel="stylesheet" href="./account-menu.css?v=20260823-2" />
  <meta name="theme-color" content="#ffffff" />

  <!-- PDF -->
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"></script>
</head>
<body class="financing-page">
<nav class="portal-toolbar" aria-label="Navegación del portal">
  <div class="portal-toolbar-inner">
    <div class="portal-toolbar-title-wrap">
      <img class="portal-toolbar-logo" src="./assets/logo.jpg" alt="Jardines de Juan Pablo">
      <div class="portal-toolbar-title">
        <strong>Ventas con Financiamiento</strong>
        <span>Portal Interno JdJP · Jardines de Juan Pablo</span>
      </div>
    </div>

    <div class="portal-toolbar-context">Simulación, financiamiento y generación de documentos</div>

    <div class="portal-toolbar-actions">
      <a class="portal-toolbar-link" href="/">Regresar al portal</a>
      <details class="account-menu">
        <summary class="account-trigger" aria-label="Abrir menú de usuario" title="<?= $name ?>">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 20c0-4.1 3.6-6 8-6s8 1.9 8 6v1H4z" fill="currentColor" />
          </svg>
        </summary>
        <div class="account-menu-panel">
          <div class="account-menu-info"><strong><?= $name ?></strong><span><?= $email ?></span></div>
          <a class="account-menu-logout" href="/logout.php">Cerrar sesión</a>
        </div>
      </details>
    </div>
  </div>
</nav>

  <main class="container">
    <section class="card">
      <h2>Datos</h2>

      <div class="grid">
        <label class="field">
          <span>Cliente</span>
          <input id="cliente" type="text" placeholder="Nombre del cliente" maxlength="60" />
        </label>

        <label class="field">
          <span>Productos</span>
          <input id="producto" type="text" placeholder="Ej. Oro, Platino, VIP, etc." maxlength="60" />
        </label>
        
        <label class="field">
          <span>Monto total del paquete (con IVA)</span>
          <input id="total" type="number" inputmode="decimal" placeholder="Ej. 100000" min="0" step="0.01" />
        </label>

        <div class="field-pair">
          <label class="field">
            <span>% Pago Inicial</span>
            <input id="enganchePct" type="number" inputmode="decimal" placeholder="Ej. 8" min="0" max="100" step="0.01" />
            <small>Si capturas monto de enganche, este % se recalcula.</small>
          </label>
        
          <label class="field">
            <span>Pago Inicial (con IVA)</span>
            <input id="engancheMonto" type="number" inputmode="decimal" placeholder="Ej. 8000" min="0" step="0.01" />
            <small>Si lo llenas, tiene prioridad sobre el %.</small>
          </label>
        </div>

        <label class="field">
          <span>Tasa anual (%)</span>
          <input id="tasaAnual" type="number" inputmode="decimal" placeholder="Ej. 20" min="0" step="0.01" />
        </label>

        <label class="field">
          <span>Meses</span>
          <input id="meses" type="number" inputmode="numeric" placeholder="Ej. 36" min="1" max="120" step="1" />
        </label>

        <label class="field">
          <span>Primer pago (fecha)</span>
          <input id="primerPago" type="date" />
        </label>
        
        <label class="field">
          <span>IVA (%)</span>
          <input id="ivaPct" value="16" readonly inputmode="numeric">
        </label>
        
        <label class="field">
          <span>Días por periodo (base 360)</span>
          <input id="diasPeriodo" value="30" readonly inputmode="numeric">
          <small>Tu plantilla usa 30 días.</small>
        </label>
      </div>

      <div class="actions">
        <button id="btnCalcular" class="btn primary">Calcular</button>
        <button id="btnLimpiar" class="btn">Limpiar</button>
      </div>
    </section>

    <section class="card">
      <button id="togglePagos" class="accordion-header" type="button" aria-expanded="false" aria-controls="panelPagos">
        <span class="acc-title">Simulación de Abono a Capital</span>
        <span class="chev" aria-hidden="true">▾</span>
      </button>
    
      <div id="panelPagos" class="accordion-panel" hidden>
        <p class="muted">
          Esta simulación <strong>mantiene la mensualidad</strong> y <strong>recalcula el plazo</strong>
          a partir del pago donde se aplica el abono.
        </p>
        
        <label class="field">
          <span># de Pago donde se hará el abono</span>
          <input id="abonoPago" type="number" inputmode="numeric" placeholder="Ej. 5" min="1" step="1" />
          <small>Ejemplo: 5 = en el 5to pago.</small>
        </label>
    
        <label class="field">
          <span>Abono adicional (con IVA)</span>
          <input id="abonoExtra" type="number" inputmode="decimal" placeholder="Ej. 5000" min="0" step="0.01" />
          <small>Se suma al pago de ese mes.</small>
        </label>
    
        <div class="actions">
          <button id="btnSimularAbono" class="btn primary">Simular abono a capital</button>
          <button id="btnLimpiarAbono" class="btn">Limpiar</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Resumen</h2>
      <div class="summary">
        <div class="summary-item"><div class="k">Pago Inicial</div><div class="v" id="resEnganche">—</div></div>
        <div class="summary-item"><div class="k">Subtotal (sin IVA)</div><div class="v" id="resSubtotal">—</div></div>
        <div class="summary-item"><div class="k">IVA total</div><div class="v" id="resIva">—</div></div>
        <div class="summary-item"><div class="k">Monto a financiar</div><div class="v" id="resFinanciar">—</div></div>
        <div class="summary-item"><div class="k">Mensualidad (aprox.)</div><div class="v" id="resMensualidad">—</div></div>
        <div class="summary-item"><div class="k">Monto final financiado</div><div class="v" id="resTotalFin">—</div></div>
      </div>

      <div class="sig-wrap">
        <div class="sig-label">Firma del Cliente (opcional)</div>
        <div class="sig-box"><canvas id="firmaCanvas" class="sig-canvas"></canvas></div>
        <div class="sig-actions"><button id="btnLimpiarFirma" class="btn" type="button">Limpiar firma</button></div>
        <small class="muted">La firma se incluirá en el PDF al generar o compartir.</small>
      </div>

      <div class="actions">
        <button id="btnPDF" class="btn primary" disabled>Generar PDF</button>
        <button id="btnCompartir" class="btn primary" disabled>Compartir</button>
      </div>
    </section>

    <section class="card">
      <h2>Corrida</h2>
      <div class="table-wrap">
        <table id="tabla">
          <thead>
            <tr>
              <th>#</th><th>Fecha</th><th>Saldo inicial (sin IVA)</th><th>Abono capital</th><th>Interés</th><th>IVA</th><th>Pago</th><th>Saldo final</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="hint">* La corrida se calcula sobre el monto “sin IVA” y luego agrega IVA al pago (según el modo elegido).</div>
    </section>
  </main>

  <footer class="footer">
    <span>Hecho para uso móvil · Sin licencias</span>
    <details class="legal">
      <summary>Legal</summary>
      <p><strong>LEGAL:</strong> Documento para fines informativos y de <strong>simulación</strong> de financiamiento. La tasa es <strong>fija</strong> y el cálculo considera <strong>IVA sobre capital e interés</strong> según el modo seleccionado. Sujeto a validación y condiciones comerciales de <strong>MEGUESA S.A. de C.V.</strong>. No constituye contrato ni obligación de otorgar financiamiento.</p>
    </details>
  </footer>

  <script src="./app.js?v=20260902-fin-2"></script>
  <script>
  (() => {
    'use strict';

    // app.js genera el PDF de la corrida y originalmente buscaba el logo en
    // /assets/logo.jpg. Financiamiento vive bajo /financiamiento/, por lo que
    // normalizamos esa unica ruta sin tocar el calculo financiero.
    if (typeof window.loadImageAsDataURL === 'function') {
      const cargarImagenOriginal = window.loadImageAsDataURL;
      window.loadImageAsDataURL = function (url) {
        const resuelta = url === '/assets/logo.jpg' ? '/financiamiento/assets/logo.jpg' : url;
        return cargarImagenOriginal(resuelta);
      };
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('integracion') !== 'solicitud') return;

    const folio = String(params.get('folio') || '').trim().toUpperCase();
    const total = Number(params.get('total') || 0);
    const enganche = Math.max(0, Number(params.get('enganche') || 0));

    if (!/^SV-\d{4}-\d+$/.test(folio) || !(total > 0)) {
      console.warn('[Financiamiento] Parametros de Solicitud incompletos en URL.', { folio, total, enganche });
      return;
    }

    const setValue = (id, value) => {
      const control = document.getElementById(id);
      if (!control) return;
      control.value = value == null ? '' : String(value);
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Solo se precargan datos comerciales. Las condiciones financieras se
    // capturan aqui y regresan a Solicitud al aplicar la corrida.
    setValue('cliente', params.get('cliente') || '');
    setValue('producto', params.get('producto') || '');
    setValue('total', total.toFixed(2));
    setValue('engancheMonto', enganche.toFixed(2));
    setValue('enganchePct', ((enganche / total) * 100).toFixed(2));

    document.body.dataset.solicitudFolio = folio;
    console.info('[Financiamiento] Precarga comercial aplicada desde URL:', {
      build: '20260902-fin-2',
      folio,
      total,
      enganche,
      cliente: params.get('cliente') || '',
      producto: params.get('producto') || ''
    });
  })();
  </script>
  <script src="./solicitud-integracion.js?v=20260902-fin-2"></script>
  <script src="./pdf-anualidades.js?v=20260902-pdf-anualidades-1"></script>
</body>
</html>