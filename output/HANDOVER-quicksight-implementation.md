# Handover: Implementación de QuickSight Embedded Visuals

## Resumen Ejecutivo

Se desarrolló un **proof of concept (PoC)** para evaluar la integración de **Amazon QuickSight** como reemplazo de Metabase para el embedding de dashboards y visualizaciones en el portal InControl.

**Resultado:** El board de decisión aprobó el enfoque de **Visual Embedding con filtros nativos** implementado en el Fee Dashboard.

**Repositorio:** `incontrol-metabase-demo` (branch: `feature/fee-library`)

---

## Dos Modalidades de Embedding Implementadas

### 1. Dashboard Embedding (Fee Library)
- Embebe un **dashboard completo** de QuickSight dentro de un iframe
- QuickSight controla todos los filtros y la navegación interna
- Implementación simple: una sola URL de embed
- **Dashboard ID:** `5a53241b-0a3f-4b6a-a3c8-d0afc2e4e2cf`

### 2. Visual Embedding con Filtros Nativos (Fee Dashboard) ← **APROBADO**
- Embebe **cada visual individual** como un iframe separado
- El frontend controla los filtros y el layout (grid responsive)
- Permite mezclar contenido propio con visuales de QuickSight
- 8 visuales individuales organizados en un grid de 2 columnas
- **Dashboard ID:** `4ecd3350-2b80-4ac1-b1da-8819819f5f2f`

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                     │
│                                                           │
│  ┌─────────────────┐    ┌────────────────────────────┐   │
│  │  Filter Bar      │───▶│  QuickSightVisualGrid      │   │
│  │  (React state)   │    │  (8 iframes individuales)  │   │
│  └─────────────────┘    └────────────┬───────────────┘   │
│                                       │                   │
│  ┌────────────────────────────────────▼───────────────┐   │
│  │         Next.js API Route (proxy)                  │   │
│  │   /api/quicksight/visual-embed-urls                │   │
│  │   /api/quicksight/embed-url                        │   │
│  └────────────────────────────────────┬───────────────┘   │
└───────────────────────────────────────┼───────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────┐
│              AWS API Gateway (eu-south-2)                  │
│  https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com  │
│                                                           │
│  ┌──────────────┐    ┌─────────────────────────┐         │
│  │  /embed-url   │    │  /embed-visual-urls     │         │
│  │  (dashboard)  │    │  (visuals individuales) │         │
│  └──────┬───────┘    └──────────┬──────────────┘         │
│         │                       │                         │
│         ▼                       ▼                         │
│  ┌─────────────────────────────────────────────┐         │
│  │         AWS Lambda Function                  │         │
│  │  Genera URLs firmadas de QuickSight          │         │
│  │  con tokens temporales de autenticación      │         │
│  └─────────────────────────────────────────────┘         │
└───────────────────────────────────────────────────────────┘
```

---

## Flujo de Datos: Filtros → Visuales

```
1. Usuario cambia un filtro (fecha, brand, business)
          │
          ▼
2. dispatch(action) → feeManagerFilterReducer actualiza estado
          │
          ▼
3. buildQuickSightVisualQuery(filters) genera:
   {
     dashboardId: "4ecd3350-...",
     parameters: {
       StartDate: "2023-01-01",
       EndDate: "2023-01-31",
       Brand: ["Visa", "Mastercard"]
     }
   }
          │
          ▼
4. Fetch → /api/quicksight/visual-embed-urls?dashboardId=...&parameters={...}
          │
          ▼
5. Next.js proxy → AWS API Gateway → Lambda
          │
          ▼
6. Lambda genera URLs firmadas con los parámetros aplicados
          │
          ▼
7. Response:
   {
     dashboardId: "...",
     expiresInMinutes: N,
     visuals: [
       { sheetId: "...", visualId: "...", embedUrl: "https://..." },
       ...
     ]
   }
          │
          ▼
