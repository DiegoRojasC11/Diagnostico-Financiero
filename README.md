# Diagnóstico Financiero Inteligente — Backend de envío de PDF

## ¿Qué se construyó?

- `index.html` — el mismo dashboard que ya tenías, con un modal nuevo en el
  botón "Exportar informe" que pide Nombre, Correo y Empresa, y envía esos
  datos + el diagnóstico calculado al backend.
- `netlify/functions/send-report.js` — función serverless que genera el PDF
  (con PDFKit, a partir de los datos ya calculados por el frontend, sin
  Puppeteer) y lo envía por correo con Resend.
- `netlify.toml` — configuración de Netlify (carpeta de funciones, redirect).
- `package.json` — dependencias del backend (`resend`, `pdfkit`).

## Paso a paso para dejarlo funcionando

### 1. Súbelo a GitHub
Crea un repositorio nuevo y sube esta carpeta completa (`index.html`,
`netlify.toml`, `package.json`, `netlify/`).

```bash
git init
git add .
git commit -m "MVP: envío de diagnóstico en PDF por correo"
git branch -M main
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

### 2. Conecta el repo a Netlify
En [app.netlify.com](https://app.netlify.com) → **Add new site → Import an
existing project** → elige tu repo de GitHub. Netlify detectará
automáticamente `netlify.toml`.

### 3. Crea tu cuenta de Resend
Ve a [resend.com](https://resend.com) → crea una cuenta gratis (no pide
tarjeta) → copia tu **API Key**.

### 4. Configura las variables de entorno en Netlify
En tu sitio → **Site settings → Environment variables**, agrega:

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | tu clave de Resend |
| `RESEND_FROM` | (opcional por ahora) `Diagnóstico <onboarding@resend.dev>` |

Sin dominio propio verificado, solo podrás enviar correos a la dirección de
correo con la que creaste tu cuenta de Resend — es la única forma en que
Resend permite probar sin dominio. Cuando compres tu dominio, verifícalo en
Resend (3 registros DNS) y cambia `RESEND_FROM` a algo como
`Diagnóstico <diagnostico@tudominio.com>`.

### 5. Redeploy
Cualquier cambio en las variables de entorno requiere un **redeploy** manual
(Netlify → Deploys → Trigger deploy) para que la función las tome.

## Cómo probarlo

1. Abre el sitio publicado por Netlify (o corre `netlify dev` localmente si
   tienes la Netlify CLI instalada — así puedes probar la función sin
   desplegar).
2. Completa el diagnóstico con los datos de demo.
3. En el dashboard, clic en **"Exportar informe"**.
4. Llena Nombre / Correo (usa el correo con el que creaste tu cuenta de
   Resend mientras no tengas dominio verificado) / Empresa.
5. Clic en **"Enviar informe"**. Deberías recibir el PDF en unos segundos.

## Qué errores buscar

- **"El servicio de correo no está configurado todavía"** → falta
  `RESEND_API_KEY` en Netlify o no hiciste redeploy después de agregarla.
- **Error 403/422 de Resend en los logs de la función** (Netlify →
  Functions → send-report → Logs) → normalmente significa que intentaste
  enviar a un correo distinto al de tu cuenta, sin dominio verificado.
- **El PDF llega vacío o con errores de formato** → revisa que
  `lastDiagnosis` se esté llenando correctamente (debe ejecutarse
  `buildDashboard()` antes de exportar).

## Qué falta para la siguiente fase

- Guardar cada lead (nombre, correo, empresa, fecha) en una base de datos o
  CRM real — hoy solo se usa para enviar el correo y no queda registrado en
  ningún lado (hay un `TODO` marcado en `send-report.js`).
- Mover el cálculo del diagnóstico (hoy en `demoRawData`, hardcodeado) a un
  parser real de los Excel que suba el usuario.
- Verificar tu dominio propio en Resend para que los correos no dependan de
  tu cuenta personal y no caigan en spam.
- Rate limiting / protección anti-abuso en la función (para que nadie
  spamee el endpoint).
