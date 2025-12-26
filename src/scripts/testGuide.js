#!/usr/bin/env node

/**
 * Script para probar la obtención de la guía de Google Docs
 * Uso: npm run test-guide
 */

const axios = require('axios');

const GUIDE_DOC_ID = '1_srPqIupwNV8hNxFShXAbe8RUD3K4565vemu--Ba1Cs';
const GUIDE_URL = `https://docs.google.com/document/d/${GUIDE_DOC_ID}/edit`;

const getSalesGuide = async () => {
  console.log(`   🔗 Documento: ${GUIDE_URL}`);
  console.log(`   📥 Intentando obtener contenido...\n`);
  
  // Intentar diferentes formatos de exportación
  const formats = ['txt', 'html', 'plain'];
  
  for (const format of formats) {
    try {
      const exportUrl = `https://docs.google.com/document/d/${GUIDE_DOC_ID}/export?format=${format}`;
      console.log(`   Probando formato: ${format}...`);
      
      const response = await axios.get(exportUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const guideContent = response.data || '';
      
      // Limpiar el contenido
      const cleanedGuide = guideContent
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.match(/^\s*$/))
        .join('\n')
        .substring(0, 4000); // Limitar a 4000 caracteres para ahorrar tokens
      
      if (cleanedGuide.length > 50) {
        console.log(`   ✅ Guía obtenida con formato ${format} (${cleanedGuide.length} caracteres)\n`);
        return cleanedGuide;
      }
    } catch (error) {
      console.log(`   ⚠️  Formato ${format} falló: ${error.message}`);
      continue;
    }
  }
  
  // Si todos los formatos fallan, intentar obtener el HTML directamente
  try {
    console.log(`   Intentando método alternativo (HTML directo)...`);
    const response = await axios.get(GUIDE_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Extraer texto básico del HTML
    let text = response.data || '';
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim().substring(0, 3000);
    
    if (text.length > 100) {
      console.log(`   ✅ Guía obtenida (método alternativo, ${text.length} caracteres)\n`);
      return text;
    }
  } catch (error) {
    console.log(`   ⚠️  Método alternativo también falló\n`);
  }
  
  console.warn('   ⚠️  No se pudo obtener la guía de Google Docs');
  console.warn('   💡 Asegúrate de que el documento sea público o compartido\n');
  return null;
};

const testGuide = async () => {
  console.log('\n📖 Probando obtención de guía de ventas desde Google Docs...\n');
  
  try {
    const guide = await getSalesGuide();
    
    if (guide && guide.length > 0) {
      console.log('✅ Guía obtenida exitosamente\n');
      console.log(`📊 Longitud: ${guide.length} caracteres\n`);
      console.log('📄 Primeros 800 caracteres:\n');
      console.log('='.repeat(60));
      console.log(guide.substring(0, 800));
      console.log('='.repeat(60));
      console.log('\n✅ La guía se está obteniendo correctamente y se incluirá en cada prompt a ChatGPT\n');
      
      // Buscar menciones de etapas
      console.log('🔍 Buscando información sobre etapas en la guía...\n');
      const lowerGuide = guide.toLowerCase();
      const stageKeywords = ['etapa', 'stage', 'fase', 'pipeline', 'proceso'];
      
      stageKeywords.forEach(keyword => {
        if (lowerGuide.includes(keyword)) {
          console.log(`   ✓ Encontrado: "${keyword}"`);
        }
      });
      
      console.log('\n💡 Esta información se pasará a ChatGPT para que use las etapas correctas\n');
    } else {
      console.log('⚠️  No se pudo obtener la guía');
      console.log('   Verifica que el documento sea público o compartido\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  testGuide();
}

module.exports = { testGuide };
