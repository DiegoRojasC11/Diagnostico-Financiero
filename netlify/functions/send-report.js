/**
 * send-report.js
 * ---------------------------------------------------------------------
 * Netlify Function (serverless).
 *
 * Recibe los datos de contacto (nombre, correo, empresa) + los resultados
 * YA CALCULADOS del diagnóstico financiero (score, indicadores, alertas,
 * recomendaciones — nunca cifras crudas del Excel ni cálculos hechos por
 * la IA). Genera un PDF con esos resultados usando PDFKit y lo envía por
 * correo mediante Resend.
 *
 * IMPORTANTE — contrato de datos esperado en el body (JSON):
 * {
 *   nombre: string,
 *   correo: string,
 *   empresa: string,
 *   periodo: string,
 *   moneda: string,
 *   reportData: {
 *     scoreTotal: number,           // 0-100
 *     scoreLabel: string,           // "Salud financiera moderada", etc.
 *     resumenEjecutivo: string,
 *     conclusion: string,
 *     categorias: [{ name, status, text }],
 *     indicadores: [{ categoria, nombre, valor }],
 *     fortalezas: [{ title, text }],
 *     alertas: [{ title, text }],
 *     recomendaciones: [{ title, objetivo, acciones: [string], impacto }]
 *   }
 * }
 *
 * Variables de entorno requeridas (configurar en Netlify, NUNCA en el código):
 *   RESEND_API_KEY   -> tu clave de Resend
 *   RESEND_FROM       -> remitente verificado, ej: "Diagnóstico <diagnostico@tudominio.com>"
 *                        Si aún no tienes dominio verificado, usa el remitente de
 *                        pruebas de Resend y solo podrás enviar a tu propio correo
 *                        verificado en la cuenta.
 * ---------------------------------------------------------------------
 */

const { Resend } = require('resend');
const PDFDocument = require('pdfkit');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function validatePayload(payload) {
  const errors = [];
  if (!payload.nombre || String(payload.nombre).trim().length < 2) {
    errors.push('El nombre es obligatorio.');
  }
  if (!payload.correo || !EMAIL_REGEX.test(String(payload.correo).trim())) {
    errors.push('El correo electrónico no es válido.');
  }
  if (!payload.empresa || String(payload.empresa).trim().length < 2) {
    errors.push('El nombre de la empresa es obligatorio.');
  }
  if (!payload.reportData || typeof payload.reportData !== 'object') {
    errors.push('No se recibieron los resultados del diagnóstico.');
  }
  return errors;
}

/**
 * Construye el PDF en memoria a partir de los datos ya calculados.
 * Devuelve una Promise<Buffer>.
 */
