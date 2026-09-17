/**
 * DyA Financial — Controlador Principal de la Aplicación
 * ---------------------------------------------------------------------
 * Gestiona el ciclo de vida de la interfaz, transiciones de pantalla,
 * eventos de carga de archivos, animación de procesamiento,
 * renderizado de gráficos Chart.js y modal de captación de leads.
 * ---------------------------------------------------------------------
 */

(() => {
  'use strict';

  // Configuración de contacto D&A Financial (personalizable)
  const DYA_CONFIG = {
    whatsappNumber: '', // Déjalo vacío mientras creas la línea. Luego ingresa tu número con código de país (ej: '573001234567')
    calendlyUrl: ''
  };

  // Estado reactivo de la sesión
  const state = {
    useDemo: false,
    files: { balance: null, pyg: null },
    lastDiagnosis: null,
    chartsInstances: []
  };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ============================================================
     1. NAVEGACIÓN Y PANTALLAS
     ============================================================ */
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }
  }

  // Bindings de navegación inicial
  document.getElementById('btn-start')?.addEventListener('click', () => showScreen('screen-company'));
  document.getElementById('btn-nav-start')?.addEventListener('click', () => showScreen('screen-company'));
  document.getElementById('back-to-landing')?.addEventListener('click', () => showScreen('screen-landing'));
  document.getElementById('back-to-company')?.addEventListener('click', () => showScreen('screen-company'));
  document.getElementById('btn-to-upload')?.addEventListener('click', () => showScreen('screen-upload'));

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    showScreen('screen-landing');
  });

  document.getElementById('btn-menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });

  /* ============================================================
     2. GESTIÓN DE DROPZONES Y DEMO
     ============================================================ */
  function setupDropzone(zoneId, inputId, key) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    zone.querySelector('.dz-cta')?.addEventListener('click', (e) => {
      e.stopPropagation();
      input.click();
    });

    zone.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        markLoaded(zone, input.files[0].name, input.files[0].size, key);
      }
    });

    ['dragover', 'dragenter'].forEach(evt => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
      });
    });

    zone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) {
        markLoaded(zone, file.name, file.size, key);
      }
    });
  }

  function markLoaded(zone, name, size, key) {
    zone.classList.add('is-loaded');
    const nameEl = zone.querySelector('.file-info-name');
    const metaEl = zone.querySelector('.file-info-meta');
    if (nameEl) nameEl.textContent = name;
    if (metaEl) {
      const kb = size ? Math.max(1, Math.round(size / 1024)) : 120;
      metaEl.textContent = `${kb} KB · Archivo verificado`;
    }
    state.files[key] = name;
    checkReadyToGenerate();
  }

  function checkReadyToGenerate() {
    const ready = state.useDemo || (state.files.balance && state.files.pyg);
    const btn = document.getElementById('btn-generate');
    if (btn) btn.disabled = !ready;
  }

  setupDropzone('dz-balance', 'file-balance', 'balance');
  setupDropzone('dz-pyg', 'file-pyg', 'pyg');

  document.getElementById('btn-demo')?.addEventListener('click', () => {
    state.useDemo = true;
    const dzBalance = document.getElementById('dz-balance');
    const dzPyg = document.getElementById('dz-pyg');
    if (dzBalance) markLoaded(dzBalance, 'balance_general_dya_demo.xlsx', 131072, 'balance');
    if (dzPyg) markLoaded(dzPyg, 'estado_resultados_dya_demo.xlsx', 98304, 'pyg');
  });

  document.getElementById('btn-generate')?.addEventListener('click', runProcessing);

  /* ============================================================
     3. PANTALLA DE PROCESAMIENTO ANIMADA
     ============================================================ */
  function runProcessing() {
    showScreen('screen-processing');
    const items = document.querySelectorAll('.checklist-item');
    const bar = document.getElementById('proc-bar');
    items.forEach(it => it.classList.remove('active', 'done'));
    if (bar) bar.style.width = '0%';

    let i = 0;
    function step() {
      if (i > 0) {
        items[i - 1]?.classList.remove('active');
        items[i - 1]?.classList.add('done');
      }
      if (i < items.length) {
        items[i]?.classList.add('active');
        if (bar) bar.style.width = Math.round(((i + 1) / items.length) * 100) + '%';
        i++;
        setTimeout(step, 420);
      } else {
        setTimeout(() => {
          buildDashboard();
          showScreen('screen-dashboard');
        }, 350);
      }
    }
    step();
  }

  /* ============================================================
     4. DESTRUCCIÓN Y GESTIÓN DE GRÁFICOS
     ============================================================ */
  function destroyCharts() {
    state.chartsInstances.forEach(c => {
      try { c.destroy(); } catch (_) {}
    });
    state.chartsInstances = [];
  }

  /* ============================================================
     5. CONSTRUCCIÓN DEL DASHBOARD
     ============================================================ */
  function buildDashboard() {
    const company = document.getElementById('inp-company')?.value.trim() || 'Empresa Demo S.A.S.';
    const sector = document.getElementById('inp-sector')?.value || 'Comercio';
    const periodo = document.getElementById('inp-periodo')?.value.trim() || 'Enero - Diciembre 2026';
    const moneda = document.getElementById('inp-moneda')?.value || 'COP';

    // Actualizar encabezados
    const scCompany = document.getElementById('sc-company');
    const scMeta = document.getElementById('sc-meta');
    const dhCompany = document.getElementById('dh-company');
    const dhPeriodo = document.getElementById('dh-periodo');

    if (scCompany) scCompany.textContent = company;
    if (scMeta) scMeta.textContent = `${sector} · ${periodo}`;
    if (dhCompany) dhCompany.textContent = company;
    if (dhPeriodo) dhPeriodo.textContent = periodo;

    // Ejecutar Motor Financiero de DyA
    const model = FinanceEngine.buildFinancialModel(FinanceEngine.demoRawData);
    const ind = FinanceEngine.computeIndicators(model);
    const health = FinanceEngine.computeHealthScore(ind);
    const diag = FinanceEngine.generateFinancialAnalysis(model, ind, health, { company, sector, periodo, moneda });

    const f2 = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    const f0 = (n) => Math.round(Number(n)).toLocaleString('es-CO');
    const cop = (n) => '$' + f0(n) + ' ' + (moneda === 'COP' ? 'MM' : moneda);

    // Resumen y Anillos de Score
    const resumenEl = document.getElementById('txt-resumen-ejecutivo');
    const ringCatEl = document.getElementById('ring-cat');
    const explainEl = document.getElementById('txt-score-explain');

    if (resumenEl) resumenEl.textContent = diag.resumenEjecutivo;
    if (ringCatEl) ringCatEl.textContent = FinanceEngine.healthCategoryLabel(health.total);
    if (explainEl) explainEl.textContent = diag.scoreExplain;

    animateRing('ring-fg', 'ring-score', health.total, 78);
    animateRing('ring-fg-2', 'ring-score-2', health.total, 86);

    // Render de Indicadores
    const statusMeta = (tier) => (
      tier === 'green' ? { badge: 'badge-green', icon: '🟢', bg: 'var(--green-100)', fg: 'var(--green-600)', label: 'Saludable' } :
      tier === 'yellow' ? { badge: 'badge-yellow', icon: '🟡', bg: 'var(--yellow-100)', fg: 'var(--yellow-700)', label: 'Atención' } :
      { badge: 'badge-red', icon: '🔴', bg: 'var(--red-100)', fg: 'var(--red-600)', label: 'Crítico' }
    );

    function indCard(name, value, tier, desc, tooltip) {
      const sm = statusMeta(tier);
      return `
        <div class="card ind-card" data-tooltip="${tooltip}">
          <div class="ind-card-top">
            <div class="ind-icon" style="background:${sm.bg}; color:${sm.fg};">${sm.icon}</div>
            <span class="badge ${sm.badge}"><span class="badge-dot"></span>${sm.label}</span>
          </div>
          <div class="ind-value">${value}</div>
          <div class="ind-name">${name}</div>
          <div class="ind-desc">${desc}</div>
        </div>`;
    }

    const gridLiq = document.getElementById('grid-liquidez');
    if (gridLiq) {
      gridLiq.innerHTML =
        indCard('Razón Corriente', ind.currentRatio.toFixed(2) + 'x', FinanceEngine.scoreFromRange(ind.currentRatio, 0.8, 1.2, 1.8) >= 65 ? 'green' : (FinanceEngine.scoreFromRange(ind.currentRatio, 0.8, 1.2, 1.8) >= 40 ? 'yellow' : 'red'), 'Capacidad de pago de pasivos a corto plazo.', 'Por cada $1 de deuda a corto plazo, la empresa cuenta con este valor en activos corrientes.') +
        indCard('Prueba Ácida', ind.quickRatio.toFixed(2) + 'x', FinanceEngine.scoreFromRange(ind.quickRatio, 0.5, 0.9, 1.3) >= 65 ? 'green' : (FinanceEngine.scoreFromRange(ind.quickRatio, 0.5, 0.9, 1.3) >= 40 ? 'yellow' : 'red'), 'Liquidez inmediata sin liquidar inventarios.', 'Excluye inventarios para medir la solvencia ante exigencias urgentes de pago.') +
        indCard('Capital de Trabajo Neto', cop(model.totalActivoCorriente - model.totalPasivoCorriente), (model.totalActivoCorriente - model.totalPasivoCorriente) > 0 ? 'green' : 'red', 'Fondo de maniobra operativo disponible.', 'Activo Corriente menos Pasivo Corriente.') +
        indCard('KTNO', cop(model.ktno), 'yellow', 'Capital de Trabajo Neto Operativo.', 'Recursos atrapados en la operación: Cartera + Inventarios - Proveedores.');
    }

    const gridRent = document.getElementById('grid-rentabilidad');
    if (gridRent) {
      gridRent.innerHTML =
        indCard('Margen Bruto', f2(ind.grossMargin) + '%', FinanceEngine.scoreFromRange(ind.grossMargin, 15, 25, 40) >= 65 ? 'green' : 'yellow', 'Rentabilidad sobre el costo de ventas.', 'Utilidad bruta como porcentaje de los ingresos totales.') +
        indCard('Margen Operacional (EBIT)', f2(ind.operatingMargin) + '%', FinanceEngine.scoreFromRange(ind.operatingMargin, 2, 7, 15) >= 65 ? 'green' : 'yellow', 'Eficiencia y retorno de la operación central.', 'Utilidad operacional sobre ingresos, sin considerar deuda ni tributos.') +
        indCard('Margen Neto', f2(ind.netMargin) + '%', FinanceEngine.scoreFromRange(ind.netMargin, 1, 4, 10) >= 65 ? 'green' : 'yellow', 'Ganancia neta disponible tras todos los costos y gastos.', 'Utilidad neta final como porcentaje de los ingresos.') +
        indCard('ROE', f2(ind.roe) + '%', FinanceEngine.scoreFromRange(ind.roe, 5, 12, 22) >= 65 ? 'green' : 'yellow', 'Rentabilidad sobre el patrimonio de los socios.', 'Retorno generado sobre el capital propio invertido en el negocio.') +
        indCard('ROA', f2(ind.roa) + '%', FinanceEngine.scoreFromRange(ind.roa, 2, 6, 12) >= 65 ? 'green' : 'yellow', 'Eficiencia productiva de los activos totales.', 'Capacidad de los activos totales para producir beneficio neto.');
    }

    const gridEnd = document.getElementById('grid-endeudamiento');
    if (gridEnd) {
      gridEnd.innerHTML =
        indCard('Nivel de Endeudamiento', f2(ind.debtRatio) + '%', FinanceEngine.scoreFromRange(ind.debtRatio, 80, 55, 35) >= 65 ? 'green' : (FinanceEngine.scoreFromRange(ind.debtRatio, 80, 55, 35) >= 40 ? 'yellow' : 'red'), 'Proporción de activos financiada por terceros.', 'Total pasivos dividido entre el total de activos.') +
        indCard('Endeudamiento Financiero', f2(ind.financialDebtRatio) + '%', FinanceEngine.scoreFromRange(ind.financialDebtRatio, 45, 30, 15) >= 65 ? 'green' : 'yellow', 'Peso de la deuda con bancos y entidades de crédito.', 'Obligaciones financieras CP y LP sobre el activo total.') +
        indCard('Cobertura de Intereses', ind.interestCoverage.toFixed(1) + 'x', FinanceEngine.scoreFromRange(ind.interestCoverage, 1.2, 2.5, 5) >= 65 ? 'green' : 'yellow', 'Veces que la utilidad operacional cubre los intereses.', 'Utilidad operacional dividida entre gastos financieros.');
    }

    const gridGest = document.getElementById('grid-gestion');
    if (gridGest) {
      gridGest.innerHTML =
        indCard('Días de Cartera (DSO)', Math.round(ind.dso) + ' días', FinanceEngine.scoreFromRange(ind.dso, 90, 55, 30) >= 65 ? 'green' : 'yellow', 'Plazo promedio de recaudo a clientes.', 'Cuentas comerciales por cobrar expresadas en días de venta.') +
        indCard('Días de Inventario (DIO)', Math.round(ind.dio) + ' días', FinanceEngine.scoreFromRange(ind.dio, 90, 55, 30) >= 65 ? 'green' : 'yellow', 'Permanencia promedio de mercancía en bodega.', 'Inventarios expresados en días de costo de ventas.') +
        indCard('Días de Proveedores (DPO)', Math.round(ind.dpo) + ' días', 'green', 'Plazo promedio negociado para pagar a proveedores.', 'Cuentas por pagar expresadas en días de compras.') +
        indCard('Ciclo de Conversión de Efectivo', Math.round(ind.ccc) + ' días', FinanceEngine.scoreFromRange(ind.ccc, 100, 60, 30) >= 65 ? 'green' : (FinanceEngine.scoreFromRange(ind.ccc, 100, 60, 30) >= 40 ? 'yellow' : 'red'), 'Días en que el capital está inmovilizado en la operación.', 'DSO + DIO − DPO: tiempo que tarda $1 en volver a convertirse en caja.');
    }

    // Preparar objeto estructurado para el PDF
    const indicadoresFlat = [
      { categoria: 'Liquidez', nombre: 'Razón Corriente', valor: ind.currentRatio.toFixed(2) + 'x' },
      { categoria: 'Liquidez', nombre: 'Prueba Ácida', valor: ind.quickRatio.toFixed(2) + 'x' },
      { categoria: 'Liquidez', nombre: 'Capital de Trabajo', valor: cop(model.totalActivoCorriente - model.totalPasivoCorriente) },
      { categoria: 'Liquidez', nombre: 'KTNO', valor: cop(model.ktno) },
      { categoria: 'Rentabilidad', nombre: 'Margen Bruto', valor: f2(ind.grossMargin) + '%' },
      { categoria: 'Rentabilidad', nombre: 'Margen Operacional', valor: f2(ind.operatingMargin) + '%' },
      { categoria: 'Rentabilidad', nombre: 'Margen Neto', valor: f2(ind.netMargin) + '%' },
      { categoria: 'Rentabilidad', nombre: 'ROA', valor: f2(ind.roa) + '%' },
      { categoria: 'Rentabilidad', nombre: 'ROE', valor: f2(ind.roe) + '%' },
      { categoria: 'Endeudamiento', nombre: 'Nivel de Endeudamiento', valor: f2(ind.debtRatio) + '%' },
      { categoria: 'Endeudamiento', nombre: 'Endeudamiento Financiero', valor: f2(ind.financialDebtRatio) + '%' },
      { categoria: 'Endeudamiento', nombre: 'Cobertura de Intereses', valor: ind.interestCoverage.toFixed(1) + 'x' },
      { categoria: 'Gestión', nombre: 'Días de Cartera (DSO)', valor: Math.round(ind.dso) + ' días' },
      { categoria: 'Gestión', nombre: 'Días de Inventario (DIO)', valor: Math.round(ind.dio) + ' días' },
      { categoria: 'Gestión', nombre: 'Días de Proveedores (DPO)', valor: Math.round(ind.dpo) + ' días' },
      { categoria: 'Gestión', nombre: 'Ciclo de Conversión de Efectivo', valor: Math.round(ind.ccc) + ' días' }
    ];

    state.lastDiagnosis = {
      empresa: company,
      sector,
      periodo,
      moneda,
      reportData: {
        scoreTotal: health.total,
        scoreLabel: FinanceEngine.healthCategoryLabel(health.total),
        resumenEjecutivo: diag.resumenEjecutivo,
        conclusion: diag.conclusion,
        categorias: diag.categorias,
        indicadores: indicadoresFlat,
        fortalezas: diag.fortalezas,
        alertas: diag.alertas,
        recomendaciones: diag.recomendaciones
      }
    };

    // Análisis gerencial
    const generalEl = document.getElementById('txt-analisis-general');
    if (generalEl) generalEl.textContent = diag.analisisGeneral;

    const gridAnalisis = document.getElementById('grid-analisis');
    if (gridAnalisis) {
      gridAnalisis.innerHTML = diag.categorias.map(c => {
        const sm = statusMeta(c.tier);
        return `
          <div class="card analysis-card">
            <h3>${c.name} <span class="badge ${sm.badge}"><span class="badge-dot"></span>${c.status}</span></h3>
            <p>${c.text}</p>
          </div>`;
      }).join('');
    }

    // Fortalezas
    const listFort = document.getElementById('list-fortalezas');
    if (listFort) {
      listFort.innerHTML = diag.fortalezas.map(f => `
        <div class="card flag-item">
          <div class="flag-icon" style="background:var(--green-100); color:var(--green-600);">${f.icon}</div>
          <div><h4>${f.title}</h4><p>${f.text}</p></div>
        </div>`).join('');
    }

    // Alertas
    const listAlert = document.getElementById('list-alertas');
    if (listAlert) {
      listAlert.innerHTML = diag.alertas.map(a => {
        const sm = statusMeta(a.tier);
        return `
          <div class="card flag-item">
            <div class="flag-icon" style="background:${sm.bg}; color:${sm.fg};">${a.icon}</div>
            <div><h4>${f2(a.title) || a.title}</h4><p>${a.text}</p></div>
          </div>`;
      }).join('');
    }

    // Recomendaciones
    const listReco = document.getElementById('list-recomendaciones');
    if (listReco) {
      listReco.innerHTML = diag.recomendaciones.map((r, i) => `
        <div class="card reco-card">
          <div class="reco-num">${String(i + 1).padStart(2, '0')}</div>
          <div>
            <h3>${r.title}</h3>
            <div class="reco-block"><b>Objetivo Estratégico</b><p style="font-size:14.5px; color:var(--gray-700);">${r.objetivo}</p></div>
            <div class="reco-block"><b>Acciones Sugeridas por DyA Financial</b><ul>${r.acciones.map(a => `<li>${a}</li>`).join('')}</ul></div>
            <div class="reco-impact">Impacto Proyectado: ${r.impacto}</div>
          </div>
        </div>`).join('');
    }

    // Semáforo
    const semaforoItems = [
      { label: 'Liquidez y Cobertura', cat: health.categories.liquidez },
      { label: 'Rentabilidad y Margen', cat: health.categories.rentabilidad },
      { label: 'Apalancamiento y Deuda', cat: health.categories.endeudamiento },
      { label: 'Gestión de Cartera', cat: health.categories.gestion },
      { label: 'Eficiencia en Capital de Trabajo', cat: health.categories.gestion }
    ];
    const gridSem = document.getElementById('grid-semaforo');
    if (gridSem) {
      gridSem.innerHTML = semaforoItems.map(s => {
        const sm = statusMeta(s.cat.tier);
        return `
          <div class="card semaforo-item">
            <span class="badge ${sm.badge}"><span class="badge-dot"></span>${s.cat.label}</span>
            <div class="sf-label">${s.label}</div>
          </div>`;
      }).join('');
    }

    // Ponderación de Score
    const catNames = {
      liquidez: ['Liquidez', 'var(--dya-blue-600)'],
      rentabilidad: ['Rentabilidad', 'var(--green-500)'],
      endeudamiento: ['Endeudamiento', 'var(--yellow-600)'],
      gestion: ['Gestión Operativa', '#8B5CF6'],
      crecimiento: ['Crecimiento de Ventas', '#0EA5B7']
    };
    const breakdownEl = document.getElementById('score-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = Object.entries(health.categories).map(([key, c]) => {
        const [label, color] = catNames[key] || [key, 'var(--dya-blue-600)'];
        return `
          <div class="breakdown-row">
            <div class="breakdown-top"><span>${label}</span><span class="weight">${Math.round(c.weight * 100)}% del score</span></div>
            <div class="bd-bar"><div class="bd-bar-fill" style="width:${Math.round(c.score)}%; background:${color};"></div></div>
          </div>`;
      }).join('');
    }

    // Conclusión
    const concEl = document.getElementById('txt-conclusion');
    if (concEl) concEl.textContent = diag.conclusion;

    // Inicializar Gráficos Chart.js
    initCharts(model);
    setupScrollSpy();
  }

  /* ============================================================
     6. GRÁFICOS CHART.JS
     ============================================================ */
  function initCharts(model) {
    destroyCharts();

    const navy = '#0B172A';
    const blue = '#1E50D6';
    const green = '#10B981';
    const red = '#EF4444';
    const yellow = '#D97706';
    const gray = '#8E9DB5';

    // Gráfico de Ingresos
    const elIngresos = document.getElementById('chart-ingresos');
    if (elIngresos) {
      state.chartsInstances.push(new Chart(elIngresos, {
        type: 'bar',
        data: {
          labels: model.periodos,
          datasets: [{
            label: 'Ingresos Operacionales',
            data: model.ingresosHistoricos,
            backgroundColor: blue,
            borderRadius: 6,
            maxBarThickness: 42
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#E8EDF5' }, ticks: { callback: v => '$' + v.toLocaleString('es-CO') } },
            x: { grid: { display: false } }
          }
        }
      }));
    }

    // Gráfico de Utilidad Neta
    const elUtilidad = document.getElementById('chart-utilidad');
    if (elUtilidad) {
      state.chartsInstances.push(new Chart(elUtilidad, {
        type: 'line',
        data: {
          labels: model.periodos,
          datasets: [{
            label: 'Utilidad Neta',
            data: model.utilidadNetaHistorica,
            borderColor: green,
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: green
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#E8EDF5' } },
            x: { grid: { display: false } }
          }
        }
      }));
    }

    // Estructura de Capital (Doughnut)
    const elEstructura = document.getElementById('chart-estructura');
    if (elEstructura) {
      state.chartsInstances.push(new Chart(elEstructura, {
        type: 'doughnut',
        data: {
          labels: ['Activos', 'Pasivos', 'Patrimonio'],
          datasets: [{
            data: [model.totalActivos, model.totalPasivos, model.totalPatrimonio],
            backgroundColor: [navy, red, green],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12.5 } } }
          },
          cutout: '64%'
        }
      }));
    }

    // Estructura de Gastos Operacionales
    const elGastos = document.getElementById('chart-gastos');
    if (elGastos) {
      const gastoLabels = Object.keys(model.gastosOp).map(k => ({
        personal: 'Personal',
        arrendamientos: 'Arrendamientos',
        mercadeo: 'Mercadeo',
        logistica: 'Logística',
        otros: 'Otros'
      }[k] || k));

      state.chartsInstances.push(new Chart(elGastos, {
        type: 'bar',
        data: {
          labels: gastoLabels,
          datasets: [{
            data: Object.values(model.gastosOp),
            backgroundColor: [blue, '#2E66F6', yellow, '#8B5CF6', gray],
            borderRadius: 6,
            maxBarThickness: 34
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#E8EDF5' } },
            y: { grid: { display: false } }
          }
        }
      }));
    }
  }

  /* ============================================================
     7. ANIMACIÓN DEL SCORE CIRCULAR
     ============================================================ */
  function animateRing(circleId, textId, value, radius) {
    const circle = document.getElementById(circleId);
    const textEl = document.getElementById(textId);
    if (!circle || !textEl) return;

    const circumference = 2 * Math.PI * radius;
    circle.setAttribute('stroke-dasharray', circumference.toFixed(1));
    circle.style.strokeDashoffset = circumference;

    const color = value >= 65 ? 'var(--green-500)' : value >= 40 ? 'var(--yellow-600)' : 'var(--red-500)';
    circle.style.stroke = color;

    requestAnimationFrame(() => {
      const offset = circumference - (value / 100) * circumference;
      circle.style.strokeDashoffset = offset;
    });

    let current = 0;
    const step = Math.max(1, Math.round(value / 30));
    const timer = setInterval(() => {
      current += step;
      if (current >= value) {
        current = value;
        clearInterval(timer);
      }
      textEl.innerHTML = current + '<span>/100</span>';
    }, 20);
  }

  /* ============================================================
     8. SCROLLSPY SIDEBAR
     ============================================================ */
  function setupScrollSpy() {
    const links = document.querySelectorAll('.sidebar-nav a');
    const sections = Array.from(links).map(l => document.querySelector(l.getAttribute('href')));

    window.removeEventListener('scroll', scrollSpyHandler);
    window.addEventListener('scroll', scrollSpyHandler, { passive: true });

    function scrollSpyHandler() {
      let currentIdx = 0;
      sections.forEach((sec, idx) => {
        if (sec && sec.getBoundingClientRect().top < 140) currentIdx = idx;
      });
      links.forEach((l, idx) => l.classList.toggle('active', idx === currentIdx));
    }
  }

  /* ============================================================
     9. CONVERSIÓN Y LLAMADOS A LA ACCIÓN (WHATSAPP & AGENDAMIENTO)
     ============================================================ */
  function openWhatsApp(customText = '') {
    const empresa = document.getElementById('inp-company')?.value.trim() || 'mi empresa';
    const score = state.lastDiagnosis?.reportData?.scoreTotal ? ` (Score: ${state.lastDiagnosis.reportData.scoreTotal}/100)` : '';

    // Si aún no está configurado el número oficial, abre un modal corporativo de atención
    if (!DYA_CONFIG.whatsappNumber || DYA_CONFIG.whatsappNumber.trim() === '') {
      openModal(
        '💬',
        'Línea Corporativa D&A Financial',
        `Nuestra línea directa de WhatsApp se encuentra en proceso de vinculación. Puedes solicitar el informe completo en PDF con el botón "Exportar informe" o escribirnos a contacto@dyafinancial.com para atender la auditoría de ${empresa}.`
      );
      return;
    }

    const msg = encodeURIComponent(
      customText ||
      `Hola equipo de D&A Financial, realicé el diagnóstico financiero inteligente para ${empresa}${score} y quiero revisar el acompañamiento financiero para mi empresa.`
    );
    window.open(`https://wa.me/${DYA_CONFIG.whatsappNumber}?text=${msg}`, '_blank');
  }

  document.querySelectorAll('.btn-trigger-whatsapp').forEach(btn => {
    btn.addEventListener('click', () => openWhatsApp());
  });

  // Modal genérico
  function openModal(icon, title, text) {
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modal = document.getElementById('modal');

    if (modalIcon) modalIcon.textContent = icon;
    if (modalTitle) modalTitle.textContent = title;
    if (modalText) modalText.textContent = text;
    if (modal) modal.classList.add('open');
  }

  document.getElementById('modal-close')?.addEventListener('click', () => {
    document.getElementById('modal')?.classList.remove('open');
  });

  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') e.currentTarget.classList.remove('open');
  });

  document.getElementById('btn-cta-asesoria')?.addEventListener('click', () => {
    openWhatsApp('Hola D&A Financial, quiero agendar una sesión estratégica de diagnóstico para mi empresa.');
  });

  document.getElementById('btn-cta-servicios')?.addEventListener('click', () => {
    document.getElementById('sec-servicios')?.scrollIntoView({ behavior: 'smooth' });
  });

  /* ============================================================
     10. EXPORTACIÓN DE INFORME PDF (NETLIFY FUNCTION)
     ============================================================ */
  const modalExport = document.getElementById('modal-export');
  const btnDownload = document.getElementById('btn-download');

  btnDownload?.addEventListener('click', () => {
    if (modalExport) modalExport.classList.add('open');
  });

  document.getElementById('exp-cancel')?.addEventListener('click', () => {
    if (modalExport) modalExport.classList.remove('open');
  });

  document.getElementById('exp-submit')?.addEventListener('click', async () => {
    const nombre = document.getElementById('exp-nombre')?.value.trim();
    const correo = document.getElementById('exp-correo')?.value.trim();
    const empresa = document.getElementById('exp-empresa')?.value.trim() || document.getElementById('inp-company')?.value.trim();
    const errorEl = document.getElementById('exp-error');
    const btn = document.getElementById('exp-submit');

    if (!nombre || nombre.length < 2 || !empresa || empresa.length < 2 || !EMAIL_REGEX.test(correo)) {
      if (errorEl) {
        errorEl.textContent = 'Por favor ingresa tu nombre completo, correo válido y nombre de empresa.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (errorEl) errorEl.style.display = 'none';

    const originalLabel = btn.textContent;
    btn.textContent = 'Generando y enviando informe...';
    btn.disabled = true;

    try {
      const payload = {
        nombre,
        correo,
        empresa,
        periodo: state.lastDiagnosis?.periodo || 'Periodo analizado',
        moneda: state.lastDiagnosis?.moneda || 'COP',
        reportData: state.lastDiagnosis?.reportData || {}
      };

      const res = await fetch('/.netlify/functions/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (modalExport) modalExport.classList.remove('open');

      if (res.ok && data.ok) {
        openModal('📩', '¡Informe enviado con éxito!', `Hemos generado y enviado el informe ejecutivo de ${empresa} a tu correo: ${correo}. Revisa también tu bandeja de correo no deseado por seguridad.`);
      } else {
        openModal('⚠️', 'Aviso de servicio', data.error || 'No se pudo completar el envío del informe. Si acabas de desplegar, verifica la configuración de variables de entorno.');
      }
    } catch (err) {
      if (modalExport) modalExport.classList.remove('open');
      openModal('⚠️', 'Error de conexión', 'No pudimos comunicar con el servidor para generar el PDF. Verifica tu conexión e intenta de nuevo.');
    } finally {
      btn.textContent = originalLabel;
      btn.disabled = false;
    }
  });

})();