8. Frontend actualiza src de cada iframe → visuales se re-renderizan
```

---

## Filtros Implementados

| Filtro    | Tipo            | Parámetro QuickSight | Valores                                          |
|-----------|-----------------|----------------------|--------------------------------------------------|
| Fecha     | Rango           | `StartDate`, `EndDate` | ISO 8601 (ej: `2023-01-01`)                    |
| Brand     | Multi-select    | `Brand`              | `Visa`, `Mastercard`, `Amex`                     |
| Business  | Dropdown        | _(solo frontend)_    | `All Businesses`, `Issuer`, `Acquirer Merchant`, `Acquirer Cash` |
| Group View| Estático        | _(no aplica)_        | Siempre "Group View"                             |

**Nota:** Los filtros se pasan como `parameters` en el query string al endpoint de AWS. El debounce es de 500ms.

---

## Visuales Configurados (Fee Dashboard)

| #  | Visual                       | Sección       | Columnas | Altura Min |
|----|------------------------------|---------------|----------|------------|
| 1  | Total                        | Hero          | 1        | 420px      |
| 2  | Acquirer Cash                | Hero          | 1        | 360px      |
| 3  | Acquirer Merchant            | Hero          | 1        | 360px      |
| 4  | Gross Fees by Category       | Category      | 1        | 380px      |
| 5  | Gross Fees by Jurisdiction   | Jurisdiction  | 1        | 380px      |
| 6  | Monthly Gross Fees           | Monthly       | 2 (full) | 360px      |
| 7  | Issuer                       | Hero          | 1        | 360px      |
| 8  | Gross Fees by Evolution      | Evolution     | 1        | 400px      |

Los 4 visuales **Hero** (Total, Acquirer Cash, Acquirer Merchant, Issuer) se agrupan en un solo panel.

---

## Manejo de Sesión y Refresh

- Las URLs de embed tienen una **expiración temporal** (`expiresInMinutes` en la respuesta)
- El frontend trackea la expiración y **refresca automáticamente** 60 segundos antes de expirar
- Intervalo mínimo de refresh: 15 segundos
- El debounce de filtros evita llamadas excesivas al cambiar filtros rápidamente

---

## API Endpoints del PoC

### `GET /api/quicksight/embed-url`
**Para:** Dashboard completo (Fee Library)
```
Query: ?dashboardId=<id>
Response: { embedUrl, dashboardId, expiresInMinutes }
```

### `GET /api/quicksight/visual-embed-urls`
**Para:** Visuales individuales (Fee Dashboard)
```
Query: ?dashboardId=<id>&sheetId=<id>&visualId=<id>&parameters=<json>
Response: {
  dashboardId, expiresInMinutes,
  visuals: [{ sheetId, visualId, embedUrl }],
  errors: [{ sheetId, visualId, code, message }],
  externalFilterContract?: { scope, applyMethod, parameters }
}
```

Ambos son **proxies** hacia el API Gateway de AWS en `eu-south-2`.

---

## Stack Técnico del PoC

| Componente      | Tecnología                    |
|-----------------|-------------------------------|
| Framework       | Next.js 16.0.1 (App Router)  |
| Frontend        | React 19.2, TypeScript 5     |
| Styling         | Tailwind CSS 4, Radix UI     |
| Backend         | Next.js API Routes (proxy)   |
| Embedding       | iframes con URLs firmadas     |
| AWS             | API Gateway + Lambda (eu-south-2) |

---

## Variables de Entorno Necesarias

```env
METABASE_JWT_SHARED_SECRET=<secreto compartido para firmar JWT>
NODE_ENV=development|production
```

**AWS (en Lambda/API Gateway):**
- Credenciales AWS con permisos para QuickSight
- Configuración del API Gateway en `eu-south-2`

---

## Estructura de Archivos Clave

```
app/
├── api/quicksight/
│   ├── embed-url/route.ts          ← Proxy para dashboard completo
│   └── visual-embed-urls/route.ts  ← Proxy para visuales individuales
├── fee-dashboard/page.tsx          ← Página del Fee Dashboard
└── fee-library/page.tsx            ← Página del Fee Library

features/home/
├── components/
│   ├── FeeManagerOverview.tsx      ← Contenedor principal (filtros + grid)
│   ├── QuickSightVisualGrid.tsx    ← Grid de visuales con iframes
│   ├── QuickSightDashboardEmbed.tsx← Embed de dashboard completo
│   ├── filterBarLayoutState.ts     ← Estado de layout de filtros
│   └── useFilterBarLayout.ts       ← Hook para customización de filtros
└── config/
    ├── feeManagerFilters.ts        ← Estado de filtros, reducer, query builder
    ├── quicksightVisualMeta.ts     ← Metadata de cada visual (layout, orden)
    └── quicksightEmbedContract.ts  ← Tipos TypeScript del contrato con AWS
```

---

## Decisiones de Diseño Importantes

1. **Visual Embedding > Dashboard Embedding:** Se eligió embeber visuales individuales porque permite control total del layout y filtros desde el frontend del portal.

2. **Proxy via Next.js API Routes:** El frontend NO llama directamente a AWS. Las rutas de Next.js actúan como proxy, lo que permite:
   - Ocultar la URL del API Gateway del cliente
   - Agregar autenticación/autorización propia
   - Normalizar y validar las respuestas de AWS

3. **Filtros en el frontend:** Los filtros se manejan completamente en React (useReducer). Al cambiar un filtro, se generan nuevas URLs de embed con los parámetros aplicados. No se usa el SDK de QuickSight para filtros.

4. **Layout customizable:** El filter bar permite reordenar y redimensionar las secciones, con persistencia en localStorage.

5. **IDs hardcodeados en el PoC:** Los dashboard IDs, sheet IDs y visual IDs están hardcodeados en la configuración. En producción, estos deberían venir de una configuración dinámica o base de datos.

---

## Qué se Necesita para Producción

### Infraestructura AWS
- [ ] Lambda function para generar embed URLs (ya existe en el PoC)
- [ ] API Gateway configurado en la región correcta
- [ ] Permisos IAM para QuickSight: `GenerateEmbedUrlForAnonymousUser` o `GenerateEmbedUrlForRegisteredUser`
- [ ] QuickSight namespace y dashboards configurados

### Backend del Portal
- [ ] Endpoint proxy equivalente a `/api/quicksight/visual-embed-urls`
- [ ] Autenticación/autorización integrada con el sistema del portal
- [ ] Mover URL del API Gateway a variables de entorno (hoy está hardcodeada)

### Frontend del Portal
- [ ] Componente de grid de visuales (referencia: `QuickSightVisualGrid.tsx`)
- [ ] Sistema de filtros con debounce (referencia: `feeManagerFilters.ts`)
- [ ] Manejo de expiración y auto-refresh de tokens
- [ ] Configuración de metadata por visual (IDs, layout, orden)

### Configuración
- [ ] Obtener los dashboard IDs, sheet IDs y visual IDs de los dashboards de producción
- [ ] Definir los parámetros de filtro disponibles por dashboard
- [ ] Configurar CORS en el API Gateway para el dominio del portal
