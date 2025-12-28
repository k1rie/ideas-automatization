#!/usr/bin/env node

/**
 * Script para analizar todos los contactos inmediatamente
 * Uso: npm run analyze-now
 * Funciona directamente sin necesidad del servidor
 */

require('dotenv').config();
const hubspotService = require('../services/hubspotService');
const analysisService = require('../services/analysisService');

const analyzeAllNow = async () => {
  console.log('\n🚀 Iniciando análisis inmediato de todos los contactos...\n');
  console.log(`📋 Segmento: ${process.env.HUBSPOT_LIST_ID || '13121'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`🔗 Hubspot: ${process.env.HUBSPOT_API_KEY && process.env.HUBSPOT_API_KEY !== 'your_hubspot_api_key_here' ? '✅ Configurado' : '❌ No configurado'}\n`);

  if (!process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_API_KEY === 'your_hubspot_api_key_here') {
    console.error('❌ Error: HUBSPOT_API_KEY no está configurado');
    console.log('   Edita el archivo .env y agrega tu API key de Hubspot\n');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.warn('⚠️  Advertencia: OPENAI_API_KEY no está configurado');
    console.log('   El sistema usará ideas basadas en reglas\n');
  }

  try {
    const startTime = Date.now();
    
    console.log('📋 Obteniendo contactos del segmento...\n');
    
    // Obtener contactos directamente
    const contacts = await hubspotService.getContacts();
    
    if (contacts.length === 0) {
      console.log('⚠️  No se encontraron contactos en el segmento\n');
      process.exit(0);
    }
    
    console.log(`✅ Encontrados ${contacts.length} contactos\n`);
    console.log('🔄 Iniciando análisis...\n');
    
    const results = [];
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const contactNum = i + 1;
      
      try {
        console.log(`\n[${contactNum}/${contacts.length}] 📊 Analizando: ${contact.properties?.email || contact.id}`);
        
        // Obtener datos del contacto
        const contactData = await hubspotService.getContactDetails(contact.id);
        
        // Generar análisis e ideas
        const analysis = await analysisService.generateSalesIdeas(contactData);
        
        // Crear task en Hubspot (con todas las ideas consolidadas)
        const task = await hubspotService.createTask(contact.id, analysis);
        
        console.log(`   ✅ Tarea Hubspot creada: ${task.id}`);
        if (analysis.ownerId) {
          console.log(`   👤 Asignada a: ${analysis.ownerId}`);
        }
        console.log(`   💡 Ideas incluidas: ${analysis.ideas.length}`);
        console.log(`   💡 Ver: https://app.hubspot.com/contacts/tasks/${task.id}`);
        
        results.push({
          contactId: contact.id,
          email: contact.properties?.email || analysis.contactEmail || 'N/A',
          success: true,
          taskId: task.id,
          assignedTo: analysis.ownerId || 'Unassigned',
          ideasCount: analysis.ideas.length,
          generatedWithAI: analysis.generatedWithAI
        });
        
        // Pausa para no saturar APIs (Hubspot y OpenAI)
        if (i < contacts.length - 1) {
          console.log(`   ⏳ Esperando 2 segundos antes del siguiente contacto...\n`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        results.push({
          contactId: contact.id,
          success: false,
          error: error.message
        });
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ANÁLISIS COMPLETADO');
    console.log('='.repeat(60));
    console.log(`\n📊 Resultados:`);
    console.log(`   Total procesados: ${results.length}`);
    console.log(`   Exitosos: ${results.filter(r => r.success).length} ✅`);
    console.log(`   Fallidos: ${results.filter(r => !r.success).length} ❌`);
    console.log(`   Tiempo total: ${duration}s`);
    console.log(`   Promedio: ${(duration / results.length).toFixed(2)}s por contacto\n`);

    if (results.length > 0) {
      console.log('📋 Detalle de contactos procesados:\n');
      
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const aiStatus = result.generatedWithAI ? '🤖' : '📋';
        console.log(`   ${index + 1}. ${status} ${aiStatus} ${result.email || result.contactId}`);
        if (result.success && result.taskId) {
          console.log(`      Task ID: ${result.taskId}`);
          console.log(`      Asignada a: ${result.assignedTo}`);
          console.log(`      Ideas: ${result.ideasCount}`);
          console.log(`      Link: https://app.hubspot.com/contacts/tasks/${result.taskId}`);
        }
        if (!result.success && result.error) {
          console.log(`      Error: ${result.error}`);
        }
        console.log('');
      });
    }

    console.log('💡 Revisa todas las tareas creadas en Hubspot:');
    console.log('   https://app.hubspot.com/contacts/tasks\n');

  } catch (error) {
    console.error('\n❌ Error ejecutando análisis:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('autenticación') || error.message.includes('API key')) {
      console.error('💡 Verifica tu HUBSPOT_API_KEY en el archivo .env\n');
    }
    
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  analyzeAllNow();
}

module.exports = { analyzeAllNow };
