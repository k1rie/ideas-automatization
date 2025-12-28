const hubspotService = require('../services/hubspotService');
const analysisService = require('../services/analysisService');

/**
 * Obtener todos los contactos de Hubspot
 */
const getAllContacts = async (req, res) => {
  try {
    const contacts = await hubspotService.getContacts();
    res.json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error) {
    console.error('Error getting contacts:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener un contacto específico con sus detalles
 */
const getContactById = async (req, res) => {
  try {
    const { contactId } = req.params;
    const contactData = await hubspotService.getContactDetails(contactId);
    
    res.json({
      success: true,
      data: contactData
    });
  } catch (error) {
    console.error('Error getting contact:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Analizar un contacto específico y crear task en Hubspot
 */
const analyzeContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    
    console.log(`📊 Analyzing contact: ${contactId}`);
    
    // Obtener datos del contacto
    const contactData = await hubspotService.getContactDetails(contactId);
    
    // Generar análisis e ideas (con ChatGPT)
    const analysis = await analysisService.generateSalesIdeas(contactData);
    
    // Crear task en Hubspot con todas las ideas
    const task = await hubspotService.createTask(contactId, analysis);
    
    res.json({
      success: true,
      data: {
        contact: contactData.contact,
        company: contactData.company,
        analysis,
        task
      }
    });
  } catch (error) {
    console.error('Error analyzing contact:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Analizar todos los contactos (usado por el scheduler)
 */
const analyzeAllContacts = async (req, res) => {
  try {
    console.log('🔄 Starting analysis of all contacts...');
    
    const contacts = await hubspotService.getContacts();
    const results = [];
    
    for (const contact of contacts) {
      try {
        const contactData = await hubspotService.getContactDetails(contact.id);
        const analysis = await analysisService.generateSalesIdeas(contactData);
        const task = await hubspotService.createTask(contact.id, analysis);
        
        results.push({
          contactId: contact.id,
          email: contact.properties?.email || analysis.contactEmail || 'N/A',
          success: true,
          taskId: task.id,
          generatedWithAI: analysis.generatedWithAI,
          assignedTo: analysis.ownerId || 'Unassigned'
        });
        
        // Pausa para no saturar APIs (Hubspot y OpenAI)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error.message);
        results.push({
          contactId: contact.id,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Analysis completed. Processed ${results.length} contacts`);
    
    res.json({
      success: true,
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    console.error('Error analyzing all contacts:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  getAllContacts,
  getContactById,
  analyzeContact,
  analyzeAllContacts
};

