# Guía Rápida para Desarrolladores - QuickSight Embedding

## Cómo Correr el PoC

```bash
# 1. Clonar y entrar al repo
git clone <repo-url>
cd incontrol-metabase-demo
git checkout feature/fee-library

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crear archivo .env.local con:
METABASE_JWT_SHARED_SECRET=<pedir a Sebastián>

# 4. Iniciar el servidor de desarrollo
npm run dev

# 5. Abrir en navegador
# http://localhost:3000
# Login: sebastian.portal@intelica.com / 123456
```

**Rutas del PoC:**
- `/dashboards` — Menú principal
- `/fee-dashboard` — Visual embedding con filtros ← **este es el importante**
- `/fee-library` — Dashboard embedding completo

---

## Cómo Replicar el Visual Embedding en el Portal

### Paso 1: Crear el endpoint proxy

El portal necesita un endpoint que haga proxy al API Gateway de AWS. Referencia: `app/api/quicksight/visual-embed-urls/route.ts`

```
Tu Backend → AWS API Gateway → Lambda → QuickSight → URLs firmadas
```

**Lo mínimo que debe hacer el proxy:**
1. Recibir `dashboardId` y `parameters` del frontend
2. Construir la URL del API Gateway con esos parámetros
3. Hacer `fetch` al API Gateway
4. Validar/normalizar la respuesta
5. Retornar las embed URLs al frontend

### Paso 2: Implementar el grid de visuales

Referencia: `features/home/components/QuickSightVisualGrid.tsx`

**Concepto básico:**
```tsx
// Pseudocódigo simplificado
function VisualGrid({ filters }) {
  const [visuals, setVisuals] = useState([]);

  useEffect(() => {
    // 1. Construir query con los filtros
    const query = buildQuery(filters);

    // 2. Llamar al proxy
    const response = await fetch(`/api/quicksight/visual-embed-urls?${query}`);
    const data = await response.json();

    // 3. Actualizar los visuales
    setVisuals(data.visuals);

    // 4. Trackear expiración para auto-refresh
    scheduleRefresh(data.expiresInMinutes);
  }, [filters]);

  return (
    <div className="grid grid-cols-2 gap-4">
      {visuals.map(v => (
        <iframe key={v.visualId} src={v.embedUrl} />
      ))}
    </div>
  );
}
```

### Paso 3: Implementar filtros

Referencia: `features/home/config/feeManagerFilters.ts`

**Los parámetros se pasan como JSON en el query string:**
```typescript
const parameters = {
  StartDate: "2023-01-01",
  EndDate: "2023-01-31",
  Brand: ["Visa", "Mastercard"]
};

const url = `/api/proxy?dashboardId=${id}&parameters=${encodeURIComponent(JSON.stringify(parameters))}`;
```

### Paso 4: Manejo de expiración

```typescript
// La respuesta incluye expiresInMinutes
// Refrescar 60 segundos antes de que expire
const refreshAt = (expiresInMinutes * 60 - 60) * 1000;
setTimeout(() => fetchNewUrls(), refreshAt);
```

---

## Archivos Clave para Estudiar

Por orden de importancia:

1. **`features/home/config/feeManagerFilters.ts`**
   - Cómo se construye la query con filtros
   - `buildQuickSightVisualQuery()` y `buildQuickSightVisualQueryString()`

2. **`app/api/quicksight/visual-embed-urls/route.ts`**
   - El proxy completo con validación de respuesta
   - Manejo de errores upstream

3. **`features/home/components/QuickSightVisualGrid.tsx`**
   - El componente que renderiza los iframes
   - Auto-refresh de tokens
   - Debounce de filtros

4. **`features/home/config/quicksightVisualMeta.ts`**
   - Configuración de cada visual (orden, tamaño, sección)
   - Mapeo de IDs a metadata de layout

5. **`features/home/config/quicksightEmbedContract.ts`**
   - Los tipos TypeScript del contrato con AWS

6. **`features/home/components/FeeManagerOverview.tsx`**
   - El contenedor que une filtros + grid

---

## Consideraciones para Producción

### Seguridad
- **No exponer la URL del API Gateway al frontend** — siempre usar un proxy del backend
- **Agregar autenticación** al endpoint proxy (el PoC no tiene auth en el proxy de QuickSight)
- **CORS**: Configurar el API Gateway para aceptar solo el dominio del portal

### Performance
- **Debounce** los cambios de filtro (500ms en el PoC) para evitar llamadas excesivas
- **No cachear** las embed URLs — son temporales y de uso único
- Las URLs expiran — implementar auto-refresh

### AWS
- La Lambda actual está en **eu-south-2** (Milan) — verificar si es la región correcta para producción
- La URL del API Gateway (`3had8hcyhg.execute-api...`) es del PoC — crear uno nuevo para producción
- Revisar los permisos IAM necesarios para la API de QuickSight embedding
