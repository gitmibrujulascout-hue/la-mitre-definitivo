# Mi Brújula Scout

Aplicación de administración para grupos scout, desplegada en Vercel y conectada a Supabase.

## Desarrollo local

1. Clonar el repositorio.
2. Ejecutar `npm install`.
3. Crear `.env.local` con:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_publica
```

4. Ejecutar `npm run dev`.

Los cambios enviados a `main` se despliegan automáticamente en Vercel.
