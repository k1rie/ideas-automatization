#!/usr/bin/env node

/**
 * Script para listar todos los contactos de la lista
 * Uso: npm run list-contacts
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';

const listContacts = async () => {
  console.log('\n📋 Obteniendo contactos del segmento...\n');
  console.log(`   Segmento ID: ${process.env.HUBSPOT_LIST_ID || '13121'}\n`);

  try {
    const response = await axios.get(`${API_URL}/api/contacts`, {
      timeout: 30000
    });

    const contacts = response.data.data;

    console.log('='.repeat(60));
    console.log(`✅ CONTACTOS ENCONTRADOS: ${contacts.length}`);
    console.log('='.repeat(60) + '\n');

    if (contacts.length === 0) {
      console.log('⚠️  No hay contactos en el segmento');
      console.log('   Verifica que el segmento 13121 tenga contactos que cumplan los filtros\n');
      return;
    }

    contacts.forEach((contact, index) => {
      const props = contact.properties;
      const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Sin nombre';
      const email = props.email || 'Sin email';
      const company = props.company || 'Sin empresa';
      const stage = props.lifecyclestage || 'Sin etapa';

      console.log(`${index + 1}. ${name}`);
      console.log(`   ID: ${contact.id}`);
      console.log(`   Email: ${email}`);
      console.log(`   Empresa: ${company}`);
      console.log(`   Etapa: ${stage}\n`);
    });

    console.log('💡 Para analizar un contacto específico:');
    console.log('   npm run analyze-one <CONTACT_ID>\n');
    
    console.log('💡 Para analizar todos los contactos:');
    console.log('   npm run analyze-now\n');

  } catch (error) {
    console.error('\n❌ Error obteniendo contactos:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   El servidor no está corriendo');
      console.error('   Ejecuta: npm run dev\n');
    } else if (error.response) {
      console.error(`   ${error.response.data.error || error.message}\n`);
    } else {
      console.error(`   ${error.message}\n`);
    }
    
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  listContacts();
}

module.exports = { listContacts };

