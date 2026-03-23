# Contratos de API - QuickSight Embedding

## Endpoint 1: Visual Embed URLs (el más importante)

**Propósito:** Obtener URLs firmadas para embeber visuales individuales de un dashboard de QuickSight.

### Request
```
GET /api/quicksight/visual-embed-urls
```

| Parámetro     | Tipo   | Requerido | Descripción                                             |
|---------------|--------|-----------|---------------------------------------------------------|
| `dashboardId` | string | Sí        | ID del dashboard de QuickSight                          |
| `sheetId`     | string | No        | ID del sheet específico (filtra visuales de ese sheet)  |
| `visualId`    | string | No        | ID de un visual específico (para refrescar uno solo)    |
| `parameters`  | string | No        | JSON stringificado con los filtros a aplicar            |

**Ejemplo de `parameters`:**
```json
{
  "StartDate": "2023-01-01",
  "EndDate": "2023-01-31",
  "Brand": ["Visa", "Mastercard"]
}
```

**Ejemplo de URL completa:**
```
/api/quicksight/visual-embed-urls?dashboardId=4ecd3350-2b80-4ac1-b1da-8819819f5f2f&parameters=%7B%22StartDate%22%3A%222023-01-01%22%2C%22EndDate%22%3A%222023-01-31%22%2C%22Brand%22%3A%5B%22Visa%22%2C%22Mastercard%22%5D%7D
```

### Response (200 OK)
```typescript
{
  dashboardId: string;           // ID del dashboard
  expiresInMinutes: number;      // Minutos hasta que expiren las URLs
  visuals: Array<{
    sheetId: string;             // ID del sheet donde está el visual
    visualId: string;            // ID único del visual
    embedUrl: string;            // URL firmada para embeber en iframe
  }>;
  errors: Array<{                // Visuales que fallaron al generar URL
    sheetId: string;
    visualId: string;
    code: string;
    message: string;
  }>;
  externalFilterContract?: {     // Metadata sobre los filtros aplicados
    scope: "global";
    applyMethod: "quicksight-sdk:setParameters";
    parameters: Array<{
      Name: string;
      Values: string[];
    }>;
  };
}
```

### Response de Error
```typescript
{
  error: string;                 // Código de error
  detail?: {
    message?: string;
    required?: string[];
    [key: string]: unknown;
  };
}
```

**Códigos de error posibles:**
| Código                    | HTTP | Descripción                              |
|---------------------------|------|------------------------------------------|
| `UPSTREAM_ERROR`          | 502  | Error del API Gateway de AWS             |
| `INVALID_UPSTREAM_JSON`   | 502  | Respuesta no es JSON válido              |
| `INVALID_UPSTREAM_PAYLOAD`| 502  | JSON válido pero estructura incorrecta   |
| `UPSTREAM_UNREACHABLE`    | 502  | No se pudo conectar al API Gateway       |

---

## Endpoint 2: Dashboard Embed URL

**Propósito:** Obtener una URL firmada para embeber un dashboard completo de QuickSight.

### Request
```
GET /api/quicksight/embed-url
```

| Parámetro     | Tipo   | Requerido | Descripción                              |
|---------------|--------|-----------|------------------------------------------|
| `dashboardId` | string | No        | ID del dashboard (default: fee dashboard)|

### Response (200 OK)
```typescript
{
  embedUrl: string;              // URL firmada para iframe
  dashboardId: string;           // ID del dashboard
  expiresInMinutes: number;      // Minutos hasta expiración
}
```

---

## Upstream: AWS API Gateway

**Base URL:** `https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com`

| Endpoint              | Método | Propósito                    |
|-----------------------|--------|------------------------------|
| `/embed-url`          | GET    | Dashboard completo           |
| `/embed-visual-urls`  | GET    | Visuales individuales        |

**Headers requeridos:**
```
Accept: application/json
```

**Caching:** Todas las respuestas llevan `Cache-Control: no-store` — las URLs son temporales y no deben cachearse.

---

## Cómo se Usan las Embed URLs

Cada `embedUrl` retornada se usa directamente como `src` de un `<iframe>`:

```html
<iframe
  src="https://eu-south-2.quicksight.aws.amazon.com/embed/...?token=..."
  width="100%"
  height="380px"
  style="border: none;"
/>
```

- Las URLs contienen un token de autenticación temporal
- Son de uso único (no reutilizables después de expirar)
- El frontend debe trackear `expiresInMinutes` y refrescar antes de expiración

---

## IDs de QuickSight del PoC

### Fee Dashboard (Visual Embedding)
```
Dashboard ID: 4ecd3350-2b80-4ac1-b1da-8819819f5f2f
Sheet ID:     4ecd3350-2b80-4ac1-b1da-8819819f5f2f_0b05ba09-806d-4a93-9834-e82bb5e3c475
```

**Visual IDs:**
| Visual                     | Visual ID (sufijo)                              |
|----------------------------|------------------------------------------------|
| Total                      | `..._5881346a-b982-485d-91c1-d7ff0c133d63`     |
| Acquirer Cash              | `..._f82d4b33-8ed1-4940-ad97-881e1d04b6ab`     |
| Acquirer Merchant          | `..._9f023952-2c3a-4f50-8c9e-67e9d0d98473`     |
| Gross Fees by Category     | `..._9fe19a65-bd9b-42e8-9093-9a3fa47a6790`     |
| Gross Fees by Jurisdiction | `..._755f2714-d085-4bf0-9d3a-31c44ec4f490`     |
| Monthly Gross Fees         | `..._9d672775-56a9-4fa3-a119-881a68c7d70a`     |
| Issuer                     | `..._47080a60-f743-44d2-adde-3a553918e5e2`     |
| Gross Fees by Evolution    | `..._b43463a2-57a6-4292-a225-f36a3b5b657b`     |

### Fee Library (Dashboard Embedding)
```
Dashboard ID: 5a53241b-0a3f-4b6a-a3c8-d0afc2e4e2cf
```
