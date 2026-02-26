const axios = require('axios');

/**
 * Mock Data Generator for Process Intelligence Testing
 * Seeds fake historical process instances and task completions
 */
class MockDataGenerator {
  constructor() {
    this.baseURL = process.env.CAMUNDA_REST_API || 'http://localhost:9090/engine-rest';
  }

  /**
   * Delay helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate fake historical data for a process
   * @param {string} processDefinitionId - Process definition ID
   * @param {number} instanceCount - Number of instances to generate (default: 10)
   */
  async generateMockData(processDefinitionId, instanceCount = 10) {
    try {
      const results = {
        instancesCreated: 0,
        tasksCompleted: 0,
        errors: []
      };

      // Get process definition details
      const processDef = await axios.get(`${this.baseURL}/process-definition/${processDefinitionId}`);
      const processKey = processDef.data.key;

      console.log(`[MockData] Starting generation of ${instanceCount} instances for ${processKey}`);

      // Generate instances with realistic timing patterns
      for (let i = 0; i < instanceCount; i++) {
        try {
          console.log(`[MockData] Creating instance ${i + 1}/${instanceCount}`);
          
          // Start process instance
          const instance = await this.startProcessInstance(processDefinitionId, processKey);
          results.instancesCreated++;

          // Wait a bit for tasks to be created
          await this.sleep(500);

          // Complete all tasks for this instance
          const tasksCompleted = await this.completeAllTasks(instance.id);
          results.tasksCompleted += tasksCompleted;

          // Wait between instances
          await this.sleep(200);

        } catch (error) {
          console.error(`[MockData] Instance ${i} error:`, error.message);
          results.errors.push(`Instance ${i}: ${error.message}`);
        }
      }

      console.log(`[MockData] Finished: ${results.instancesCreated} instances, ${results.tasksCompleted} tasks`);

      return {
        success: true,
        message: `Generated ${results.instancesCreated} instances with ${results.tasksCompleted} completed tasks`,
        details: results
      };
    } catch (error) {
      console.error('[MockData] Error generating mock data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start a process instance
   */
  async startProcessInstance(processDefinitionId, processKey) {
    const response = await axios.post(`${this.baseURL}/process-definition/${processDefinitionId}/start`, {
      businessKey: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      variables: {
        backgroundCheckPassed: { value: true, type: 'Boolean' },
        source: { value: 'mock-data-generator', type: 'String' }
      }
    });
    
    return response.data;
  }

  /**
   * Complete all tasks for a process instance with retry logic
   */
  async completeAllTasks(processInstanceId) {
    let completedCount = 0;
    let retries = 0;
    const maxRetries = 50;

    while (retries < maxRetries) {
      try {
        // Fetch current tasks for this instance
        const tasksResponse = await axios.get(`${this.baseURL}/task`, {
          params: { processInstanceId }
        });
        
        const tasks = tasksResponse.data;
        
        if (tasks.length === 0) {
          // No more tasks - check if process is still running
          try {
            const instanceResponse = await axios.get(`${this.baseURL}/process-instance/${processInstanceId}`);
            if (!instanceResponse.data || instanceResponse.data.ended) {
              break;
            }
          } catch (e) {
            break;
          }
          
          await this.sleep(300);
          retries++;
          continue;
        }

        // Complete all current tasks
        for (const task of tasks) {
          try {
            await axios.post(`${this.baseURL}/task/${task.id}/complete`, { variables: {} });
            completedCount++;
            console.log(`[MockData] Completed task: ${task.name}`);
          } catch (error) {
            console.log(`[MockData] Could not complete task ${task.name}: ${error.message}`);
          }
        }

        await this.sleep(200);
        retries++;

      } catch (error) {
        console.error('[MockData] Error fetching tasks:', error.message);
        retries++;
        await this.sleep(300);
      }
    }

    return completedCount;
  }

  /**
   * Get a random start time within the last 30 days
   */
  getRandomStartTime() {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const randomOffset = Math.random() * (now - thirtyDaysAgo);
    return new Date(thirtyDaysAgo + randomOffset);
  }

  /**
   * Clear mock data (delete process instances created by generator)
   */
  async clearMockData() {
    try {
      // Get all process instances
      const instancesResponse = await axios.get(`${this.baseURL}/process-instance`);
      const instances = instancesResponse.data;

      let deletedCount = 0;
      for (const instance of instances) {
        // Check if it's a mock instance by business key pattern
        if (instance.businessKey && instance.businessKey.startsWith('mock-')) {
          try {
            await axios.delete(`${this.baseURL}/process-instance/${instance.id}`);
            deletedCount++;
          } catch (e) {
            // Instance might already be completed
          }
        }
      }

      return {
        success: true,
        message: `Cleared ${deletedCount} mock instances`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MockDataGenerator();