function buildPdfBuffer({ nombre, empresa, periodo, moneda, reportData }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const navy = '#0A1E38';
      const blue = '#2E63E7';
      const gray = '#54617A';
      const green = '#177A50';
      const yellow = '#8A5B04';
      const red = '#B3232C';

      const tierColor = (tier) => (tier === 'green' ? green : tier === 'yellow' ? yellow : red);

      // Encabezado
      doc.fillColor('#B8860B').fontSize(11).font('Helvetica-Bold').text('DyA FINANCIAL · AUDITORÍA CORPORATIVA', { align: 'left' });
      doc.moveDown(0.2);
      doc.fillColor(navy).fontSize(20).font('Helvetica-Bold').text('Diagnóstico Financiero Estratégico', { align: 'left' });
      doc.moveDown(0.3);
      doc.fillColor(gray).fontSize(10).font('Helvetica')
        .text(`Empresa: ${empresa}    ·    Periodo: ${periodo || '-'}    ·    Moneda: ${moneda || 'COP'}`);
      doc.moveDown(1);

      // Score
      doc.fillColor(navy).fontSize(14).font('Helvetica-Bold').text('Salud financiera general');
      doc.moveDown(0.2);
      doc.fillColor(blue).fontSize(28).font('Helvetica-Bold').text(`${reportData.scoreTotal ?? '-'} / 100`);
      doc.fillColor(gray).fontSize(11).font('Helvetica').text(reportData.scoreLabel || '');
      doc.moveDown(0.6);
      if (reportData.resumenEjecutivo) {
        doc.fillColor('#111A2B').fontSize(10.5).font('Helvetica').text(reportData.resumenEjecutivo, { align: 'justify' });
      }
      doc.moveDown(1);

      // Indicadores por categoría
      if (Array.isArray(reportData.indicadores) && reportData.indicadores.length) {
        doc.fillColor(navy).fontSize(14).font('Helvetica-Bold').text('Indicadores financieros');
        doc.moveDown(0.4);
        const grouped = {};
        reportData.indicadores.forEach((i) => {
          grouped[i.categoria] = grouped[i.categoria] || [];
          grouped[i.categoria].push(i);
        });
        Object.entries(grouped).forEach(([cat, items]) => {
          doc.fillColor(blue).fontSize(11).font('Helvetica-Bold').text(cat);
          items.forEach((it) => {
            doc.fillColor('#111A2B').fontSize(10).font('Helvetica')
              .text(`•  ${it.nombre}:  ${it.valor}`, { indent: 10 });
          });
          doc.moveDown(0.3);
        });
        doc.moveDown(0.5);
      }

      // Análisis por categoría
      if (Array.isArray(reportData.categorias) && reportData.categorias.length) {
        doc.addPage();
        doc.fillColor(navy).fontSize(14).font('Helvetica-Bold').text('Análisis gerencial');
        doc.moveDown(0.4);
        reportData.categorias.forEach((c) => {
          doc.fillColor(tierColor(c.tier)).fontSize(11).font('Helvetica-Bold').text(`${c.name} — ${c.status}`);
          doc.fillColor('#111A2B').fontSize(10).font('Helvetica').text(c.text, { align: 'justify' });
          doc.moveDown(0.5);
        });
      }

      // Fortalezas y alertas
      if (Array.isArray(reportData.fortalezas) && reportData.fortalezas.length) {
        doc.moveDown(0.5);
        doc.fillColor(green).fontSize(13).font('Helvetica-Bold').text('Fortalezas');
        reportData.fortalezas.forEach((f) => {
          doc.fillColor('#111A2B').fontSize(10).font('Helvetica-Bold').text(f.title);
          doc.fillColor(gray).fontSize(9.5).font('Helvetica').text(f.text);
          doc.moveDown(0.2);
        });
      }
      if (Array.isArray(reportData.alertas) && reportData.alertas.length) {
        doc.moveDown(0.5);
        doc.fillColor(red).fontSize(13).font('Helvetica-Bold').text('Alertas');
        reportData.alertas.forEach((a) => {
          doc.fillColor('#111A2B').fontSize(10).font('Helvetica-Bold').text(a.title);
          doc.fillColor(gray).fontSize(9.5).font('Helvetica').text(a.text);
          doc.moveDown(0.2);
        });
      }

      // Recomendaciones
      if (Array.isArray(reportData.recomendaciones) && reportData.recomendaciones.length) {
        doc.addPage();
        doc.fillColor(navy).fontSize(14).font('Helvetica-Bold').text('Recomendaciones prioritarias');
        doc.moveDown(0.4);
        reportData.recomendaciones.forEach((r, idx) => {
          doc.fillColor(blue).fontSize(11).font('Helvetica-Bold').text(`${idx + 1}. ${r.title}`);
          doc.fillColor('#111A2B').fontSize(9.5).font('Helvetica').text(`Objetivo: ${r.objetivo}`);
          if (Array.isArray(r.acciones)) {
            r.acciones.forEach((a) => doc.fillColor(gray).fontSize(9.5).text(`   •  ${a}`));
          }
          doc.fillColor(green).fontSize(9.5).font('Helvetica-Bold').text(`Impacto esperado: ${r.impacto}`);
          doc.moveDown(0.5);
        });
      }

      // Conclusión
      if (reportData.conclusion) {
        doc.moveDown(0.5);
        doc.fillColor(navy).fontSize(13).font('Helvetica-Bold').text('Conclusión');
        doc.fillColor('#111A2B').fontSize(10).font('Helvetica').text(reportData.conclusion, { align: 'justify' });
      }

      doc.moveDown(1.5);
      doc.fillColor('#98A5B8').fontSize(8).font('Helvetica')
        .text('Este informe es una auditoría diagnóstica automatizada emitida por DyA Financial. Para asesoría y acompañamiento financiero corporativo contáctanos en contacto@dyafinancial.com', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'JSON inválido.' });
  }

  const errors = validatePayload(payload);
  if (errors.length) {
    return jsonResponse(400, { error: errors.join(' ') });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('Falta configurar RESEND_API_KEY en las variables de entorno de Netlify.');
    return jsonResponse(500, { error: 'El servicio de correo no está configurado todavía. Contacta al administrador.' });
  }

  try {
    const pdfBuffer = await buildPdfBuffer({
      nombre: payload.nombre,
      empresa: payload.empresa,
      periodo: payload.periodo,
      moneda: payload.moneda,
      reportData: payload.reportData
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM || 'DyA Financial <onboarding@resend.dev>';

    const { error } = await resend.emails.send({
      from,
      to: payload.correo,
      subject: `Tu Diagnóstico Financiero Estratégico — ${payload.empresa} | DyA Financial`,
      html: `
        <div style="font-family: sans-serif; color: #111A2B; line-height: 1.6; max-width: 600px;">
          <h2 style="color: #0A1E38; margin-bottom: 12px;">Hola ${payload.nombre},</h2>
          <p>Adjunto encontrarás el informe oficial en PDF de tu <b>Diagnóstico Financiero Estratégico</b> para <b>${payload.empresa}</b>, elaborado por el motor analítico de <b>DyA Financial</b>.</p>
          <p>Este informe detalla tu índice de salud financiera, alertas prioritarias en liquidez y recomendaciones para optimizar el flujo de caja y capital de trabajo de tu negocio.</p>
          <div style="margin: 24px 0; padding: 18px; background: #F4F6FB; border-left: 4px solid #1E50D6; border-radius: 6px;">
            <p style="margin: 0; font-weight: bold; color: #0A1E38;">¿Quieres estructurar el plan de acción con un consultor?</p>
            <p style="margin: 6px 0 0; font-size: 14px; color: #4B5872;">Responde directamente a este correo o escríbenos para agendar una sesión de acompañamiento financiero con nuestro equipo.</p>
          </div>
          <p style="font-size: 13px; color: #75839A; margin-top: 24px;">Atentamente,<br><b>Equipo de Consultoría Financiera</b><br>DyA Financial</p>
        </div>
      `,
      attachments: [
        {
          filename: `dya-diagnostico-financiero-${payload.empresa.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          content: pdfBuffer.toString('base64')
        }
      ]
    });

    // Guardado automático del prospecto en Google Sheets
    await saveLeadToGoogleSheets({
      nombre: payload.nombre,
      correo: payload.correo,
      empresa: payload.empresa,
      sector: payload.sector,
      periodo: payload.periodo,
      moneda: payload.moneda,
      reportData: payload.reportData
    });

    return jsonResponse(200, { ok: true, message: 'Informe generado y enviado correctamente.' });
  } catch (err) {
    console.error('Error generando/enviando el PDF:', err);
    return jsonResponse(500, { error: 'Ocurrió un error generando el informe.' });
  }
};

/**
 * Envía los datos del lead a un Webhook de Google Sheets (Google Apps Script)
 * y los registra en los logs de Netlify para que nunca se pierda ningún contacto.
 */
async function saveLeadToGoogleSheets({ nombre, correo, empresa, sector, periodo, moneda, reportData }) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const leadRecord = {
    fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    nombre,
    correo,
    empresa,
    sector: sector || 'Comercio',
    periodo: periodo || '-',
    moneda: moneda || 'COP',
    score: reportData?.scoreTotal ?? 0,
    salud: reportData?.scoreLabel || 'No clasificado',
    resumen: reportData?.resumenEjecutivo ? reportData.resumenEjecutivo.slice(0, 300) : ''
  };

  console.log('[D&A FINANCIAL - NUEVO LEAD CAPTURADO]:', JSON.stringify(leadRecord, null, 2));

  if (!webhookUrl) {
    console.log('[GOOGLE SHEETS]: Variable GOOGLE_SHEETS_WEBHOOK_URL no configurada aún. Lead preservado en logs.');
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(leadRecord),
      redirect: 'follow'
    });
    const responseText = await res.text();
    console.log('[GOOGLE SHEETS]: Respuesta del Webhook:', res.status, responseText.slice(0, 200));
  } catch (err) {
    console.error('[GOOGLE SHEETS]: Error al transmitir datos a Google Sheets:', err.message);
  }
}
