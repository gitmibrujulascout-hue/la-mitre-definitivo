import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const claveIngresada = body.clave;

    if (!claveIngresada || typeof claveIngresada !== 'string') {
      return Response.json({ valido: false }, { status: 200 });
    }

    const base44 = createClientFromRequest(req);
    const configs = await base44.asServiceRole.entities.ConfigGeneral.list();
    const config = configs[0];

    // Si no hay clave configurada, denegar acceso
    if (!config || !config.clave_admin) {
      return Response.json({ valido: false, sinClave: true }, { status: 200 });
    }

    const valido = config.clave_admin === claveIngresada;
    return Response.json({ valido }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}