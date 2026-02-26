const axios = require('axios');

class CamundaService {
  constructor() {
    this.baseURL = process.env.CAMUNDA_REST_API || 'http://localhost:9090/engine-rest';
  }

  async getProcessDefinitions() {
    try {
      const response = await axios.get(`${this.baseURL}/process-definition`);
      return response.data;
    } catch (error) {
      console.error('Error fetching process definitions:', error.message);
      return [];
    }
  }

  async getProcessInstances() {
    try {
      const response = await axios.get(`${this.baseURL}/process-instance`);
      return response.data;
    } catch (error) {
      console.error('Error fetching process instances:', error.message);
      return [];
    }
  }

  async getTasks() {
    try {
      const response = await axios.get(`${this.baseURL}/task`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tasks:', error.message);
      return [];
    }
  }

  async startProcess(processDefinitionId, variables = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/process-definition/${processDefinitionId}/start`, {
        variables
      });
      return response.data;
    } catch (error) {
      console.error('Error starting process:', error.message);
      throw error;
    }
  }

  async completeTask(taskId, variables = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/task/${taskId}/complete`, {
        variables
      });
      return response.data;
    } catch (error) {
      console.error('Error completing task:', error.message);
      throw error;
    }
  }

  async getProcessDiagram(processDefinitionId) {
    try {
      const response = await axios.get(`${this.baseURL}/process-definition/${processDefinitionId}/diagram`, {
        responseType: 'arraybuffer'
      });
      
      // Check if response has data
      if (response.data && response.data.byteLength > 0) {
        return response.data;
      } else {
        // Return null if no diagram data
        return null;
      }
    } catch (error) {
      console.error('Error fetching process diagram:', error.message);
      return null;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/process-definition`);
      return { success: true, count: response.data.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CamundaService();
