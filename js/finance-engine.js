/**
 * DyA Financial — Motor de Modelado y Cálculo Financiero
 * ---------------------------------------------------------------------
 * Contiene la lógica pura, determinista y matemáticamente exacta
 * para estructurar balances, calcular ratios bajo normas contables (NIIF),
 * computar el score global de salud financiera y generar diagnósticos
 * gerenciales estructurados.
 * ---------------------------------------------------------------------
 */

const FinanceEngine = (() => {
  'use strict';

  // Datos de demostración de una empresa comercial colombiana (consistencia contable A = P + P)
  const demoRawData = {
    periodos: ['2022', '2023', '2024', '2025', '2026'],
    ingresosHistoricos: [2420, 2610, 2790, 2960, 3180],
    utilidadNetaHistorica: [58, 74, 96, 112, 138],
    balance: {
      activoCorriente: { efectivo: 140, cartera: 410, inventarios: 320, otros: 60 },
      activoNoCorriente: { ppe: 780, otros: 140 },
      pasivoCorriente: { proveedores: 260, obligacionesFinancierasCP: 180, otros: 210 },
      pasivoNoCorriente: { obligacionesFinancierasLP: 380, otros: 120 }
    },
    pyg: {
      ingresos: 3180,
      costoVentas: 2099,
      gastosOperacionales: { personal: 320, arrendamientos: 120, mercadeo: 95, logistica: 150, otros: 110 },
      gastosFinancieros: 89,
      impuestos: 59
    }
  };

  /**
   * Normaliza y valida la estructura contable de entrada
   */
  function buildFinancialModel(raw) {
    const ac = raw.balance.activoCorriente || {};
    const anc = raw.balance.activoNoCorriente || {};
    const pc = raw.balance.pasivoCorriente || {};
    const pnc = raw.balance.pasivoNoCorriente || {};

    const totalActivoCorriente = (ac.efectivo || 0) + (ac.cartera || 0) + (ac.inventarios || 0) + (ac.otros || 0);
    const totalActivoNoCorriente = (anc.ppe || 0) + (anc.otros || 0);
    const totalActivos = totalActivoCorriente + totalActivoNoCorriente;

    const totalPasivoCorriente = (pc.proveedores || 0) + (pc.obligacionesFinancierasCP || 0) + (pc.otros || 0);
    const totalPasivoNoCorriente = (pnc.obligacionesFinancierasLP || 0) + (pnc.otros || 0);
    const totalPasivos = totalPasivoCorriente + totalPasivoNoCorriente;

    // Ecuación Patrimonial
    const totalPatrimonio = totalActivos - totalPasivos;

    // Estado de Resultados
    const pyg = raw.pyg || {};
    const ingresos = pyg.ingresos || 0;
    const costoVentas = pyg.costoVentas || 0;
    const gastosOp = pyg.gastosOperacionales || {};
    const totalGastosOperacionales = Object.values(gastosOp).reduce((acc, val) => acc + (Number(val) || 0), 0);

    const utilidadBruta = ingresos - costoVentas;
    const utilidadOperacional = utilidadBruta - totalGastosOperacionales; // EBIT
    const gastosFinancieros = pyg.gastosFinancieros || 0;
    const utilidadAntesImpuestos = utilidadOperacional - gastosFinancieros;
    const impuestos = pyg.impuestos || 0;
    const utilidadNeta = utilidadAntesImpuestos - impuestos;

    // Capital de Trabajo Neto Operativo (KTNO) = Cartera + Inventarios - Proveedores
    const ktno = (ac.cartera || 0) + (ac.inventarios || 0) - (pc.proveedores || 0);

    return {
      ac, anc, pc, pnc,
      totalActivoCorriente, totalActivoNoCorriente, totalActivos,
      totalPasivoCorriente, totalPasivoNoCorriente, totalPasivos, totalPatrimonio,
      ingresos, costoVentas, utilidadBruta,
      gastosOp, totalGastosOperacionales,
      utilidadOperacional, gastosFinancieros,
      utilidadAntesImpuestos, impuestos, utilidadNeta,
      ktno,
      ingresosHistoricos: raw.ingresosHistoricos || [ingresos],
      utilidadNetaHistorica: raw.utilidadNetaHistorica || [utilidadNeta],
      periodos: raw.periodos || ['Actual']
    };
  }

  /**
   * Fórmulas financieras individuales
   */
  function calculateCurrentRatio(m) {
    return m.totalPasivoCorriente > 0 ? (m.totalActivoCorriente / m.totalPasivoCorriente) : 0;
  }

  function calculateQuickRatio(m) {
    return m.totalPasivoCorriente > 0 ? ((m.totalActivoCorriente - (m.ac.inventarios || 0)) / m.totalPasivoCorriente) : 0;
  }

  function calculateWorkingCapital(m) {
    return m.totalActivoCorriente - m.totalPasivoCorriente;
  }

  function calculateGrossMargin(m) {
    return m.ingresos > 0 ? (m.utilidadBruta / m.ingresos) * 100 : 0;
  }

  function calculateOperatingMargin(m) {
    return m.ingresos > 0 ? (m.utilidadOperacional / m.ingresos) * 100 : 0;
  }

  function calculateNetMargin(m) {
    return m.ingresos > 0 ? (m.utilidadNeta / m.ingresos) * 100 : 0;
  }

  function calculateROA(m) {
    return m.totalActivos > 0 ? (m.utilidadNeta / m.totalActivos) * 100 : 0;
  }

  function calculateROE(m) {
    return m.totalPatrimonio > 0 ? (m.utilidadNeta / m.totalPatrimonio) * 100 : 0;
  }

  function calculateDebtRatio(m) {
    return m.totalActivos > 0 ? (m.totalPasivos / m.totalActivos) * 100 : 0;
  }

  function calculateFinancialDebtRatio(m) {
    const deudaFinanciera = (m.pc.obligacionesFinancierasCP || 0) + (m.pnc.obligacionesFinancierasLP || 0);
    return m.totalActivos > 0 ? (deudaFinanciera / m.totalActivos) * 100 : 0;
  }

  function calculateInterestCoverage(m) {
    return m.gastosFinancieros > 0 ? (m.utilidadOperacional / m.gastosFinancieros) : 99;
  }

  function calculateDSO(m) {
    return m.ingresos > 0 ? ((m.ac.cartera || 0) / m.ingresos) * 365 : 0;
  }

  function calculateDIO(m) {
    return m.costoVentas > 0 ? ((m.ac.inventarios || 0) / m.costoVentas) * 365 : 0;
  }

  function calculateDPO(m) {
    return m.costoVentas > 0 ? ((m.pc.proveedores || 0) / m.costoVentas) * 365 : 0;
  }

  function calculateCashConversionCycle(m) {
    return calculateDSO(m) + calculateDIO(m) - calculateDPO(m);
  }

  function calculateRevenueGrowth(m) {
    const h = m.ingresosHistoricos;
    if (!h || h.length < 2) return 0;
    const anterior = h[h.length - 2];
    const actual = h[h.length - 1];
    return anterior > 0 ? ((actual - anterior) / anterior) * 100 : 0;
  }

  /**
   * Consolida todos los ratios clave
   */
  function computeIndicators(m) {
    return {
      currentRatio: calculateCurrentRatio(m),
      quickRatio: calculateQuickRatio(m),
      workingCapital: calculateWorkingCapital(m),
      ktno: m.ktno,
      grossMargin: calculateGrossMargin(m),
      operatingMargin: calculateOperatingMargin(m),
      netMargin: calculateNetMargin(m),
      roa: calculateROA(m),
      roe: calculateROE(m),
      debtRatio: calculateDebtRatio(m),
      financialDebtRatio: calculateFinancialDebtRatio(m),
      interestCoverage: calculateInterestCoverage(m),
      dso: calculateDSO(m),
      dio: calculateDIO(m),
      dpo: calculateDPO(m),
      ccc: calculateCashConversionCycle(m),
      revenueGrowth: calculateRevenueGrowth(m)
    };
  }

  /**
   * Motor de puntuación por interpolación lineal
   */
  function scoreFromRange(value, bad, mid, good) {
    const higherBetter = good > mid;
    if (higherBetter) {
      if (value <= bad) return 0;
      if (value >= good) return 100;
      if (value <= mid) return ((value - bad) / (mid - bad)) * 50;
      return 50 + ((value - mid) / (good - mid)) * 50;
    } else {
      if (value >= bad) return 0;
      if (value <= good) return 100;
      if (value >= mid) return ((bad - value) / (bad - mid)) * 50;
      return 50 + ((mid - value) / (mid - good)) * 50;
    }
  }

  function statusFromScore(score, isGestion = false) {
    if (score >= 65) return { label: 'Saludable', tier: 'green' };
    if (score >= 40) return { label: 'Atención', tier: 'yellow' };
    return { label: isGestion ? 'Prioridad de Optimización' : 'Riesgo Crítico', tier: 'red' };
  }

  /**
   * Calcula el Score Global de Salud Financiera (0 a 100)
   */
  function computeHealthScore(ind) {
    const currentRatioScore = scoreFromRange(ind.currentRatio, 0.8, 1.2, 1.8);
    const quickRatioScore = scoreFromRange(ind.quickRatio, 0.5, 0.9, 1.3);
    const liquidezScore = (currentRatioScore + quickRatioScore) / 2;

    const grossScore = scoreFromRange(ind.grossMargin, 15, 25, 40);
    const opScore = scoreFromRange(ind.operatingMargin, 2, 7, 15);
    const netScore = scoreFromRange(ind.netMargin, 1, 4, 10);
    const roaScore = scoreFromRange(ind.roa, 2, 6, 12);
    const roeScore = scoreFromRange(ind.roe, 5, 12, 22);
    const rentabilidadScore = (grossScore + opScore + netScore + roaScore + roeScore) / 5;

    const debtScore = scoreFromRange(ind.debtRatio, 80, 55, 35);
    const finDebtScore = scoreFromRange(ind.financialDebtRatio, 45, 30, 15);
    const coverageScore = scoreFromRange(ind.interestCoverage, 1.2, 2.5, 5);
    const endeudamientoScore = (debtScore + finDebtScore + coverageScore) / 3;

    const dsoScore = scoreFromRange(ind.dso, 90, 55, 30);
    const dioScore = scoreFromRange(ind.dio, 90, 55, 30);
    const cccScore = scoreFromRange(ind.ccc, 100, 60, 30);
    const gestionScore = (dsoScore + dioScore + cccScore) / 3;

    const crecimientoScore = scoreFromRange(ind.revenueGrowth, 0, 5, 12);

    const weights = {
      liquidez: 0.20,
      rentabilidad: 0.25,
      endeudamiento: 0.20,
      gestion: 0.20,
      crecimiento: 0.15
    };

    const total = (
      liquidezScore * weights.liquidez +
      rentabilidadScore * weights.rentabilidad +
      endeudamientoScore * weights.endeudamiento +
      gestionScore * weights.gestion +
      crecimientoScore * weights.crecimiento
    );

    return {
      total: Math.round(total),
      categories: {
        liquidez: { score: liquidezScore, weight: weights.liquidez, ...statusFromScore(liquidezScore) },
        rentabilidad: { score: rentabilidadScore, weight: weights.rentabilidad, ...statusFromScore(rentabilidadScore) },
        endeudamiento: { score: endeudamientoScore, weight: weights.endeudamiento, ...statusFromScore(endeudamientoScore) },
        gestion: { score: gestionScore, weight: weights.gestion, ...statusFromScore(gestionScore, true) },
        crecimiento: { score: crecimientoScore, weight: weights.crecimiento, ...statusFromScore(crecimientoScore) }
      }
    };
  }

  function healthCategoryLabel(total) {
    if (total >= 75) return 'Salud Financiera Sólida';
    if (total >= 55) return 'Salud Financiera Moderada';
    if (total >= 40) return 'Salud Financiera con Alertas Importantes';
    return 'Salud Financiera en Estado Crítico';
  }

  /**
   * Generación estructurada del diagnóstico gerencial
   */
  function generateFinancialAnalysis(m, ind, health, companyInfo = {}) {
    const f2 = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    const f0 = (n) => Math.round(Number(n)).toLocaleString('es-CO');
    const cop = (n) => '$' + f0(n) + ' ' + (companyInfo.moneda === 'COP' ? 'MM' : (companyInfo.moneda || 'COP'));

    const resumenEjecutivo = `Durante el periodo auditado, la empresa presenta una posición de liquidez ${health.categories.liquidez.tier === 'green' ? 'sólida' : 'ajustada'} y una rentabilidad ${health.categories.rentabilidad.tier === 'green' ? 'positiva y competitiva' : 'moderada'}. No obstante, el diagnóstico de D&A Financial detecta oportunidades determinantes en el ciclo de conversión de efectivo (${Math.round(ind.ccc)} días) y la absorción de caja por capital de trabajo (KTNO de ${cop(m.ktno)}), factores que amenazan la liquidez de corto plazo si no se interviene la cartera y los gastos operativos.`;

    const analisisGeneral = `Los ingresos muestran una tasa de variación de ${f2(ind.revenueGrowth)}% respecto al ejercicio anterior. Sin embargo, la estructura de costos y gastos operativos (${f2((m.totalGastosOperacionales / m.ingresos) * 100)}% de los ingresos) comprime el margen operacional a ${f2(ind.operatingMargin)}%. La empresa preserva un margen neto de ${f2(ind.netMargin)}%, indicando rentabilidad pero evidenciando una fuga de valor en la conversión de ingresos a flujo de caja libre.`;

    const categorias = [
      {
        key: 'liquidez',
        name: 'Liquidez y Cobertura',
        status: health.categories.liquidez.label,
        tier: health.categories.liquidez.tier,
        text: `La razón corriente de ${ind.currentRatio.toFixed(2)}x confirma que la compañía dispone de $${ind.currentRatio.toFixed(2)} en activos corrientes por cada peso exigible a corto plazo. ${ind.quickRatio < 1 ? 'Sin embargo, la prueba ácida (' + ind.quickRatio.toFixed(2) + 'x) se ubica por debajo de la paridad (1.0x), lo que indica que la empresa depende de la rotación acelerada de sus inventarios para honrar sus compromisos inmediatos.' : 'La prueba ácida de ' + ind.quickRatio.toFixed(2) + 'x respalda una capacidad de pago inmediata sin requerir la liquidación forzosa de inventarios.'}`
      },
      {
        key: 'rentabilidad',
        name: 'Rentabilidad y Eficiencia Operativa',
        status: health.categories.rentabilidad.label,
        tier: health.categories.rentabilidad.tier,
        text: `El margen neto se sitúa en ${f2(ind.netMargin)}%, generando un retorno sobre el patrimonio (ROE) de ${f2(ind.roe)}% y sobre los activos (ROA) de ${f2(ind.roa)}%. Aunque la operación es superavitaria, el margen operativo (${f2(ind.operatingMargin)}%) sugiere margen de optimización mediante control riguroso de centros de costos y gastos fijos.`
      },
      {
        key: 'endeudamiento',
        name: 'Endeudamiento y Apalancamiento',
        status: health.categories.endeudamiento.label,
        tier: health.categories.endeudamiento.tier,
        text: `El nivel de endeudamiento total asciende al ${f2(ind.debtRatio)}% sobre los activos totales, con una concentración financiera del ${f2(ind.financialDebtRatio)}%. La cobertura de intereses de ${ind.interestCoverage.toFixed(1)}x es suficiente para atender el servicio de deuda, pero reduce la flexibilidad ante contingencias macroeconómicas o contracciones de mercado.`
      },
      {
        key: 'gestion',
        name: 'Capital de Trabajo y Ciclo de Caja',
        status: health.categories.gestion.label,
        tier: health.categories.gestion.tier,
        text: `El Ciclo de Conversión de Efectivo (CCC) se prolonga a ${Math.round(ind.ccc)} días (Cartera: ${Math.round(ind.dso)} días, Inventario: ${Math.round(ind.dio)} días, Proveedores: ${Math.round(ind.dpo)} días). Esto significa que la empresa financia la operación con recursos propios durante casi ${Math.round(ind.ccc)} días antes de monetizar sus ventas, un cuello de botella que exige acompañamiento especializado.`
      }
    ];

    const fortalezas = [];
    if (ind.netMargin > 0) {
      fortalezas.push({
        icon: '🟢',
        title: 'Generación de Utilidad Neta Positiva',
        text: `La operación entrega una utilidad neta de ${cop(m.utilidadNeta)}, manteniendo viabilidad financiera en el ejercicio.`
      });
    }
    if (ind.interestCoverage >= 2) {
      fortalezas.push({
        icon: '🟢',
        title: 'Cobertura Operativa de Intereses',
        text: `El EBIT cubre ${ind.interestCoverage.toFixed(1)} veces el gasto financiero, protegiendo a la empresa de insolvencia inmediata con el sector bancario.`
      });
    }
    if (ind.revenueGrowth > 3) {
      fortalezas.push({
        icon: '🟢',
        title: 'Tracción y Expansión Comercial',
        text: `Las ventas reportan un incremento de ${f2(ind.revenueGrowth)}%, demostrando posicionamiento de mercado y demanda activa.`
      });
    }
    if (ind.grossMargin >= 30) {
      fortalezas.push({
        icon: '🟢',
        title: 'Margen de Contribución Robusto',
        text: `El margen bruto de ${f2(ind.grossMargin)}% ofrece una base comercial sólida para absorber los gastos operativos y generar excedentes.`
      });
    }

    const alertas = [];
    if (ind.dso > 45) {
      alertas.push({
        icon: '🟡',
        tier: 'yellow',
        title: 'Periodo de Cobro Dilatado (DSO)',
        text: `El plazo de recaudo de ${Math.round(ind.dso)} días excede los estándares saludables de liquidez y debilita el flujo de caja operativo.`
      });
    }
    const gastoOpPct = (m.totalGastosOperacionales / m.ingresos) * 100;
    if (gastoOpPct > 20) {
      alertas.push({
        icon: '🟡',
        tier: 'yellow',
        title: 'Presión de Gastos Operacionales',
        text: `Los gastos operativos absorben el ${f2(gastoOpPct)}% de la facturación total; se requiere auditar los rubros con mayor aceleración (arriendos, nómina, logística).`
      });
    }
    if (ind.ccc > 45) {
      alertas.push({
        icon: '🔴',
        tier: 'red',
        title: 'Ciclo de Conversión de Efectivo Excesivo',
        text: `Con ${Math.round(ind.ccc)} días de ciclo de caja, la compañía experimenta tensiones continuas de liquidez y necesidad recurrente de sobregiros o crédito costoso.`
      });
    }
    if (ind.debtRatio > 55) {
      alertas.push({
        icon: '🟡',
        tier: 'yellow',
        title: 'Nivel de Apalancamiento Elevado',
        text: `El ${f2(ind.debtRatio)}% de los activos pertenece a terceros, restringiendo el acceso a nueva financiación de proyectos de inversión.`
      });
    }

    const recomendaciones = [
      {
        title: 'Optimización de Cartera y Políticas de Crédito',
        objetivo: 'Reducir el plazo medio de cobro (DSO) en al menos 20 días para liberar caja inmediata.',
        acciones: [
          'Auditar la cartera vencida mayor a 60 días y negociar acuerdos de pago con descuento por pronto pago.',
          'Reestructurar la matriz de límites de crédito por perfil de riesgo de cliente.',
          'Establecer un protocolo automatizado de alertas de vencimiento preventivo.'
        ],
        impacto: 'Inyección de liquidez líquida sin incurrir en deuda bancaria adicional.'
      },
      {
        title: 'Control Estricto de Estructura de Costos y Gastos',
        objetivo: 'Expandir el margen operacional en un rango de 2% a 4% del ingreso neto.',
        acciones: [
          'Segmentar gastos operacionales por centro de costo y separar gastos estratégicos de discrecionales.',
          'Renegociar contratos con proveedores clave y operadores logísticos.',
          'Implementar un presupuesto base cero para rubros de apoyo administrativo.'
        ],
        impacto: 'Incremento directo en el EBITDA y mayor capacidad de reinversión.'
      },
      {
        title: 'Implementación de Modelo de Flujo de Caja Proyectado (CFO On-Demand)',
        objetivo: 'Anticipar necesidades de liquidez a 13 semanas y eliminar el riesgo de iliquidez imprevista.',
        acciones: [
          'Construir un tablero dinámico de flujo de caja proyectado semana a semana.',
          'Diseñar comités financieros quincenales para toma de decisiones tácticas con el equipo directivo.',
          'Vincular el acompañamiento financiero continuo de D&A Financial para supervisar la ejecución del plan.'
        ],
        impacto: 'Control total de la tesorería y estabilidad financiera de largo plazo.'
      }
    ];

    const conclusion = `La empresa demuestra una base operacional rentable y en crecimiento, pero enfrenta un estrés estructural en su capital de trabajo y en la recuperación de caja. Las recomendaciones prioritarias exigen una intervención gerencial inmediata sobre la cartera y los costos operativos. D&A Financial está a su disposición para liderar este acompañamiento estratégico y asegurar que los beneficios se reflejen en la cuenta bancaria del negocio.`;

    const scoreExplain = `El puntaje obtenido sitúa a la empresa en ${healthCategoryLabel(health.total).toLowerCase()} (${health.total}/100). Aunque los márgenes son positivos, el riesgo latente en el ciclo de efectivo justifica un acompañamiento financiero riguroso.`;

    return {
      resumenEjecutivo,
      analisisGeneral,
      categorias,
      fortalezas,
      alertas,
      recomendaciones,
      conclusion,
      scoreExplain
    };
  }

  return {
    demoRawData,
    buildFinancialModel,
    computeIndicators,
    scoreFromRange,
    computeHealthScore,
    healthCategoryLabel,
    generateFinancialAnalysis
  };
})();

// Exportación para entornos Node.js / Netlify Functions si fuera necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FinanceEngine;
}
