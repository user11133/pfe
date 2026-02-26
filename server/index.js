const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const camundaService = require('./services/camunda');
const processIntelligenceService = require('./services/processIntelligence');
const mockDataGenerator = require('./services/mockDataGenerator');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Simple file upload without multer for now
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'GRC BPM Platform with Camunda integration is running' });
});

app.get('/api/camunda/test', async (req, res) => {
  const result = await camundaService.testConnection();
  res.json(result);
});

app.get('/api/risks', async (req, res) => {
  try {
    const risks = [
      { id: 1, title: 'Data Breach Risk', level: 'High', status: 'Open', process_id: null },
      { id: 2, title: 'Compliance Risk', level: 'Medium', status: 'In Progress', process_id: null }
    ];
    res.json(risks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch risks' });
  }
});

app.get('/api/processes', async (req, res) => {
  try {
    const processDefinitions = await camundaService.getProcessDefinitions();
    const processInstances = await camundaService.getProcessInstances();
    const tasks = await camundaService.getTasks();

    const processes = processDefinitions.map(process => ({
      id: process.id,
      name: process.name || process.key,
      key: process.key,
      version: process.version,
      status: 'Active',
      instances: processInstances.filter(instance => instance.processDefinitionId === process.id).length,
      activeTasks: tasks.filter(task => task.processDefinitionId === process.id).length
    }));

    res.json(processes);
  } catch (error) {
    console.error('Error fetching processes:', error);
    res.status(500).json({ error: 'Failed to fetch processes from Camunda' });
  }
});

app.get('/api/process-instances', async (req, res) => {
  try {
    const instances = await camundaService.getProcessInstances();
    const tasks = await camundaService.getTasks();

    const instancesWithTasks = instances.map(instance => ({
      id: instance.id,
      processDefinitionId: instance.processDefinitionId,
      businessKey: instance.businessKey,
      startTime: instance.startTime,
      endTime: instance.endTime,
      state: instance.ended ? 'completed' : 'running',
      activeTasks: tasks.filter(task => task.processInstanceId === instance.id).length
    }));

    res.json(instancesWithTasks);
  } catch (error) {
    console.error('Error fetching process instances:', error);
    res.status(500).json({ error: 'Failed to fetch process instances' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await camundaService.getTasks();
    
    const formattedTasks = tasks.map(task => ({
      id: task.id,
      name: task.name,
      processInstanceId: task.processInstanceId,
      processDefinitionId: task.processDefinitionId,
      assignee: task.assignee,
      created: task.created,
      due: task.due,
      priority: task.priority,
      description: task.description
    }));

    res.json(formattedTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.get('/api/processes/:processDefinitionId/xml', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    
    // Fetch BPMN XML from Camunda
    const response = await axios.get(`${process.env.CAMUNDA_REST_API}/process-definition/${processDefinitionId}/xml`);
    
    if (response.data && response.data.bpmn20Xml) {
      res.set('Content-Type', 'application/xml');
      res.send(response.data.bpmn20Xml);
    } else {
      res.status(404).json({ error: 'BPMN XML not found' });
    }
  } catch (error) {
    console.error('Error fetching BPMN XML:', error);
    res.status(500).json({ error: 'Failed to fetch BPMN XML' });
  }
});

app.get('/api/processes/:processDefinitionId/diagram', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    
    console.log('Backend: Requesting diagram for:', processDefinitionId);
    
    // Try multiple approaches to get diagram
    let diagramData = null;
    
    // Method 1: Try standard diagram endpoint
    try {
      console.log('Backend: Trying standard diagram endpoint...');
      diagramData = await camundaService.getProcessDiagram(processDefinitionId);
      console.log('Backend: Standard endpoint result:', diagramData ? diagramData.byteLength : 'null');
    } catch (error) {
      console.log('❌ Backend: Standard diagram endpoint failed, trying alternative...', error.message);
    }
    
    // Method 2: If standard fails, try to get BPMN XML and extract diagram
    if (!diagramData) {
      try {
        console.log('Backend: Trying alternative method...');
        // Get process definition to find deployment
        const processDef = await axios.get(`${process.env.CAMUNDA_REST_API}/process-definition/${processDefinitionId}`);
        console.log('Backend: Process definition:', processDef.data);
        const deploymentId = processDef.data.deploymentId;
        
        // Get all resources for this deployment
        const resources = await axios.get(`${process.env.CAMUNDA_REST_API}/deployment/${deploymentId}/resources`);
        console.log('Backend: Resources:', resources.data);
        
        // Find BPMN resource
        const bpmnResource = resources.data.find(r => r.name.endsWith('.bpmn'));
        console.log('Backend: BPMN resource found:', bpmnResource);
        
        if (bpmnResource) {
          // Get actual BPMN XML data
          const bpmnData = await axios.get(`${process.env.CAMUNDA_REST_API}/deployment/${deploymentId}/resources/${bpmnResource.id}/data`, {
            responseType: 'arraybuffer'
          });
          
          diagramData = bpmnData.data;
          console.log('Backend: BPMN data length:', diagramData ? diagramData.byteLength : 'null');
        }
      } catch (error) {
        console.log('Backend: Alternative method also failed:', error.message);
      }
    }
    
    console.log('Backend: Final diagram data:', diagramData ? diagramData.byteLength : 'null');
    
    if (diagramData && diagramData.byteLength > 0) {
      console.log('Backend: Sending diagram data to frontend');
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.send(diagramData);
    } else {
      console.log('Backend: No diagram data available, sending 204');
      res.status(204).send(); // No content
    }
  } catch (error) {
    console.error('Backend: Error fetching process diagram:', error);
    res.status(500).json({ error: 'Failed to fetch process diagram' });
  }
});

// Handle JSON upload (base64)
app.post('/api/deploy-process-json', async (req, res) => {
  try {
    const { deploymentName, deploymentSource, data, filename } = req.body;
    
    if (!data) {
      return res.status(400).json({ 
        success: false, 
        error: 'No BPMN file provided' 
      });
    }

    // Create form data for Camunda
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('deployment-name', deploymentName || 'Uploaded-Process');
    formData.append('deployment-source', deploymentSource || 'GRC-BPM-Platform-Upload');
    formData.append('data', data, {
      filename: filename || 'process.bpmn',
      contentType: 'application/xml'
    });

    const response = await axios.post(
      `${process.env.CAMUNDA_REST_API}/deployment/create`,
      formData,
      {
        headers: formData.getHeaders()
      }
    );

    res.json({
      success: true,
      deployment: response.data,
      message: 'Process deployed successfully'
    });
  } catch (error) {
    console.error('Error deploying process:', error.message);
    if (error.response) {
      console.error('Camunda response:', error.response.data);
    }
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || error.message || 'Failed to deploy process to Camunda'
    });
  }
});

app.post('/api/processes/:processDefinitionId/start', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    const { variables = {}, businessKey } = req.body;

    const instance = await camundaService.startProcess(processDefinitionId, variables);
    
    res.json({
      success: true,
      instance: {
        id: instance.id,
        processDefinitionId: instance.processDefinitionId,
        businessKey: instance.businessKey
      }
    });
  } catch (error) {
    console.error('Error starting process:', error);
    res.status(500).json({ error: 'Failed to start process' });
  }
});

