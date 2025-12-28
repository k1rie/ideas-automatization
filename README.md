# Backend - Sistema de Ideas de Venta Hubspot

Sistema automatizado que analiza contactos de Hubspot y genera ideas de comunicación personalizadas usando ChatGPT.

## Funcionalidad Principal

- **Lista específica**: Analiza contactos de la lista 13121 (contactos sin contacto en 7+ días)
- **Análisis con IA**: Usa ChatGPT para generar ideas contextuales e inteligentes
- **Análisis automático**: Revisa contactos diariamente a las 4 AM (lunes a viernes)
- **Generación de ideas**: Crea 3 ideas de comunicación personalizadas por contacto
- **Integración Hubspot**: Crea tasks automáticamente con el análisis y las asigna al owner del contacto
- **Una tarea por contacto**: Todas las ideas se consolidan en una sola tarea de HubSpot
- **API REST**: Endpoints para análisis manual y testing

## Instalación

```bash
npm install
```

## Configuración

Edita el archivo `.env` y configura:

```env
HUBSPOT_API_KEY=tu_api_key_de_hubspot
OPENAI_API_KEY=tu_api_key_de_openai
HUBSPOT_LIST_ID=13121
```

### Variables requeridas:
- `HUBSPOT_API_KEY`: Token de API de Hubspot (REQUERIDO)
- `OPENAI_API_KEY`: Token de OpenAI para ChatGPT (REQUERIDO)
- `HUBSPOT_LIST_ID`: ID de la lista a analizar (default: 13121)
- `CRON_SCHEDULE`: Horario de ejecución (default: `0 4 * * 1-5`)

## Uso

```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm start

# Scripts de análisis
npm run list-contacts      # Listar contactos de la lista
npm run analyze-one <ID>   # Analizar un contacto específico
npm run analyze-now        # Analizar todos los contactos AHORA
```

## Endpoints API

### GET `/api/contacts`
Obtener todos los contactos de la lista 13121

### GET `/api/contacts/:contactId`
Obtener detalles completos de un contacto específico

### POST `/api/contacts/:contactId/analyze`
Analizar un contacto y crear task con ideas generadas por ChatGPT

### POST `/api/contacts/analyze-all`
Analizar todos los contactos de la lista (usado por scheduler)

## Estructura

```
backend/
├── src/
│   ├── controllers/     # Lógica de endpoints
│   ├── services/        
│   │   ├── hubspotService.js    # Integración Hubspot
│   │   ├── openaiService.js     # Integración ChatGPT
│   │   ├── analysisService.js   # Lógica de análisis
│   │   └── clickupService.js    # (No usado - solo HubSpot)
│   ├── scheduler/       # Automatización con cron
│   ├── routes/          # Definición de rutas
│   └── server.js        # Punto de entrada
├── .env
└── package.json
```

## Información Extraída por Contacto

El sistema extrae y analiza:

1. **Comunicaciones previas**
   - Emails enviados/recibidos
   - Llamadas realizadas
   - WhatsApps enviados
   - Notas y reuniones

2. **Empresa asociada**
   - Nombre y dominio
   - Industria
   - Información corporativa

3. **Negocios (Deals)**
   - Nombre del negocio
   - Etapa actual
   - Monto
   - Pipeline

4. **Eventos próximos**
   - Calendario de eventos disponibles
   - Webinars, demos, networking

5. **Contexto temporal**
   - Días desde último contacto
   - Última actividad registrada
   - Etapa del ciclo de vida

## Generación de Ideas con ChatGPT

El sistema construye un prompt optimizado que:
- Minimiza uso de tokens
- Incluye contexto relevante
- Considera comunicaciones previas
- Analiza etapa de negocios
- Sugiere eventos apropiados
- Genera ideas complementarias (no repetitivas)

### Formato de Ideas

Cada idea incluye:
- **Title**: Título descriptivo
- **Type**: Email, WhatsApp, Llamada, Reunión
- **Reason**: Por qué esta idea es relevante
- **Action**: Qué hacer exactamente
- **Priority**: Alta, Media, Baja

## Formato de Tareas en HubSpot

Las tareas creadas en HubSpot incluyen:

### Estructura de la Tarea
- **Asunto**: "Ideas de Venta - [Nombre del Contacto]"
- **Asignación**: Automáticamente asignada al `hubspot_owner_id` del contacto
- **Prioridad**: Alta (si hay ideas de alta prioridad) o Media
- **Estado**: NOT_STARTED

### Contenido de la Tarea
La tarea incluye todas las ideas consolidadas en un formato legible:

1. **Resumen del Contacto**
   - Información básica (nombre, email, teléfono)
   - Empresa y etapa del ciclo de vida
   - Negocios activos
   - Días sin contacto

2. **Ideas de Venta**
   - Todas las ideas generadas (hasta 3)
   - Tipo de comunicación sugerida
   - Razón y acción detallada
   - Prioridad de cada idea

3. **Negocios Asociados**
   - Lista de deals activos
   - Etapa y monto de cada negocio

4. **Últimas Comunicaciones**
   - Historial de las últimas 5 interacciones
   - Tipo, fecha y dirección de cada comunicación

## Fallback sin ChatGPT

Si OpenAI no está configurado o falla, el sistema usa reglas predefinidas:
- Reactivación para contactos inactivos
- Seguimiento según etapa de negocios
- Invitaciones a eventos
- Contenido de valor

## Criterios de Análisis

El sistema considera:
- **Tiempo sin contacto**: > 7 días (lista específica)
- **Comunicaciones previas**: Evita repetir canales recientes
- **Etapa de negocios**: Ajusta seguimiento según pipeline
- **Eventos disponibles**: Oportunidades de engagement
- **Contexto empresarial**: Noticias e información corporativa

## Logs y Monitoreo

El backend muestra logs detallados:
- ✅ Tareas creadas exitosamente
- 🤖 Ideas generadas con ChatGPT
- ⚠️  Fallback a reglas cuando IA no disponible
- ❌ Errores en el procesamiento
- 📊 Análisis de contactos
- 🔔 Ejecuciones del scheduler

## Optimización de Tokens

El prompt está optimizado para:
- Usar formato compacto
- Incluir solo últimas 5 comunicaciones
- Resumir información de empresa
- Limitar eventos a 3 más relevantes
- Respuesta JSON estructurada
- ~800 tokens máximo por respuesta
# ideas-automatization
# ideas-automatization
# ideas-automatization
# ideas-automatization
# ideas-automatization
