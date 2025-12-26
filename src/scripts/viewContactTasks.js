#!/usr/bin/env node

/**
 * Script para ver las tareas de un contacto específico
 * Uso: npm run view-tasks <CONTACT_ID>
 */

require('dotenv').config();
const axios = require('axios');

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const API_KEY = process.env.HUBSPOT_API_KEY;

const hubspotClient = axios.create({
  baseURL: HUBSPOT_API_BASE,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const viewContactTasks = async (contactId) => {
  if (!contactId) {
    console.error('\n❌ Error: Debes proporcionar un CONTACT_ID');
    console.log('   Uso: npm run view-tasks <CONTACT_ID>\n');
    process.exit(1);
  }

  if (!API_KEY || API_KEY === 'your_hubspot_api_key_here') {
    console.error('❌ Error: HUBSPOT_API_KEY no está configurado');
    console.log('   Edita el archivo .env y agrega tu API key de Hubspot\n');
    process.exit(1);
  }

  try {
    console.log(`\n📋 Obteniendo tareas del contacto: ${contactId}\n`);

    // Obtener información del contacto
    const contactResponse = await hubspotClient.get(`/crm/v3/objects/contacts/${contactId}`, {
      params: {
        properties: 'email,firstname,lastname,company'
      }
    });

    const contact = contactResponse.data;
    const props = contact.properties || {};
    const contactName = `${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Sin nombre';
    const contactEmail = props.email || 'N/A';

    console.log(`👤 Contacto: ${contactName}`);
    console.log(`   Email: ${contactEmail}`);
    console.log(`   Empresa: ${props.company || 'N/A'}\n`);

    // Obtener tareas asociadas al contacto
    const tasksResponse = await hubspotClient.get(
      `/crm/v3/objects/contacts/${contactId}/associations/tasks`
    );

    const taskAssociations = tasksResponse.data.results || [];

    if (taskAssociations.length === 0) {
      console.log('ℹ️  No hay tareas asociadas a este contacto\n');
      console.log('💡 Ver contacto en Hubspot:');
      console.log(`   https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID || 'YOUR_PORTAL_ID'}/contact/${contactId}\n`);
      return;
    }

    console.log(`📋 Encontradas ${taskAssociations.length} tarea(s) asociada(s)\n`);

    // Obtener detalles de cada tarea
    const taskIds = taskAssociations.map(t => t.id);
    
    console.log('📥 Obteniendo detalles de las tareas...\n');

    const taskPromises = taskIds.map(taskId =>
      hubspotClient.get(`/crm/v3/objects/tasks/${taskId}`, {
        params: {
          properties: 'hs_task_subject,hs_task_body,hs_task_status,hs_task_priority,hs_timestamp,createdate,hs_task_type'
        }
      }).catch(error => {
        console.warn(`   ⚠️  No se pudo obtener tarea ${taskId}: ${error.response?.data?.message || error.message}`);
        return null;
      })
    );

    const taskResponses = await Promise.all(taskPromises);
    const tasks = taskResponses.filter(r => r !== null).map(r => r.data);

    // Ordenar por fecha (más reciente primero)
    tasks.sort((a, b) => {
      const dateA = new Date(a.properties?.hs_timestamp || a.properties?.createdate || 0);
      const dateB = new Date(b.properties?.hs_timestamp || b.properties?.createdate || 0);
      return dateB - dateA;
    });

    console.log('='.repeat(60));
    console.log(`📋 TAREAS DEL CONTACTO (${tasks.length})`);
    console.log('='.repeat(60) + '\n');

    tasks.forEach((task, index) => {
      const taskProps = task.properties || {};
      const taskDate = taskProps.hs_timestamp || taskProps.createdate;
      const formattedDate = taskDate ? new Date(taskDate).toLocaleString('es-ES') : 'N/A';
      
      const priorityEmoji = taskProps.hs_task_priority === 'HIGH' ? '🔴' : 
                           taskProps.hs_task_priority === 'MEDIUM' ? '🟡' : '🟢';
      
      const statusEmoji = taskProps.hs_task_status === 'COMPLETED' ? '✅' :
                         taskProps.hs_task_status === 'IN_PROGRESS' ? '🔄' : '📝';

      console.log(`${index + 1}. ${statusEmoji} ${priorityEmoji} ${taskProps.hs_task_subject || 'Sin título'}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Estado: ${taskProps.hs_task_status || 'N/A'}`);
      console.log(`   Prioridad: ${taskProps.hs_task_priority || 'N/A'}`);
      console.log(`   Fecha: ${formattedDate}`);
      console.log(`   Tipo: ${taskProps.hs_task_type || 'N/A'}`);
      
      if (taskProps.hs_task_body) {
        const bodyPreview = taskProps.hs_task_body.substring(0, 150);
        console.log(`   Contenido: ${bodyPreview}${taskProps.hs_task_body.length > 150 ? '...' : ''}`);
      }
      
      console.log(`   Link: https://app.hubspot.com/contacts/tasks/${task.id}`);
      console.log('');
    });

    console.log('💡 Ver todas las tareas en Hubspot:');
    console.log(`   https://app.hubspot.com/contacts/tasks\n`);
    console.log('💡 Ver contacto completo:');
    console.log(`   https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID || 'YOUR_PORTAL_ID'}/contact/${contactId}\n`);

  } catch (error) {
    console.error('\n❌ Error obteniendo tareas:');
    
    if (error.response?.status === 401) {
      console.error('   Error de autenticación. Verifica tu HUBSPOT_API_KEY\n');
    } else if (error.response?.status === 404) {
      console.error(`   El contacto ${contactId} no existe o no tienes acceso\n`);
    } else {
      console.error(`   ${error.response?.data?.message || error.message}\n`);
    }
    
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  const contactId = process.argv[2];
  viewContactTasks(contactId);
}

module.exports = { viewContactTasks };