app.post('/api/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { variables = {} } = req.body;

    await camundaService.completeTask(taskId, variables);
    
    res.json({
      success: true,
      message: 'Task completed successfully'
    });
  } catch (error) {
    console.error('Error completing task:', error.message);
    if (error.response) {
      console.error('Camunda error:', error.response.data);
    }
    res.status(500).json({ 
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to complete task'
    });
  }
});

/**
 * Get BPMN XML for editing
 * GET /api/processes/:processDefinitionId/xml
 */
app.get('/api/processes/:processDefinitionId/xml', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    
    // Get deployment ID for this process
    const processDef = await axios.get(`${process.env.CAMUNDA_REST_API}/process-definition/${processDefinitionId}`);
    const deploymentId = processDef.data.deploymentId;
    const resourceName = processDef.data.resourceName;
    
    if (!deploymentId || !resourceName) {
      return res.status(404).json({ error: 'Deployment info not found' });
    }
    
    // Get BPMN resource from deployment
    const resource = await axios.get(
      `${process.env.CAMUNDA_REST_API}/deployment/${deploymentId}/resources/${encodeURIComponent(resourceName)}/data`,
      { responseType: 'text' }
    );
    
    res.set('Content-Type', 'application/xml');
    res.send(resource.data);
  } catch (error) {
    console.error('Error fetching BPMN XML:', error.message);
    res.status(500).json({ error: 'Failed to fetch BPMN XML' });
  }
});

