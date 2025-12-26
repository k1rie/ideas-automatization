const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// URL de la guía en Google Docs
const GUIDE_DOC_ID = '1_srPqIupwNV8hNxFShXAbe8RUD3K4565vemu--Ba1Cs';
const GUIDE_URL = `https://docs.google.com/document/d/${GUIDE_DOC_ID}/export?format=txt`;

/**
 * Obtener la guía de Google Docs (siempre actualizada)
 * Intenta múltiples formatos de exportación
 */
const getSalesGuide = async () => {
  try {
    console.log(`   📖 Obteniendo guía de ventas desde Google Docs...`);
    
    const url = `https://docs.google.com/document/d/${GUIDE_DOC_ID}/export?format=txt`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const guideContent = response.data || '';
    
    // Limpiar y limitar contenido
    const cleanedGuide = guideContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .substring(0, 4000); // Limitar a 4000 caracteres para ahorrar tokens
    
    if (cleanedGuide.length > 50) {
      console.log(`   ✅ Guía obtenida (${cleanedGuide.length} caracteres)`);
      return cleanedGuide;
    }
    
    console.warn('   ⚠️  La guía está vacía o es muy corta');
    return null;
  } catch (error) {
    console.warn(`   ⚠️  No se pudo obtener la guía: ${error.message}`);
    console.warn('   💡 Asegúrate de que el documento sea público o compartido');
    console.warn('   Continuando sin la guía...');
    return null;
  }
};

/**
 * Generar ideas de venta usando ChatGPT
 */
const generateSalesIdeas = async (contactContext) => {
  try {
    // Obtener la guía actualizada de Google Docs
    const salesGuide = await getSalesGuide();
    
    const prompt = buildOptimizedPrompt(contactContext, salesGuide);
    
    // Construir system message con la guía
    let systemMessage = "Eres un experto en ventas B2B que genera ideas específicas y accionables de comunicación para vendedores. Tus respuestas deben ser concisas, prácticas y basadas en el contexto del contacto.";
    
    if (salesGuide && salesGuide.length > 50) {
      systemMessage += `\n\n=== GUÍA DE VENTAS ===\n${salesGuide}\n`;
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1200, // Aumentado para incluir más contexto con la guía
      response_format: { type: "json_object" }
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return response.ideas || [];
  } catch (error) {
    console.error('Error calling OpenAI:', error.message);
    throw new Error('Failed to generate ideas with ChatGPT');
  }
};

/**
 * Construir prompt optimizado para ChatGPT
 * Formato compacto pero completo para generar ideas de alta calidad
 */
const buildOptimizedPrompt = (context, salesGuide = null) => {
  const {
    contactName,
    contactEmail,
    contactPhone,
    lifecycleStage,
    daysSinceLastCommunication,
    company,
    companyNews,
    communications,
    totalCommunications,
    lastCommunicationType,
    lastCommunicationDaysAgo,
    deals,
    dealsCount,
    activeDeals,
    totalDealAmount,
    upcomingEvents
  } = context;

  // Obtener la etapa del negocio (deal stage)
  const currentDealStage = deals && deals.length > 0 ? deals[0].stage : 'Sin negocios';
  
  // Prompt conciso con solo información esencial
  let prompt = `CONTACTO:\n`;
  prompt += `${contactName} (${contactEmail})`;
  if (contactPhone) prompt += ` - ${contactPhone}`;
  prompt += `\nDías sin contacto: ${daysSinceLastCommunication || 'N/A'}\n\n`;

  // Empresa (contexto útil)
  if (company.name) {
    prompt += `EMPRESA: ${company.name}`;
    if (company.industry) prompt += ` (${company.industry})`;
    if (company.size) prompt += ` - ${company.size} empleados`;
    if (company.revenue) prompt += ` - ${company.revenue}`;
    prompt += `\n\n`;
  }

  // Comunicaciones recientes (últimas 5, formato compacto)
  if (communications && communications.length > 0) {
    prompt += `COMUNICACIONES (${totalCommunications} total):\n`;
    communications.slice(0, 5).forEach((comm) => {
      const direction = comm.direction === 'inbound' ? '←' : '→';
      prompt += `${direction} ${comm.type} hace ${comm.daysAgo}d: ${comm.subject?.substring(0, 60) || 'Sin asunto'}\n`;
    });
    if (lastCommunicationType) {
      prompt += `Última: ${lastCommunicationType} hace ${lastCommunicationDaysAgo || 0}d\n`;
    }
    prompt += `\n`;
  }

  // Negocio/Deal (información estratégica)
  if (deals && deals.length > 0) {
    const deal = deals[0];
    prompt += `NEGOCIO:\n`;
    prompt += `Nombre: ${deal.name}\n`;
    prompt += `Etapa: ${deal.stage}\n`;
    if (deal.amount > 0) prompt += `Monto: ${deal.currency} ${deal.amount}\n`;
    if (deal.closeDate) {
      prompt += `Cierre: ${deal.closeDate}\n`;
      // Calcular días hasta cierre para urgencia
      const closeDate = new Date(deal.closeDate);
      const daysUntilClose = Math.ceil((closeDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilClose > 0 && daysUntilClose <= 30) {
        prompt += `Días hasta cierre: ${daysUntilClose} (${daysUntilClose <= 7 ? 'URGENTE' : 'Próximo'})\n`;
      }
    }
    if (deal.daysSinceLastModified !== null && deal.daysSinceLastModified > 7) {
      prompt += `Última modificación: hace ${deal.daysSinceLastModified}d (${deal.daysSinceLastModified > 14 ? 'Estancado' : 'Inactivo'})\n`;
    }
    prompt += `\n`;
  }

  prompt += `Genera 3 ideas de comunicación en formato JSON:\n`;
  prompt += `{"ideas": [{"title": "...", "type": "...", "reason": "...", "action": "...", "priority": "...", "suggestedTiming": "..."}]}`;

  return prompt;
};

/**
 * Validar que OpenAI esté configurado
 */
const isConfigured = () => {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';
};

module.exports = {
  generateSalesIdeas,
  getSalesGuide,
  isConfigured
};

