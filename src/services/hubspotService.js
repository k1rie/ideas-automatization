const axios = require('axios');

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const API_KEY = process.env.HUBSPOT_API_KEY;
const SEGMENT_ID = process.env.HUBSPOT_LIST_ID || '13121'; // Aunque se llame LIST_ID, es un segmento

/**
 * Cliente HTTP configurado para Hubspot
 */
const hubspotClient = axios.create({
  baseURL: HUBSPOT_API_BASE,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Obtener contactos de un segmento específico (objectLists)
 * Los segmentos dinámicos en Hubspot se acceden como listas activas
 * URL ejemplo: https://app.hubspot.com/contacts/{portalId}/objectLists/{segmentId}/filters
 */
const getContactsFromList = async (segmentId = SEGMENT_ID) => {
  try {
    console.log(`📋 Fetching contacts from segment: ${segmentId}`);
    
    // Primero obtener información del segmento usando API v3 (para segmentos/objectLists)
    let segmentInfo = null;
    try {
      console.log(`\n📡 Obteniendo información del segmento...`);
      console.log(`   Endpoint: /crm/v3/lists/${segmentId}`);
      
      const segmentResponse = await hubspotClient.get(`/crm/v3/lists/${segmentId}`, {
        params: {
          properties: 'name,size,listType,createdAt,updatedAt'
        }
      });
      
      console.log(`\n📥 Respuesta de Hubspot (info del segmento):`);
      console.log(`   Status: ${segmentResponse.status} ${segmentResponse.statusText}`);
      console.log(`   Data completa:`, JSON.stringify(segmentResponse.data, null, 2));
      
      segmentInfo = segmentResponse.data;
      const listData = segmentInfo.list || {};
      console.log(`\n📋 Segmento encontrado: "${listData.name || 'Unknown'}"`);
      console.log(`   Tamaño: ${listData.size || 0} registros`);
      console.log(`   Tipo: ${listData.processingType || 'Unknown'}`);
      console.log(`   Object Type: ${listData.objectTypeId || 'Unknown'} (0-1=Contacts, 0-3=Deals)`);
      console.log(`   ID: ${listData.listId || segmentId}`);
    } catch (segmentError) {
      console.error(`\n❌ Error obteniendo info del segmento (API v3):`);
      console.error(`   Status: ${segmentError.response?.status || 'N/A'}`);
      console.error(`   Status Text: ${segmentError.response?.statusText || 'N/A'}`);
      console.error(`   Message: ${segmentError.response?.data?.message || segmentError.message}`);
      console.error(`   Error completo:`, JSON.stringify(segmentError.response?.data || segmentError.message, null, 2));
      
      // Intentar con API v1 como fallback (aunque sabemos que puede fallar)
      try {
        console.log(`\n   Intentando con API v1 como fallback...`);
        const v1Response = await hubspotClient.get(`/contacts/v1/lists/${segmentId}`);
        console.log(`   ✅ API v1 funcionó:`, JSON.stringify(v1Response.data, null, 2));
        segmentInfo = v1Response.data;
      } catch (v1Error) {
        console.log(`   ⚠️  API v1 también falló (esperado para segmentos)`);
      }
    }
    
    // Método principal: API v3 para segmentos dinámicos (objectLists)
    // Los segmentos dinámicos requieren usar la API v3 con memberships
    try {
      console.log(`\n📡 Llamando a Hubspot API v3 (método principal para segmentos)...`);
      console.log(`   Endpoint: /crm/v3/lists/${segmentId}/memberships`);
      
      let allContacts = [];
      let after = null;
      let hasMore = true;
      let pageCount = 0;
      
      while (hasMore) {
        pageCount++;
        const params = {
          limit: 100
        };
        
        if (after) {
          params.after = after;
        }
        
        console.log(`\n   📄 Página ${pageCount}:`);
        console.log(`   Parámetros:`, JSON.stringify(params, null, 2));
        
        const response = await hubspotClient.get(`/crm/v3/lists/${segmentId}/memberships`, {
          params
        });
        
        console.log(`\n📥 Respuesta de Hubspot (memberships):`);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Data completa:`, JSON.stringify(response.data, null, 2));
        
        const data = response.data;
        const memberships = data.results || [];
        
        console.log(`   Memberships encontrados: ${memberships.length}`);
        
        if (memberships.length > 0) {
          // Extraer IDs de registros (pueden ser contactos o deals)
          const recordIds = memberships
            .map(m => {
              // Los memberships devuelven recordId (no contactId)
              const id = m.recordId || m.contactId || m.vid || m.id || m.contact?.id;
              console.log(`   Membership item:`, JSON.stringify(m, null, 2));
              return id;
            })
            .filter(Boolean);
          
          console.log(`   Record IDs extraídos: ${recordIds.length}`);
          console.log(`   IDs:`, recordIds);
          
          // Verificar el tipo de objeto del segmento
          const objectTypeId = segmentInfo?.list?.objectTypeId || '0-1';
          const isDealsSegment = objectTypeId === '0-3';
          
          console.log(`   Tipo de segmento: ${isDealsSegment ? 'Deals' : 'Contacts'}`);
          
          let contactIds = [];
          
          if (isDealsSegment) {
            // Si es un segmento de deals, obtener los contactos asociados a esos deals
            console.log(`   Obteniendo contactos asociados a los deals...`);
            for (const dealId of recordIds) {
              try {
                const dealAssoc = await hubspotClient.get(
                  `/crm/v3/objects/deals/${dealId}/associations/contacts`
                );
                
                if (dealAssoc.data.results && dealAssoc.data.results.length > 0) {
                  const dealContactIds = dealAssoc.data.results.map(r => r.id || r.toObjectId);
                  contactIds = contactIds.concat(dealContactIds);
                  console.log(`   Deal ${dealId} tiene ${dealContactIds.length} contactos asociados`);
                }
              } catch (dealError) {
                console.warn(`   ⚠️  No se pudieron obtener contactos del deal ${dealId}:`, dealError.response?.data?.message || dealError.message);
              }
            }
            
            // Eliminar duplicados
            contactIds = [...new Set(contactIds)];
            console.log(`   Total contactos únicos encontrados: ${contactIds.length}`);
          } else {
            // Si es un segmento de contactos, usar los IDs directamente
            contactIds = recordIds;
          }
          
          if (contactIds.length > 0) {
            // Obtener detalles de los contactos en batch
            try {
              console.log(`   Obteniendo detalles de ${contactIds.length} contactos en batch...`);
              console.log(`   Contact IDs a buscar:`, contactIds);
              
              const contactsResponse = await hubspotClient.post('/crm/v3/objects/contacts/batch/read', {
                inputs: contactIds.map(id => ({ id: String(id) })),
                properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'lifecyclestage', 'hs_lead_status']
              });
              
              console.log(`   Batch response status: ${contactsResponse.status}`);
              console.log(`   Batch response data:`, JSON.stringify(contactsResponse.data, null, 2));
              
              const contacts = contactsResponse.data.results || [];
              allContacts = allContacts.concat(contacts);
              console.log(`   ✅ Obtenidos ${allContacts.length} contactos hasta ahora...`);
            } catch (batchError) {
              console.error(`   ❌ Error en batch read:`, JSON.stringify(batchError.response?.data || batchError.message, null, 2));
              
              // Fallback: obtener contactos uno por uno
              console.log(`   Intentando obtener contactos individualmente...`);
              for (const contactId of contactIds) {
                try {
                  const contactResponse = await hubspotClient.get(`/crm/v3/objects/contacts/${contactId}`, {
                    params: {
                      properties: 'email,firstname,lastname,phone,company,lifecyclestage,hs_lead_status'
                    }
                  });
                  allContacts.push(contactResponse.data);
                  console.log(`   ✅ Contacto ${contactId} obtenido`);
                } catch (individualError) {
                  console.warn(`   ⚠️  No se pudo obtener contacto ${contactId}:`, individualError.response?.data?.message || individualError.message);
                }
              }
            }
          }
        }
        
        // Verificar si hay más páginas
        after = data.paging?.next?.after || null;
        hasMore = !!after && memberships.length === 100;
        
        console.log(`   Has more: ${hasMore}, After: ${after || 'null'}`);
      }
      
      if (allContacts.length > 0) {
        console.log(`\n✅ Found ${allContacts.length} contacts in segment ${segmentId} (API v3)`);
        
        return allContacts.map(contact => ({
          id: contact.id,
          properties: contact.properties || {}
        }));
      } else {
        console.log(`\n⚠️  No se encontraron contactos después de procesar ${pageCount} página(s)`);
        
        // Si el segmento es de deals y no encontramos contactos, puede ser que los deals no tengan contactos asociados
        const objectTypeId = segmentInfo?.list?.objectTypeId || '0-1';
        if (objectTypeId === '0-3') {
          console.log(`\n   ℹ️  Este es un segmento de DEALS, no de CONTACTOS`);
          console.log(`   Los deals encontrados pueden no tener contactos asociados`);
          console.log(`   O los contactos asociados pueden no ser visibles con los permisos actuales`);
        }
        
        // Intentar método alternativo: API v1 (aunque sabemos que puede devolver vacío)
        console.log(`\n   Intentando método alternativo con API v1...`);
        try {
          const v1Response = await hubspotClient.get(`/contacts/v1/lists/${segmentId}/contacts/all`, {
            params: {
              count: 100,
              property: 'email,firstname,lastname,phone,company,lifecyclestage,hs_lead_status'
            }
          });
          
          console.log(`   API v1 response:`, JSON.stringify(v1Response.data, null, 2));
          
          const v1Contacts = v1Response.data.contacts || [];
          if (v1Contacts.length > 0) {
            console.log(`   ✅ API v1 encontró ${v1Contacts.length} contactos`);
            return v1Contacts.map(contact => ({
              id: contact.vid,
              properties: contact.properties || {}
            }));
          }
        } catch (v1Error) {
          console.log(`   ⚠️  API v1 también falló:`, v1Error.response?.data?.message || v1Error.message);
        }
      }
      
    } catch (v3Error) {
      console.error(`\n❌ API v3 Error:`);
      console.error(`   Status: ${v3Error.response?.status || 'N/A'}`);
      console.error(`   Status Text: ${v3Error.response?.statusText || 'N/A'}`);
      console.error(`   Message: ${v3Error.response?.data?.message || v3Error.message}`);
      console.error(`   Error completo:`, JSON.stringify(v3Error.response?.data || v3Error.message, null, 2));
      
      // Si llegamos aquí, no se encontraron contactos con ningún método
      throw v3Error;
    }
    
    // Si llegamos aquí, no hay contactos
    console.log(`ℹ️  No se encontraron contactos en el segmento ${segmentId}`);
    return [];
    
  } catch (error) {
    console.error('\n❌ ERROR FINAL al obtener contactos del segmento:');
    console.error('   Segment ID:', segmentId);
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Status Text:', error.response?.statusText || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    console.error('   Request URL:', error.config?.url || 'N/A');
    console.error('   Request Method:', error.config?.method || 'N/A');
    console.error('   Request Headers:', JSON.stringify(error.config?.headers || {}, null, 2));
    
    // Información adicional para debugging
    if (error.response?.data) {
      console.error('\n   📋 Respuesta completa de Hubspot:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.headers) {
      console.error('\n   📋 Headers de respuesta:');
      console.error(JSON.stringify(error.response.headers, null, 2));
    }
    
    // Mensajes de error más claros
    if (error.response?.status === 401) {
      throw new Error('Error de autenticación. Verifica tu HUBSPOT_API_KEY');
    } else if (error.response?.status === 403) {
      throw new Error('Sin permisos. Verifica que tu API key tenga acceso a listas/segmentos y contactos');
    } else if (error.response?.status === 404) {
      throw new Error(`El segmento ${segmentId} no existe o no tienes acceso a él`);
    }
    
    throw new Error(`Failed to fetch contacts from segment ${segmentId}: ${error.response?.data?.message || error.message}`);
  }
};

/**
 * Obtener contactos del segmento (usa el segmento específico)
 */
const getContacts = async () => {
  return getContactsFromList();
};

/**
 * Obtener detalles completos de un contacto con toda la información necesaria
 */
const getContactDetails = async (contactId) => {
  try {
    // 1. Información básica del contacto
    const contactResponse = await hubspotClient.get(`/crm/v3/objects/contacts/${contactId}`, {
      params: {
        properties: [
          'email', 'firstname', 'lastname', 'phone', 'company',
          'lifecyclestage', 'hs_lead_status', 'createdate', 'lastmodifieddate',
          'notes_last_contacted', 'notes_last_updated', 'num_notes',
          'hs_email_last_send_date', 'hs_email_last_open_date',
          'hs_sequences_actively_enrolled_count', 'hubspot_owner_id'
        ].join(',')
      }
    });
    
    const contact = contactResponse.data;

    // 2. Obtener empresa asociada con información completa
    let companyData = null;
    try {
      console.log(`   🏢 Obteniendo información de la empresa...`);
      const companyAssoc = await hubspotClient.get(
        `/crm/v3/objects/contacts/${contactId}/associations/companies`
      );
      
      if (companyAssoc.data.results && companyAssoc.data.results.length > 0) {
        const companyId = companyAssoc.data.results[0].id;
        console.log(`   📋 Empresa ID: ${companyId}`);
        
        const companyResponse = await hubspotClient.get(`/crm/v3/objects/companies/${companyId}`, {
          params: {
            properties: [
              'name',
              'domain',
              'industry',
              'description',
              'about_us',
              'numberofemployees',
              'annualrevenue',
              'website',
              'phone',
              'address',
              'city',
              'state',
              'country',
              'zip',
              'hs_createdate',
              'hs_lastmodifieddate',
              'hubspot_owner_id'
            ].join(',')
          }
        });
        
        companyData = companyResponse.data;
        const companyProps = companyData.properties || {};
        console.log(`   ✅ Empresa: ${companyProps.name || 'Sin nombre'}`);
        console.log(`      Dominio: ${companyProps.domain || 'N/A'}`);
        console.log(`      Industria: ${companyProps.industry || 'N/A'}`);
      } else {
        console.log(`   ℹ️  No hay empresa asociada`);
      }
    } catch (error) {
      console.log(`   ⚠️  Error obteniendo empresa:`, error.response?.data?.message || error.message);
    }

    // 3. Obtener negocios (deals) asociados con información completa
    let deals = [];
    try {
      console.log(`   💼 Obteniendo negocios asociados...`);
      const dealsAssoc = await hubspotClient.get(
        `/crm/v3/objects/contacts/${contactId}/associations/deals`
      );
      
      if (dealsAssoc.data.results && dealsAssoc.data.results.length > 0) {
        const dealIds = dealsAssoc.data.results.map(d => d.id);
        console.log(`   📋 Encontrados ${dealIds.length} negocios asociados`);
        
        // Obtener detalles completos de cada deal
        const dealPromises = dealIds.map(dealId =>
          hubspotClient.get(`/crm/v3/objects/deals/${dealId}`, {
            params: {
              properties: [
                'dealname',
                'dealstage',
                'amount',
                'closedate',
                'pipeline',
                'hs_lastmodifieddate',
                'createdate',
                'dealtype',
                'hubspot_owner_id',
                'hs_object_id',
                'hs_createdate',
                'hs_closed_amount',
                'hs_deal_amount_calculation_preference',
                'deal_currency_code'
              ].join(',')
            }
          }).catch((error) => {
            console.log(`   ⚠️  Error obteniendo deal ${dealId}:`, error.response?.data?.message || error.message);
            return null;
          })
        );
        
        const dealResponses = await Promise.all(dealPromises);
        
        // Obtener información de pipelines y etapas para convertir IDs a nombres
        let stageMap = {};
        let pipelineMap = {};
        try {
          // Obtener pipelines
          const pipelinesResponse = await hubspotClient.get('/crm/v3/pipelines/deals');
          if (pipelinesResponse.data && pipelinesResponse.data.results) {
            pipelinesResponse.data.results.forEach(pipeline => {
              pipelineMap[pipeline.id] = pipeline.label;
              // Mapear etapas de cada pipeline
              if (pipeline.stages) {
                pipeline.stages.forEach(stage => {
                  stageMap[stage.id] = stage.label;
                });
              }
            });
          }
        } catch (stageError) {
          console.log(`   ⚠️  No se pudieron obtener nombres de etapas:`, stageError.message);
        }
        
        deals = dealResponses
          .filter(r => r !== null)
          .map(r => {
            const deal = r.data;
            const props = deal.properties || {};
            const stageId = props.dealstage;
            const pipelineId = props.pipeline;
            
            // Convertir IDs a nombres
            const stageName = stageMap[stageId] || stageId || 'unknown';
            const pipelineName = pipelineMap[pipelineId] || pipelineId || 'default';
            
            return {
              id: deal.id,
              name: props.dealname || 'Sin nombre',
              stage: stageName,
              stageId: stageId, // Mantener ID también por si acaso
              amount: parseFloat(props.amount || 0),
              currency: props.deal_currency_code || 'USD',
              closeDate: props.closedate || null,
              pipeline: pipelineName,
              pipelineId: pipelineId,
              type: props.dealtype || null,
              ownerId: props.hubspot_owner_id || null,
              createdDate: props.createdate || props.hs_createdate || null,
              lastModified: props.hs_lastmodifieddate || null,
              closedAmount: parseFloat(props.hs_closed_amount || 0)
            };
          });
        
        console.log(`   ✅ Obtenidos ${deals.length} negocios con detalles completos`);
      }
    } catch (error) {
      console.log(`   ⚠️  Error obteniendo deals:`, error.response?.data?.message || error.message);
    }

    // 4. Obtener historial completo de comunicaciones (ya filtradas en getContactCommunications)
    const communications = await getContactCommunications(contactId);

    // 5. Calcular días desde última comunicación
    const lastCommunication = communications.length > 0 ? communications[0] : null;
    const lastCommDate = lastCommunication ? new Date(lastCommunication.timestamp) : null;
    const daysSinceLastComm = lastCommDate ? Math.floor((new Date() - lastCommDate) / (1000 * 60 * 60 * 24)) : null;

    // Obtener props de manera segura
    const contactProps = contact.properties || {};
    
    console.log(`\n📊 RESUMEN DEL CONTACTO:`);
    console.log(`   Nombre: ${contactProps.firstname || ''} ${contactProps.lastname || ''}`.trim() || 'Sin nombre');
    console.log(`   Email: ${contactProps.email || 'N/A'}`);
    console.log(`   Empresa: ${companyData?.properties?.name || contactProps.company || 'N/A'}`);
    console.log(`   Negocios: ${deals.length}`);
    console.log(`   Comunicaciones: ${communications.length}`);
    console.log(`   Días desde última comunicación: ${daysSinceLastComm !== null ? daysSinceLastComm : 'N/A'}`);

    return {
      contact,
      company: companyData,
      deals,
      communications,
      daysSinceLastCommunication: daysSinceLastComm,
      lastCommunicationDate: lastCommDate
    };
  } catch (error) {
    console.error('Error fetching contact details:', error.response?.data || error.message);
    throw new Error(`Failed to fetch contact ${contactId} details`);
  }
};

/**
 * Obtener historial completo de comunicaciones de un contacto
 * Incluye: emails, llamadas, notas, reuniones, WhatsApp (si está registrado)
 */
const getContactCommunications = async (contactId) => {
  const communications = [];

  try {
    console.log(`   📞 Obteniendo comunicaciones del contacto ${contactId}...`);
    
    // Obtener todos los engagements (comunicaciones) del contacto
    // Esto incluye: emails, calls, notes, meetings, tasks
    const engagementsResponse = await hubspotClient.get(
      `/engagements/v1/engagements/associated/contact/${contactId}/paged`,
      {
        params: {
          limit: 100 // Aumentar límite para obtener más historial
        }
      }
    ).catch((error) => {
      console.log(`   ⚠️  Error obteniendo engagements:`, error.response?.data?.message || error.message);
      return { data: { results: [] } };
    });

    if (engagementsResponse.data.results) {
      engagementsResponse.data.results.forEach(engagement => {
        const eng = engagement.engagement;
        const metadata = engagement.metadata;
        const associations = engagement.associations || {};
        
        // Determinar tipo de comunicación
        let commType = eng.type || 'UNKNOWN';
        let subject = '';
        let body = '';
        let direction = 'outbound'; // Por defecto saliente
        
        // Procesar según el tipo
        switch (commType) {
          case 'EMAIL':
            subject = metadata?.subject || 'Sin asunto';
            body = metadata?.html || metadata?.text || '';
            direction = metadata?.direction === 'INCOMING' ? 'inbound' : 'outbound';
            break;
          case 'CALL':
            subject = metadata?.toNumber || metadata?.fromNumber || 'Llamada';
            body = metadata?.body || metadata?.notes || '';
            direction = metadata?.direction === 'INCOMING' ? 'inbound' : 'outbound';
            break;
          case 'NOTE':
            subject = metadata?.subject || 'Nota';
            body = metadata?.body || '';
            break;
          case 'MEETING':
            subject = metadata?.title || metadata?.subject || 'Reunión';
            body = metadata?.body || metadata?.notes || '';
            break;
          case 'TASK':
            subject = metadata?.subject || metadata?.body?.substring(0, 50) || 'Tarea';
            body = metadata?.body || '';
            break;
          default:
            subject = metadata?.subject || metadata?.body?.substring(0, 50) || 'Comunicación';
            body = metadata?.body || '';
        }
        
        // Filtrar tareas creadas por el sistema
        const isSystemTask = commType === 'TASK' && 
                            (subject.includes('💡 Ideas de Venta') || 
                             subject.includes('Ideas de Venta') ||
                             metadata?.subject?.includes('Ideas de Venta'));
        
        if (!isSystemTask) {
          communications.push({
            id: eng.id,
            type: commType,
            timestamp: eng.timestamp,
            date: new Date(eng.timestamp),
            subject: subject.substring(0, 200), // Limitar longitud
            body: body.substring(0, 500), // Limitar longitud para ahorrar tokens
            direction,
            createdBy: eng.createdBy,
            ownerId: eng.ownerId
          });
        }
      });
    }

    // Ordenar por fecha (más reciente primero)
    communications.sort((a, b) => b.timestamp - a.timestamp);
    
    // Filtrar una vez más por si acaso (doble verificación)
    const realCommunications = communications.filter(comm => {
      return !(comm.type === 'TASK' && comm.subject && 
               (comm.subject.includes('💡 Ideas de Venta') || comm.subject.includes('Ideas de Venta')));
    });
    
    const systemTasksCount = communications.length - realCommunications.length;
    if (systemTasksCount > 0) {
      console.log(`   ✅ Encontradas ${realCommunications.length} comunicaciones reales (excluyendo ${systemTasksCount} tareas del sistema)`);
    } else {
      console.log(`   ✅ Encontradas ${realCommunications.length} comunicaciones`);
    }
    
    return realCommunications;

  } catch (error) {
    console.log(`   ⚠️  Error fetching communications:`, error.message);
  }

  return communications;
};

/**
 * Buscar noticias de una empresa (usando dominio)
 * Nota: Esto requeriría una API de noticias externa (Google News API, NewsAPI, etc.)
 * Por ahora retorna array vacío, pero la estructura está lista
 */
const getCompanyNews = async (companyDomain) => {
  // TODO: Integrar con API de noticias
  // Ejemplo: NewsAPI, Google News, etc.
  return [];
};

/**
 * Obtener eventos próximos del calendario
 * Esto podría venir de:
 * - Una tabla/lista en Hubspot
 * - Google Calendar API
 * - Base de datos propia
 */
const getUpcomingEvents = async () => {
  // TODO: Implementar según tu fuente de eventos
  // Por ahora retornamos eventos de ejemplo
  return [
    {
      name: 'Webinar: Nuevas Estrategias de Venta',
      date: '2025-01-15',
      type: 'webinar'
    },
    {
      name: 'Demo Day: Producto Actualizado',
      date: '2025-01-20',
      type: 'demo'
    },
    {
      name: 'Networking Event',
      date: '2025-01-25',
      type: 'networking'
    }
  ];
};

/**
 * Crear una tarea en Hubspot asociada a un contacto
 */
const createTask = async (contactId, analysis) => {
  try {
    const taskBody = formatTaskBody(analysis);
    
    // Obtener el owner_id del contacto para asignar la tarea
    const ownerId = analysis.ownerId || null;
    
    const taskData = {
      properties: {
        hs_task_subject: `Ideas de Venta - ${analysis.contactName}`,
        hs_task_body: taskBody,
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: analysis.highPriority ? 'HIGH' : 'MEDIUM',
        hs_timestamp: new Date().toISOString(),
        hs_task_type: 'TODO'
      }
    };
    
    // Asignar la tarea al owner del contacto si existe
    if (ownerId) {
      taskData.properties.hubspot_owner_id = ownerId;
    }
    
    // Crear la tarea
    const taskResponse = await hubspotClient.post('/crm/v3/objects/tasks', taskData);
    const taskId = taskResponse.data.id;
    
    // Asociar la tarea al contacto
    await hubspotClient.put(
      `/crm/v3/objects/tasks/${taskId}/associations/contacts/${contactId}/204`
    );
    
    console.log(`✅ Task created for contact ${contactId}: ${taskId}`);
    if (ownerId) {
      console.log(`   Assigned to owner: ${ownerId}`);
    }
    
    return taskResponse.data;
  } catch (error) {
    console.error('Error creating task:', error.response?.data || error.message);
    throw new Error('Failed to create task in Hubspot');
  }
};

/**
 * Formatear el cuerpo de la tarea con el análisis
 */
const formatTaskBody = (analysis) => {
  let body = `RESUMEN DEL CONTACTO\n`;
  body += `${'='.repeat(50)}\n\n`;
  body += `Nombre: ${analysis.contactName}\n`;
  body += `Email: ${analysis.contactEmail}\n`;
  if (analysis.contactPhone) {
    body += `Teléfono: ${analysis.contactPhone}\n`;
  }
  body += `Empresa: ${analysis.company || 'No especificada'}\n`;
  body += `Etapa del ciclo: ${analysis.lifecycleStage}\n`;
  body += `Negocios activos: ${analysis.activeDeals || 0} de ${analysis.dealsCount || 0}\n`;
  body += `Última actividad: ${analysis.lastActivity}\n`;
  body += `Días sin contacto: ${analysis.daysSinceLastContact}\n\n`;
  
  body += `IDEAS DE VENTA\n`;
  body += `${'='.repeat(50)}\n\n`;
  
  analysis.ideas.forEach((idea, index) => {
    body += `IDEA ${index + 1}: ${idea.title}\n`;
    body += `${'-'.repeat(50)}\n`;
    body += `Tipo de comunicación: ${idea.type}\n`;
    body += `Prioridad: ${idea.priority}\n\n`;
    body += `Razón:\n${idea.reason}\n\n`;
    body += `Acción sugerida:\n${idea.action}\n\n`;
    if (idea.suggestedTiming) {
      body += `Momento sugerido: ${idea.suggestedTiming}\n\n`;
    }
  });

  if (analysis.deals && analysis.deals.length > 0) {
    body += `NEGOCIOS ASOCIADOS\n`;
    body += `${'='.repeat(50)}\n\n`;
    analysis.deals.forEach((deal, index) => {
      body += `${index + 1}. ${deal.name}\n`;
      body += `   Etapa: ${deal.stage}\n`;
      body += `   Monto: ${deal.currency} ${deal.amount.toLocaleString()}\n`;
      if (deal.closeDate) {
        body += `   Fecha de cierre: ${deal.closeDate}\n`;
      }
      body += `\n`;
    });
  }

  if (analysis.communications && analysis.communications.length > 0) {
    body += `ÚLTIMAS COMUNICACIONES\n`;
    body += `${'='.repeat(50)}\n\n`;
    analysis.communications.slice(0, 5).forEach((comm, index) => {
      body += `${index + 1}. ${comm.type} - ${comm.subject}\n`;
      body += `   Hace ${comm.daysAgo} días (${comm.date})\n`;
      body += `   Dirección: ${comm.direction === 'inbound' ? 'Entrante' : 'Saliente'}\n\n`;
    });
  }
  
  body += `${'='.repeat(50)}\n`;
  body += `Generado automáticamente el ${new Date().toLocaleString('es-ES')}\n`;
  body += `Método: ${analysis.generatedWithAI ? 'Inteligencia Artificial' : 'Reglas automáticas'}`;
  
  return body;
};

module.exports = {
  getContacts,
  getContactsFromList,
  getContactDetails,
  getContactCommunications,
  getCompanyNews,
  getUpcomingEvents,
  createTask
};