// ============================================
// PROCESS INTELLIGENCE API ENDPOINTS
// ============================================

/**
 * Get comprehensive process overview with all metrics
 * GET /api/intelligence/overview/:processDefinitionId?
 */
app.get('/api/intelligence/overview/:processDefinitionId?', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    const overview = await processIntelligenceService.getProcessOverview(processDefinitionId);
    res.json(overview);
  } catch (error) {
    console.error('Error fetching process overview:', error);
    res.status(500).json({ error: 'Failed to fetch process overview' });
  }
});

/**
 * Get task duration analytics
 * GET /api/intelligence/task-analytics/:processDefinitionId?
 */
app.get('/api/intelligence/task-analytics/:processDefinitionId?', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    const analytics = await processIntelligenceService.getTaskDurationAnalytics(processDefinitionId);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching task analytics:', error);
    res.status(500).json({ error: 'Failed to fetch task analytics' });
  }
});

/**
 * Get bottleneck heatmap data
 * GET /api/intelligence/heatmap/:processDefinitionId?
 */
app.get('/api/intelligence/heatmap/:processDefinitionId?', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    const heatmap = await processIntelligenceService.getBottleneckHeatmap(processDefinitionId);
    res.json(heatmap);
  } catch (error) {
    console.error('Error fetching heatmap:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

/**
 * Get automatic recommendations
 * GET /api/intelligence/recommendations/:processDefinitionId?
 */
app.get('/api/intelligence/recommendations/:processDefinitionId?', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    const recommendations = await processIntelligenceService.generateRecommendations(processDefinitionId);
    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/**
 * Run Monte Carlo simulation
 * POST /api/intelligence/simulate/:processDefinitionId
 */
app.post('/api/intelligence/simulate/:processDefinitionId', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    const { iterations = 1000, confidenceLevel = 0.95 } = req.body;
    
    const simulation = await processIntelligenceService.simulateProcess(processDefinitionId, {
      iterations,
      confidenceLevel
    });
    
    res.json(simulation);
  } catch (error) {
    console.error('Error running simulation:', error);
    res.status(500).json({ error: 'Failed to run simulation' });
  }
});

/**
 * Get heatmap thresholds configuration
 * GET /api/intelligence/thresholds
 */
app.get('/api/intelligence/thresholds', async (req, res) => {
  try {
    const thresholds = processIntelligenceService.getHeatmapThresholds();
    res.json(thresholds);
  } catch (error) {
    console.error('Error fetching thresholds:', error);
    res.status(500).json({ error: 'Failed to fetch thresholds' });
  }
});

// ============================================
// MOCK DATA GENERATOR ENDPOINTS
// ============================================

/**
 * Generate mock historical data for testing Process Intelligence
 * POST /api/mock-data/generate/:processDefinitionId
 */
app.post('/api/mock-data/generate/:processDefinitionId', async (req, res) => {
  try {
    const { processDefinitionId } = req.params;
    const { count = 10 } = req.body;
    
    const result = await mockDataGenerator.generateMockData(processDefinitionId, count);
    res.json(result);
  } catch (error) {
    console.error('Error generating mock data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Clear mock data
 * DELETE /api/mock-data/clear
 */
app.delete('/api/mock-data/clear', async (req, res) => {
  try {
    const result = await mockDataGenerator.clearMockData();
    res.json(result);
  } catch (error) {
    console.error('Error clearing mock data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`GRC BPM Platform with Camunda integration running on port ${PORT}`);
  console.log(`Camunda API: ${process.env.CAMUNDA_REST_API || 'http://localhost:9090/engine-rest'}`);
  console.log(`Process Intelligence API available at /api/intelligence/*`);
  console.log(`Mock Data Generator available at /api/mock-data/*`);
});
