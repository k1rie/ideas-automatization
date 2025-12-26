#!/usr/bin/env node

/**
 * Script para analizar un contacto específico inmediatamente
 * Uso: npm run analyze-one <CONTACT_ID>
 * Funciona directamente sin necesidad del servidor
 */

require('dotenv').config();
const hubspotService = require('../services/hubspotService');
const analysisService = require('../services/analysisService');
const clickupService = require('../services/clickupService');

const analyzeOne = async (contactId) => {
  if (!contactId) {
    console.error('\n❌ Error: Debes proporcionar un CONTACT_ID');
    console.log('   Uso: npm run analyze-one <CONTACT_ID>\n');
    process.exit(1);
  }

  console.log('\n🚀 Analizando contacto:', contactId);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`🔗 Hubspot: ${process.env.HUBSPOT_API_KEY && process.env.HUBSPOT_API_KEY !== 'your_hubspot_api_key_here' ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`📝 ClickUp: ${clickupService.isConfigured() ? '✅ Configurado' : '❌ No configurado'}\n`);

  if (!process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_API_KEY === 'your_hubspot_api_key_here') {
    console.error('❌ Error: HUBSPOT_API_KEY no está configurado');
    console.log('   Edita el archivo .env y agrega tu API key de Hubspot\n');
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    
    console.log('📊 Obteniendo datos del contacto...\n');
    
    // Obtener datos del contacto directamente
    const contactData = await hubspotService.getContactDetails(contactId);
    
    console.log('\n🤖 Generando ideas con ChatGPT...\n');
    
    // Generar análisis e ideas
    const analysis = await analysisService.generateSalesIdeas(contactData);
    
    console.log('\n📝 Creando tarea en Hubspot...\n');
    
    // Crear task en Hubspot
    const task = await hubspotService.createTask(contactId, analysis);
    
    console.log(`   ✅ Tarea Hubspot creada: ${task.id}`);
    console.log(`   💡 Ver: https://app.hubspot.com/contacts/tasks/${task.id}`);
    
    // Crear tareas en ClickUp (una por cada idea)
    let clickupTasks = [];
    if (clickupService.isConfigured() && analysis.ideas && analysis.ideas.length > 0) {
      console.log(`\n📝 Creando ${analysis.ideas.length} tarea(s) en ClickUp...\n`);
      const contactInfo = {
        contactName: analysis.contactName,
        contactEmail: analysis.contactEmail,
        company: analysis.company
      };
      clickupTasks = await clickupService.createTasksForIdeas(analysis.ideas, contactInfo);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const { contact, company } = contactData;
    const props = contact.properties || {};

    console.log('\n' + '='.repeat(60));
    console.log('✅ ANÁLISIS COMPLETADO');
    console.log('='.repeat(60));
    
    // Obtener la etapa del negocio (deal stage) en lugar de la del contacto
    const dealStage = contactData.deals && contactData.deals.length > 0 
      ? contactData.deals[0].stage 
      : 'Sin negocios';
    
    console.log(`\n👤 CONTACTO:`);
    console.log(`   Nombre: ${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Sin nombre');
    console.log(`   Email: ${props.email || 'N/A'}`);
    console.log(`   Empresa: ${company?.properties?.name || props.company || 'No especificada'}`);
    console.log(`   Etapa del negocio: ${dealStage}`);
    if (props.lifecyclestage && props.lifecyclestage !== dealStage) {
      console.log(`   Etapa del contacto (Hubspot): ${props.lifecyclestage} (no usar para recomendaciones)`);
    }
    
    console.log(`\n📊 ANÁLISIS:`);
    console.log(`   Negocios: ${analysis.dealsCount}`);
    console.log(`   Negocios activos: ${analysis.activeDeals || 0}`);
    console.log(`   Monto total: $${analysis.totalDealAmount || 0}`);
    console.log(`   Comunicaciones: ${analysis.totalCommunications || 0}`);
    console.log(`   Última actividad: ${analysis.lastActivity}`);
    console.log(`   Días sin contacto: ${analysis.daysSinceLastContact}`);
    console.log(`   Generado con IA: ${analysis.generatedWithAI ? '✅ Sí' : '❌ No'}`);
    
    console.log(`\n💡 IDEAS GENERADAS:\n`);
    analysis.ideas.forEach((idea, index) => {
      const priorityEmoji = idea.priority === 'Alta' ? '🔴' : idea.priority === 'Media' ? '🟡' : '🟢';
      console.log(`   ${index + 1}. ${idea.title} ${priorityEmoji}`);
      console.log(`      Tipo: ${idea.type}`);
      console.log(`      Razón: ${idea.reason}`);
      console.log(`      Acción: ${idea.action}`);
      console.log(`      Prioridad: ${idea.priority}`);
      if (idea.suggestedTiming) {
        console.log(`      Timing: ${idea.suggestedTiming}`);
      }
      console.log('');
    });

    console.log(`✅ Tarea creada en Hubspot`);
    console.log(`   Task ID: ${task.id}`);
    if (clickupTasks.length > 0) {
      console.log(`✅ ${clickupTasks.length} tarea(s) creada(s) en ClickUp`);
      clickupTasks.forEach((t, idx) => {
        console.log(`   ${idx + 1}. ${t.name}`);
        if (t.url) console.log(`      🔗 ${t.url}`);
      });
    }
    console.log(`   Tiempo total: ${duration}s\n`);

    console.log('💡 Ver tarea en Hubspot:');
    console.log(`   https://app.hubspot.com/contacts/tasks/${task.id}\n`);
    if (clickupTasks.length > 0) {
      console.log('💡 Ver tareas en ClickUp:');
      clickupTasks.forEach(t => {
        if (t.url) console.log(`   ${t.url}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Error analizando contacto:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('autenticación') || error.message.includes('API key')) {
      console.error('💡 Verifica tu HUBSPOT_API_KEY en el archivo .env\n');
    } else if (error.message.includes('OpenAI') || error.message.includes('ChatGPT')) {
      console.error('💡 Verifica tu OPENAI_API_KEY en el archivo .env\n');
    }
    
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  const contactId = process.argv[2];
  analyzeOne(contactId);
}

module.exports = { analyzeOne };

