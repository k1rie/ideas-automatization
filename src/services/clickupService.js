const axios = require('axios');

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
const API_TOKEN = process.env.CLICKUP_API_KEY;
const LIST_ID = process.env.CLICKUP_LIST_ID || '901708866988';

/**
 * Cliente HTTP configurado para ClickUp
 */
const clickupClient = axios.create({
  baseURL: CLICKUP_API_BASE,
  headers: {
    'Authorization': API_TOKEN,
    'Content-Type': 'application/json'
  }
});

/**
 * Validar que ClickUp esté configurado
 */
const isConfigured = () => {
  return !!API_TOKEN && API_TOKEN !== 'your_clickup_api_key_here';
};

/**
 * Crear una tarea en ClickUp
 * @param {Object} idea - Objeto con la idea de venta
 * @param {Object} contactInfo - Información del contacto (nombre, email, empresa)
 * @returns {Promise<Object>} - Respuesta de ClickUp con la tarea creada
 */
const createTask = async (idea, contactInfo) => {
  if (!isConfigured()) {
    throw new Error('ClickUp API key not configured');
  }

  try {
    const { contactName, contactEmail, company } = contactInfo;
    const { title, type, reason, action, priority, suggestedTiming } = idea;

    // Mapear prioridad a formato de ClickUp (1=urgent, 2=high, 3=normal, 4=low)
    let priorityValue = 3; // normal por defecto
    if (priority === 'Alta' || priority === 'Alto') {
      priorityValue = 2; // high
    } else if (priority === 'Urgente') {
      priorityValue = 1; // urgent
    } else if (priority === 'Baja' || priority === 'Bajo') {
      priorityValue = 4; // low
    }

    // Construir descripción de la tarea
    const description = `**Contacto:** ${contactName}${contactEmail ? ` (${contactEmail})` : ''}\n` +
      `${company ? `**Empresa:** ${company}\n` : ''}` +
      `**Tipo de comunicación:** ${type || 'N/A'}\n\n` +
      `**Razón:** ${reason || 'N/A'}\n\n` +
      `**Acción sugerida:**\n${action || 'N/A'}\n\n` +
      `${suggestedTiming ? `**Momento sugerido:** ${suggestedTiming}\n` : ''}`;

    // Datos de la tarea (formato según ClickUp API v2)
    const taskData = {
      name: `${title || 'Idea de venta'} - ${contactName}`,
      description: description,
      status: 'to do', // Estado inicial (debe existir en la lista)
      priority: priorityValue,
      tags: ['venta', 'hubspot', type?.toLowerCase() || 'comunicación'].filter(Boolean),
      assignees: [], // Sin asignar por defecto
      check_required: false
    };

    // Crear la tarea en la lista especificada
    const response = await clickupClient.post(`/list/${LIST_ID}/task`, taskData);

    const task = response.data;
    const taskId = task.id || task.task?.id;
    const taskUrl = task.url || task.task?.url || `https://app.clickup.com/t/${taskId}`;
    const taskName = task.name || task.task?.name || taskData.name;
    const taskStatus = task.status?.status || task.status || 'to do';

    console.log(`   ✅ Tarea ClickUp creada: ${taskId}`);
    console.log(`   🔗 Ver: ${taskUrl}`);

    return {
      id: taskId,
      name: taskName,
      url: taskUrl,
      status: taskStatus
    };
  } catch (error) {
    const errorData = error.response?.data || {};
    const errorMessage = errorData.err || errorData.message || error.message;
    console.error('Error creating ClickUp task:', errorMessage);
    if (error.response?.status === 401) {
      throw new Error('ClickUp API key inválida. Verifica tu CLICKUP_API_KEY');
    } else if (error.response?.status === 404) {
      throw new Error(`Lista de ClickUp no encontrada (ID: ${LIST_ID}). Verifica CLICKUP_LIST_ID`);
    }
    throw new Error(`Failed to create task in ClickUp: ${errorMessage}`);
  }
};

/**
 * Crear múltiples tareas (una por cada idea)
 * @param {Array} ideas - Array de ideas de venta
 * @param {Object} contactInfo - Información del contacto
 * @returns {Promise<Array>} - Array de tareas creadas
 */
const createTasksForIdeas = async (ideas, contactInfo) => {
  if (!isConfigured()) {
    console.warn('⚠️  ClickUp no configurado, saltando creación de tareas');
    return [];
  }

  if (!ideas || ideas.length === 0) {
    console.warn('⚠️  No hay ideas para crear tareas en ClickUp');
    return [];
  }

  const tasks = [];
  
  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    try {
      console.log(`   📝 Creando tarea ${i + 1}/${ideas.length} en ClickUp...`);
      const task = await createTask(idea, contactInfo);
      tasks.push(task);
      
      // Pequeña pausa entre tareas para evitar rate limits
      if (i < ideas.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`   ❌ Error creando tarea ${i + 1} en ClickUp:`, error.message);
      // Continuar con las siguientes tareas aunque una falle
    }
  }

  return tasks;
};

module.exports = {
  createTask,
  createTasksForIdeas,
  isConfigured
};

