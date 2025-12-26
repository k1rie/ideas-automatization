const cron = require('node-cron');
const axios = require('axios');

/**
 * Iniciar el scheduler automático
 */
const startScheduler = () => {
  const cronSchedule = process.env.CRON_SCHEDULE || '0 4 * * 1-5';
  
  console.log(`⏰ Scheduler started with pattern: ${cronSchedule}`);
  console.log(`   (Default: 4 AM Monday-Friday)`);
  
  // Validar expresión cron
  if (!cron.validate(cronSchedule)) {
    console.error('❌ Invalid CRON_SCHEDULE format');
    return;
  }
  
  // Programar tarea
  cron.schedule(cronSchedule, async () => {
    console.log('\n🔔 Scheduled task triggered at:', new Date().toISOString());
    await runAnalysisJob();
  });
  
  console.log('✅ Scheduler configured successfully\n');
};

/**
 * Ejecutar el job de análisis
 */
const runAnalysisJob = async () => {
  try {
    console.log('🚀 Starting automated contact analysis...');
    
    // Llamar al endpoint de análisis
    const response = await axios.post('http://localhost:3001/api/contacts/analyze-all');
    
    console.log('✅ Analysis job completed successfully');
    console.log(`   Processed: ${response.data.totalProcessed}`);
    console.log(`   Successful: ${response.data.successful}`);
    console.log(`   Failed: ${response.data.failed}`);
  } catch (error) {
    console.error('❌ Error running analysis job:', error.message);
  }
};

/**
 * Ejecutar análisis manualmente (para testing)
 */
const runManualAnalysis = async () => {
  console.log('🔧 Running manual analysis...');
  await runAnalysisJob();
};

module.exports = {
  startScheduler,
  runManualAnalysis
};


