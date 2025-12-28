const hubspotService = require('./hubspotService');
const openaiService = require('./openaiService');

/**
 * Generar ideas de venta usando ChatGPT con contexto completo
 */
const generateSalesIdeas = async (contactData) => {
  const { contact, company, deals, communications, daysSinceLastCommunication, lastCommunicationDate } = contactData;
  
  // Obtener props de manera segura (puede venir de batch read o individual)
  const props = contact.properties || {};
  
  // Información básica del contacto
  const contactName = `${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Sin nombre';
  const contactEmail = props.email || 'Sin email';
  const contactPhone = props.phone || null;
  const lifecycleStage = props.lifecyclestage || 'unknown';
  const createdDate = props.createdate ? new Date(props.createdate) : null;
  const lastModified = props.lastmodifieddate ? new Date(props.lastmodifieddate) : null;
  
  // Información de la empresa
  const companyProps = company?.properties || {};
  const companyName = companyProps.name || props.company || 'No especificada';
  const companyDomain = companyProps.domain || null;
  const companyIndustry = companyProps.industry || null;
  const companySize = companyProps.numberofemployees || null;
  const companyRevenue = companyProps.annualrevenue || null;
  
  // Calcular días desde última actividad
  const daysSinceCreation = createdDate ? daysBetween(createdDate, new Date()) : 999;
  const daysSinceLastActivity = lastModified ? daysBetween(lastModified, new Date()) : 999;
  const daysSinceLastComm = daysSinceLastCommunication !== null ? daysSinceLastCommunication : daysSinceLastActivity;
  
  // Procesar comunicaciones (últimas 10 para contexto completo)
  const processedCommunications = communications.slice(0, 10).map(comm => {
    const commDate = new Date(comm.timestamp);
    return {
      type: formatCommunicationType(comm.type),
      subject: comm.subject,
      daysAgo: daysBetween(commDate, new Date()),
      date: commDate.toLocaleDateString('es-ES'),
      direction: comm.direction || 'outbound',
      hasBody: !!(comm.body && comm.body.length > 0)
    };
  });

  // Procesar deals con información completa
  const processedDeals = deals.map(deal => {
    // Si deal ya viene procesado (objeto con stage como nombre), usarlo directamente
    if (deal.name && deal.stage && !deal.stage.match(/^\d+$/)) {
      // Ya tiene nombre de etapa (no es solo un ID)
      return {
        name: deal.name,
        stage: deal.stage,
        amount: parseFloat(deal.amount || 0),
        currency: deal.currency || 'USD',
        closeDate: deal.closeDate || null,
        pipeline: deal.pipeline || 'default',
        type: deal.type || null,
        daysSinceLastModified: deal.lastModified ? daysBetween(new Date(deal.lastModified), new Date()) : null
      };
    }
    
    // Si viene como objeto de Hubspot con properties o tiene stageId
    const dealProps = deal.properties || {};
    const stageId = deal.stageId || dealProps.dealstage;
    const stageName = deal.stage || dealProps.dealstage || 'unknown';
    
    // Si stageName es solo un número (ID), intentar obtener el nombre
    // (Esto debería estar resuelto en hubspotService, pero por si acaso)
    const finalStage = stageName.match(/^\d+$/) ? `Etapa ${stageName}` : stageName;
    
    return {
      name: dealProps.dealname || deal.name || 'Sin nombre',
      stage: finalStage,
      amount: parseFloat(dealProps.amount || deal.amount || 0),
      currency: dealProps.deal_currency_code || deal.currency || 'USD',
      closeDate: dealProps.closedate || deal.closeDate || null,
      pipeline: dealProps.pipeline || deal.pipeline || 'default',
      type: dealProps.dealtype || deal.type || null,
      daysSinceLastModified: deal.lastModified ? daysBetween(new Date(deal.lastModified), new Date()) : null
    };
  });

  // Obtener noticias de la empresa (si tiene dominio)
  let companyNews = [];
  if (companyDomain) {
    companyNews = await hubspotService.getCompanyNews(companyDomain);
  }

  // Obtener eventos próximos
  const upcomingEvents = await hubspotService.getUpcomingEvents();

  // Construir contexto completo para ChatGPT
  const context = {
    // Información del contacto
    contactName,
    contactEmail,
    contactPhone,
    lifecycleStage,
    daysSinceCreation,
    daysSinceLastActivity,
    daysSinceLastCommunication: daysSinceLastComm,
    
    // Información de la empresa
    company: {
      name: companyName,
      domain: companyDomain,
      industry: companyIndustry,
      size: companySize,
      revenue: companyRevenue
    },
    companyNews,
    
    // Comunicaciones previas
    communications: processedCommunications,
    totalCommunications: communications.length,
    lastCommunicationType: processedCommunications[0]?.type || null,
    lastCommunicationDaysAgo: processedCommunications[0]?.daysAgo || null,
    
    // Negocios asociados
    deals: processedDeals,
    dealsCount: deals.length,
    activeDeals: processedDeals.filter(d => {
      const stage = (d.stage || '').toLowerCase();
      return stage && !stage.includes('closed') && !stage.includes('won') && !stage.includes('lost');
    }).length,
    totalDealAmount: processedDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
    
    // Eventos
    upcomingEvents
  };

  // Generar ideas con ChatGPT
  let ideas = [];
  let generatedWithAI = false;

  if (openaiService.isConfigured()) {
    try {
      console.log(`🤖 Generating ideas with ChatGPT for: ${contactName}`);
      ideas = await openaiService.generateSalesIdeas(context);
      generatedWithAI = true;
    } catch (error) {
      console.error('Error generating ideas with ChatGPT:', error.message);
      console.log('⚠️  Falling back to rule-based ideas');
      ideas = generateFallbackIdeas(context);
    }
  } else {
    console.log('⚠️  OpenAI not configured, using rule-based ideas');
    ideas = generateFallbackIdeas(context);
  }

  // Determinar si hay ideas de alta prioridad
  const highPriority = ideas.some(idea => idea.priority === 'Alta') || daysSinceLastComm > 14;

  // Obtener el owner_id del contacto
  const ownerId = props.hubspot_owner_id || null;

  return {
    contactId: contact.id,
    contactName,
    contactEmail,
    contactPhone,
    company: companyName,
    companyDomain,
    companyIndustry,
    lifecycleStage,
    dealsCount: processedDeals.length,
    activeDeals: context.activeDeals,
    totalDealAmount: context.totalDealAmount,
    lastActivity: lastModified ? lastModified.toLocaleDateString('es-ES') : 'Sin actividad',
    daysSinceLastContact: daysSinceLastComm,
    daysSinceLastCommunication: daysSinceLastComm,
    communications: processedCommunications,
    totalCommunications: communications.length,
    deals: processedDeals,
    ideas: ideas.slice(0, 3), // Asegurar máximo 3 ideas
    generatedWithAI,
    highPriority,
    ownerId,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Generar ideas de respaldo (cuando ChatGPT no está disponible)
 */
const generateFallbackIdeas = (context) => {
  const ideas = [];
  const { daysSinceLastCommunication, communications, deals, upcomingEvents } = context;
  const lastContactDays = daysSinceLastCommunication || 999;

  // Idea 1: Basada en tiempo sin contacto
  if (lastContactDays > 14) {
    ideas.push({
      title: 'Reactivación urgente del contacto',
      type: 'Llamada',
      reason: `Han pasado ${lastContactDays} días sin contacto`,
      action: 'Realizar llamada para retomar conversación y entender estado actual del proceso',
      priority: 'Alta'
    });
  } else if (lastContactDays > 7) {
    ideas.push({
      title: 'Seguimiento por email',
      type: 'Email',
      reason: 'Tiempo prudente desde último contacto',
      action: 'Enviar email de seguimiento preguntando sobre avances y próximos pasos',
      priority: 'Media'
    });
  }

  // Idea 2: Basada en deals
  if (deals && deals.length > 0) {
    const deal = deals[0];
    ideas.push({
      title: `Actualización sobre ${deal.name}`,
      type: 'WhatsApp',
      reason: `Negocio en etapa ${deal.stage}`,
      action: 'Enviar mensaje por WhatsApp con actualización del negocio y resolver dudas',
      priority: 'Alta'
    });
  }

  // Idea 3: Basada en eventos
  if (upcomingEvents && upcomingEvents.length > 0) {
    const event = upcomingEvents[0];
    ideas.push({
      title: `Invitación a ${event.name}`,
      type: 'Email',
      reason: 'Evento próximo relevante',
      action: `Invitar al evento "${event.name}" el ${event.date} como oportunidad de engagement`,
      priority: 'Media'
    });
  }

  // Idea genérica si no hay suficientes
  while (ideas.length < 3) {
    ideas.push({
      title: 'Compartir contenido de valor',
      type: 'Email',
      reason: 'Mantener engagement',
      action: 'Enviar case study o contenido relevante para su industria',
      priority: 'Baja'
    });
  }

  return ideas;
};

/**
 * Formatear tipo de comunicación
 */
const formatCommunicationType = (type) => {
  const types = {
    'EMAIL': 'Email',
    'CALL': 'Llamada',
    'NOTE': 'Nota',
    'TASK': 'Tarea',
    'MEETING': 'Reunión',
    'INCOMING_EMAIL': 'Email recibido',
    'FORWARDED_EMAIL': 'Email reenviado'
  };
  return types[type] || type;
};

/**
 * Calcular días entre dos fechas
 */
const daysBetween = (date1, date2) => {
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

module.exports = {
  generateSalesIdeas
};
