#!/usr/bin/env node

/**
 * Script para ver información completa de un contacto y sus negocios
 * Uso: npm run view-contact <CONTACT_ID>
 */

require('dotenv').config();
const hubspotService = require('../services/hubspotService');

const viewContactInfo = async (contactId) => {
  if (!contactId) {
    console.error('\n❌ Error: Debes proporcionar un CONTACT_ID');
    console.log('   Uso: npm run view-contact <CONTACT_ID>\n');
    process.exit(1);
  }

  if (!process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_API_KEY === 'your_hubspot_api_key_here') {
    console.error('❌ Error: HUBSPOT_API_KEY no está configurado');
    console.log('   Edita el archivo .env y agrega tu API key de Hubspot\n');
    process.exit(1);
  }

  try {
    console.log(`\n📊 Obteniendo información completa del contacto: ${contactId}\n`);

    // Obtener todos los datos del contacto
    const contactData = await hubspotService.getContactDetails(contactId);
    
    const { contact, company, deals, communications, daysSinceLastCommunication } = contactData;
    const props = contact.properties || {};

    // Información del contacto
    const contactName = `${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Sin nombre';
    const contactEmail = props.email || 'Sin email';
    const contactPhone = props.phone || null;
    const lifecycleStage = props.lifecyclestage || 'unknown';
    const createdDate = props.createdate ? new Date(props.createdate) : null;
    const lastModified = props.lastmodifieddate ? new Date(props.lastmodifieddate) : null;

    console.log('='.repeat(70));
    console.log('👤 INFORMACIÓN DEL CONTACTO');
    console.log('='.repeat(70));
    console.log(`\n📋 Datos Básicos:`);
    console.log(`   Nombre: ${contactName}`);
    console.log(`   Email: ${contactEmail}`);
    if (contactPhone) console.log(`   Teléfono: ${contactPhone}`);
    console.log(`   Etapa del ciclo de vida: ${lifecycleStage}`);
    console.log(`   Lead Status: ${props.hs_lead_status || 'N/A'}`);
    if (createdDate) {
      console.log(`   Fecha de creación: ${createdDate.toLocaleDateString('es-ES')}`);
      const daysSinceCreation = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
      console.log(`   Días desde creación: ${daysSinceCreation}`);
    }
    if (lastModified) {
      console.log(`   Última modificación: ${lastModified.toLocaleDateString('es-ES')}`);
      const daysSinceModification = Math.floor((new Date() - lastModified) / (1000 * 60 * 60 * 24));
      console.log(`   Días desde modificación: ${daysSinceModification}`);
    }
    console.log(`   Días sin contacto: ${daysSinceLastCommunication !== null ? daysSinceLastCommunication : 'N/A'}`);

    // Información de la empresa
    if (company) {
      const companyProps = company.properties || {};
      console.log(`\n🏢 INFORMACIÓN DE LA EMPRESA`);
      console.log('='.repeat(70));
      console.log(`   Nombre: ${companyProps.name || 'N/A'}`);
      if (companyProps.domain) console.log(`   Dominio: ${companyProps.domain}`);
      if (companyProps.industry) console.log(`   Industria: ${companyProps.industry}`);
      if (companyProps.numberofemployees) console.log(`   Empleados: ${companyProps.numberofemployees}`);
      if (companyProps.annualrevenue) console.log(`   Ingresos anuales: ${companyProps.annualrevenue}`);
      if (companyProps.website) console.log(`   Website: ${companyProps.website}`);
      if (companyProps.phone) console.log(`   Teléfono: ${companyProps.phone}`);
      if (companyProps.city || companyProps.state || companyProps.country) {
        const location = [companyProps.city, companyProps.state, companyProps.country].filter(Boolean).join(', ');
        console.log(`   Ubicación: ${location || 'N/A'}`);
      }
      if (companyProps.description) {
        const desc = companyProps.description.substring(0, 200);
        console.log(`   Descripción: ${desc}${companyProps.description.length > 200 ? '...' : ''}`);
      }
    } else {
      console.log(`\n🏢 EMPRESA`);
      console.log('='.repeat(70));
      console.log(`   No hay empresa asociada`);
      if (props.company) {
        console.log(`   (Campo company en contacto: ${props.company})`);
      }
    }

    // Negocios (Deals) asociados
    console.log(`\n💼 NEGOCIOS ASOCIADOS (${deals.length})`);
    console.log('='.repeat(70));
    
    if (deals.length === 0) {
      console.log(`   No hay negocios asociados\n`);
    } else {
      deals.forEach((deal, index) => {
        // Manejar diferentes formatos de deals
        const dealProps = deal.properties || {};
        const dealName = deal.name || dealProps.dealname || 'Sin nombre';
        const dealStage = deal.stage || dealProps.dealstage || 'unknown';
        const dealAmount = parseFloat(deal.amount || dealProps.amount || 0);
        const dealCurrency = deal.currency || dealProps.deal_currency_code || 'USD';
        const closeDate = deal.closeDate || dealProps.closedate || null;
        const pipeline = deal.pipeline || dealProps.pipeline || 'default';
        const dealType = deal.type || dealProps.dealtype || null;
        const lastModified = deal.lastModified || dealProps.hs_lastmodifieddate || null;
        
        console.log(`\n   ${index + 1}. ${dealName}`);
        console.log(`      ID: ${deal.id}`);
        console.log(`      Etapa: ${dealStage}`);
        console.log(`      Pipeline: ${pipeline}`);
        if (dealAmount > 0) {
          console.log(`      Monto: ${dealCurrency} ${dealAmount.toLocaleString()}`);
        } else {
          console.log(`      Monto: No especificado`);
        }
        if (closeDate) {
          try {
            const closeDateObj = new Date(closeDate);
            if (!isNaN(closeDateObj.getTime())) {
              console.log(`      Fecha de cierre: ${closeDateObj.toLocaleDateString('es-ES')}`);
              const daysUntilClose = Math.floor((closeDateObj - new Date()) / (1000 * 60 * 60 * 24));
              if (daysUntilClose > 0) {
                console.log(`      Días hasta cierre: ${daysUntilClose}`);
              } else if (daysUntilClose < 0) {
                console.log(`      ⚠️  Fecha de cierre pasada (hace ${Math.abs(daysUntilClose)} días)`);
              } else {
                console.log(`      ⚠️  Fecha de cierre es hoy`);
              }
            }
          } catch (e) {
            console.log(`      Fecha de cierre: ${closeDate}`);
          }
        }
        if (dealType) {
          console.log(`      Tipo: ${dealType}`);
        }
        if (lastModified) {
          try {
            const lastMod = new Date(lastModified);
            if (!isNaN(lastMod.getTime())) {
              const daysSinceMod = Math.floor((new Date() - lastMod) / (1000 * 60 * 60 * 24));
              console.log(`      Última modificación: hace ${daysSinceMod} días`);
            }
          } catch (e) {
            // Ignorar errores de fecha
          }
        }
        console.log(`      Link: https://app.hubspot.com/deals/${deal.id}`);
      });
      
      // Resumen de negocios
      const totalAmount = deals.reduce((sum, d) => {
        const amount = parseFloat(d.amount || d.properties?.amount || 0);
        return sum + amount;
      }, 0);
      
      const activeDeals = deals.filter(d => {
        const stage = (d.stage || d.properties?.dealstage || '').toLowerCase();
        return stage && !stage.includes('closed') && !stage.includes('won') && !stage.includes('lost');
      });
      
      const currency = deals[0]?.currency || deals[0]?.properties?.deal_currency_code || 'USD';
      
      console.log(`\n   📊 RESUMEN:`);
      console.log(`      Total negocios: ${deals.length}`);
      console.log(`      Negocios activos: ${activeDeals.length}`);
      if (totalAmount > 0) {
        console.log(`      Monto total: ${currency} ${totalAmount.toLocaleString()}`);
      }
    }

    // Comunicaciones recientes
    console.log(`\n📞 COMUNICACIONES RECIENTES (${communications.length} total)`);
    console.log('='.repeat(70));
    
    if (communications.length === 0) {
      console.log(`   No hay comunicaciones registradas\n`);
    } else {
      const recentComms = communications.slice(0, 10);
      recentComms.forEach((comm, index) => {
        const commDate = new Date(comm.timestamp);
        const daysAgo = Math.floor((new Date() - commDate) / (1000 * 60 * 60 * 24));
        const direction = comm.direction === 'inbound' ? '←' : '→';
        
        console.log(`\n   ${index + 1}. ${direction} ${comm.type} (hace ${daysAgo} días)`);
        console.log(`      Fecha: ${commDate.toLocaleString('es-ES')}`);
        console.log(`      Asunto: ${comm.subject || 'Sin asunto'}`);
        if (comm.direction) {
          console.log(`      Dirección: ${comm.direction === 'inbound' ? 'Entrante' : 'Saliente'}`);
        }
      });
      
      if (communications.length > 10) {
        console.log(`\n   ... y ${communications.length - 10} comunicación(es) más`);
      }
    }

    // Links útiles
    console.log(`\n🔗 LINKS ÚTILES`);
    console.log('='.repeat(70));
    console.log(`   Ver contacto en Hubspot:`);
    console.log(`   https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID || 'YOUR_PORTAL_ID'}/contact/${contactId}`);
    console.log(`\n   Ver tareas del contacto:`);
    console.log(`   npm run view-tasks ${contactId}`);
    console.log(`\n   Analizar contacto:`);
    console.log(`   npm run analyze-one ${contactId}\n`);

  } catch (error) {
    console.error('\n❌ Error obteniendo información:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('autenticación') || error.message.includes('API key')) {
      console.error('💡 Verifica tu HUBSPOT_API_KEY en el archivo .env\n');
    } else if (error.message.includes('404') || error.message.includes('no existe')) {
      console.error(`💡 El contacto ${contactId} no existe o no tienes acceso\n`);
    }
    
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  const contactId = process.argv[2];
  viewContactInfo(contactId);
}

module.exports = { viewContactInfo };

