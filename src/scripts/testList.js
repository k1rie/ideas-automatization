#!/usr/bin/env node

/**
 * Script para probar y diagnosticar problemas con la lista
 * Uso: npm run test-list
 */

require('dotenv').config();
const hubspotService = require('../services/hubspotService');

const testList = async () => {
  const segmentId = process.env.HUBSPOT_LIST_ID || '13121';
  
  console.log('\n🔍 DIAGNÓSTICO DE SEGMENTO');
  console.log('='.repeat(60));
  console.log(`Segmento ID: ${segmentId}`);
  console.log(`API Key configurada: ${process.env.HUBSPOT_API_KEY ? '✅ Sí' : '❌ No'}\n`);

  if (!process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_API_KEY === 'your_hubspot_api_key_here') {
    console.error('❌ Error: HUBSPOT_API_KEY no está configurado');
    console.log('   Edita el archivo .env y agrega tu API key de Hubspot\n');
    process.exit(1);
  }

  try {
    console.log('📋 Intentando obtener contactos del segmento...\n');
    const contacts = await hubspotService.getContactsFromList(segmentId);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ RESULTADO');
    console.log('='.repeat(60));
    console.log(`Contactos encontrados: ${contacts.length}\n`);
    
    if (contacts.length > 0) {
      console.log('Primeros 5 contactos:');
      contacts.slice(0, 5).forEach((contact, index) => {
        const props = contact.properties || {};
        console.log(`\n${index + 1}. ID: ${contact.id}`);
        console.log(`   Nombre: ${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Sin nombre');
        console.log(`   Email: ${props.email || 'Sin email'}`);
        console.log(`   Empresa: ${props.company || 'Sin empresa'}`);
      });
      
      if (contacts.length > 5) {
        console.log(`\n... y ${contacts.length - 5} contactos más`);
      }
    } else {
      console.log('⚠️  No se encontraron contactos');
      console.log('\nPosibles causas:');
      console.log('   1. El segmento está vacío (no hay contactos que cumplan los filtros)');
      console.log('   2. El segmento no existe');
      console.log('   3. No tienes permisos para acceder al segmento');
      console.log('   4. El ID del segmento es incorrecto');
      console.log('\n💡 Verifica en Hubspot:');
      console.log(`   https://app.hubspot.com/contacts/lists/${segmentId}`);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error.message);
    console.error('\n💡 Soluciones:');
    console.error('   1. Verifica que el ID del segmento sea correcto');
    console.error('   2. Verifica que tu API key tenga los permisos necesarios');
    console.error('   3. Verifica que el segmento exista en tu cuenta de Hubspot');
    console.error('   4. Verifica que el segmento tenga contactos que cumplan los filtros');
    console.error('   5. Revisa los logs arriba para más detalles');
    process.exit(1);
  }
};

if (require.main === module) {
  testList();
}

module.exports = { testList };

