import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Smartphone, Bot, CheckCircle, Info } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

export default function AgenteScout() {
  const whatsappUrl = base44.agents.getWhatsAppConnectURL('consulta_scout');

  return (
    <div>
      <PageHeader
        title="Agente WhatsApp"
        description="Asistente automático para consulta de estado de cuenta por DNI"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Estado del agente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Agente de consultas
            </CardTitle>
            <CardDescription>Responde automáticamente a beneficiarios por WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Agente activo y configurado</span>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                El beneficiario envía su DNI por WhatsApp y el agente responde con su saldo, cuotas pagadas y pendientes.
              </p>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capacidades</p>
              <ul className="text-sm space-y-1">
                {[
                  'Consulta de saldo actual',
                  'Historial de pagos de cuotas',
                  'Cuotas pendientes del año',
                  'Estado de afiliación',
                  'Respuesta automática 24/7',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Conectar WhatsApp */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <MessageCircle className="w-5 h-5" />
              Conectar por WhatsApp
            </CardTitle>
            <CardDescription className="text-green-700">
              Vinculá tu número de WhatsApp para que el agente responda automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-white border border-green-200 p-4 space-y-3">
              <p className="text-sm font-medium text-green-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Pasos para conectar
              </p>
              <ol className="text-sm text-green-800 space-y-2 list-decimal list-inside">
                <li>Hacé clic en el botón de abajo</li>
                <li>Seguí las instrucciones para vincular tu WhatsApp</li>
                <li>El agente comenzará a responder automáticamente</li>
                <li>Compartí el número con los beneficiarios del grupo</li>
              </ol>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Conectar WhatsApp
            </a>

            <p className="text-xs text-green-700 text-center">
              Una vez conectado, el agente responderá automáticamente a los mensajes de los beneficiarios.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ejemplo de conversación */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Ejemplo de conversación</CardTitle>
          <CardDescription>Así responde el agente a los beneficiarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-3">
            <ChatBubble from="user" text="Hola, quiero saber mi estado de cuenta" />
            <ChatBubble from="agent" text={'¡Hola! Soy el asistente del Grupo Scout 🏕️\n\nPuedo ayudarte con tu estado de cuenta. Por favor, enviame tu número de DNI (sin puntos).'} />
            <ChatBubble from="user" text="12345678" />
            <ChatBubble from="agent" text={'✅ Encontré tu cuenta:\n\n*García Pérez, Juan* - Rama Tropa\n\n📋 *Cuotas 2026*\nPagadas: Marzo, Abril ✓\nPendientes: Mayo, Junio\n\n💰 *Saldo pendiente: $50.000*\n\n🏕️ Sin deuda de campamentos\n\n¡Ante cualquier consulta, hablá con los responsables del grupo!'} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChatBubble({ from, text }) {
  const isUser = from === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
        isUser
          ? 'bg-green-500 text-white rounded-br-sm'
          : 'bg-muted text-foreground rounded-bl-sm border'
      }`}>
        {text}
      </div>
    </div>
  );
}