# Deploy del proxy BGG en Vercel

El frontend ya consulta `/api/bgg`. La función serverless está en `api/bgg.js`.

1. Importá este repositorio en Vercel.
2. En **Project Settings → Environment Variables**, agregá:

   ```text
   BGG_API_KEY=tu-token-de-BGG
   ```

3. Habilitá la variable para `Production` y `Preview` si querés probar previews.
4. Hacé el deploy.

No agregues la key al repositorio ni a variables `VITE_*`: las variables `VITE_*` terminan dentro del JavaScript público.

Si el frontend queda en GitHub Pages y el proxy en Vercel, configurá durante el build del frontend:

```text
VITE_BGG_API_URL=https://tu-proyecto.vercel.app/api/bgg
```
