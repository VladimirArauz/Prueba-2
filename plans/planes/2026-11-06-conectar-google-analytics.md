# Conectar necutla.com con Google Analytics 4

- **Fecha:** 2026-11-06
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-11-06-conectar-google-analytics.md`
- **Alcance:** crear la propiedad de GA4 y publicar la etiqueta en el contenedor `GTM-MPJ9PMLR`, desde los paneles de Google. No se cambia código del sitio.

## Decisiones

- **Por Tag Manager, no con `gtag.js`:** el sitio ya carga el contenedor solo después de "Aceptar cookies". Pegar el fragmento de `gtag.js` lo bloquearía la CSP y se saltaría el aviso.
- **Sin modo de consentimiento:** Google no carga hasta que la persona acepta.
- **Sin Google Ads ni indicadores de Google:** la CSP solo permite Analytics sin Ads y el aviso de privacidad dice que no hay cookies de publicidad.
- **Sin filtro de tráfico interno por ahora:** en una red compartida de la escuela sacaría visitas reales, y un filtro activo es permanente.
- **Activador:** "Inicialización: Todos los eventos de inicialización", como indica la ayuda de Tag Manager.
- **Excepción a la regla 5 de `plans/CLAUDE.md`:** el prompt es para la extensión de Claude en Brave, que no tiene acceso al repositorio, así que no pide leer `plans/CLAUDE.md`.

## Fuentes

- https://developers.google.com/analytics/devguides/collection/ga4
- https://developers.google.com/analytics/devguides/collection/ga4/tag-options
- https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot
- https://support.google.com/analytics/answer/9304153
- https://support.google.com/tagmanager/answer/9442095
- https://support.google.com/analytics/answer/7667196
- https://support.google.com/analytics/answer/9445345
- https://support.google.com/analytics/answer/10104470

## Después de aplicarlo

Claude revisa con Chrome real que `gtm.js` traiga el ID `G-…` y que, tras aceptar las cookies, salga `/g/collect` sin errores de CSP. Las extensiones y Brave Shields pueden bloquear Analytics, así que una prueba en Brave no basta.
