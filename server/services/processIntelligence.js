const axios = require('axios');

/**
 * Process Intelligence Service
 * Analyzes Camunda history data to provide:
 * - Task duration analytics
 * - Bottleneck detection (heatmaps)
 * - Automatic recommendations
 * - Process simulation (Monte Carlo)
 */
class ProcessIntelligenceService {
  constructor() {
    this.baseURL = process.env.CAMUNDA_REST_API || 'http://localhost:9090/engine-rest';
  }

  /**
   * Fetch historical task instances from Camunda
   */
  async getHistoricalTaskInstances(processDefinitionId = null, limit = 1000) {
    try {
      const params = {
        finished: true,
        maxResults: limit
      };
      
      if (processDefinitionId) {
        params.processDefinitionId = processDefinitionId;
      }

      const response = await axios.post(`${this.baseURL}/history/task`, params);
      return response.data;
    } catch (error) {
      console.error('Error fetching historical tasks:', error.message);
      return [];
    }
  }

  /**
   * Fetch historical activity instances
   */
  async getHistoricalActivityInstances(processDefinitionId = null, limit = 1000) {
    try {
      const params = {
        finished: true,
        maxResults: limit
      };
      
      if (processDefinitionId) {
        params.processDefinitionId = processDefinitionId;
      }

      const response = await axios.post(`${this.baseURL}/history/activity-instance`, params);
      return response.data;
    } catch (error) {
      console.error('Error fetching historical activities:', error.message);
      return [];
    }
  }

  /**
   * Fetch historical process instances
   */
  async getHistoricalProcessInstances(processDefinitionId = null, limit = 1000) {
    try {
      const params = {
        finished: true,
        maxResults: limit
      };
      
      if (processDefinitionId) {
        params.processDefinitionId = processDefinitionId;
      }

      const response = await axios.post(`${this.baseURL}/history/process-instance`, params);
      return response.data;
    } catch (error) {
      console.error('Error fetching historical process instances:', error.message);
      return [];
    }
  }

  /**
   * Fetch runtime task instances (currently active)
   */
  async getRuntimeTaskInstances(processDefinitionId = null, limit = 1000) {
    try {
      const params = {
        maxResults: limit
      };
      
      if (processDefinitionId) {
        params.processDefinitionId = processDefinitionId;
      }

      const response = await axios.post(`${this.baseURL}/task`, params);
      return response.data;
    } catch (error) {
      console.error('Error fetching runtime tasks:', error.message);
      return [];
    }
  }

  /**
   * Fetch runtime process instances (currently active)
   */
  async getRuntimeProcessInstances(processDefinitionId = null, limit = 1000) {
    try {
      const params = {
        maxResults: limit
      };
      
      if (processDefinitionId) {
        params.processDefinitionId = processDefinitionId;
      }

      const response = await axios.post(`${this.baseURL}/process-instance`, params);
      return response.data;
    } catch (error) {
      console.error('Error fetching runtime process instances:', error.message);
      return [];
    }
  }

  /**
   * Calculate task duration analytics
   * Returns: avg, min, max, total time, execution count per task
   * Uses both historical AND runtime data
   */
  async getTaskDurationAnalytics(processDefinitionId = null) {
    try {
      // Fetch both historical and runtime tasks
      const [historicalTasks, runtimeTasks] = await Promise.all([
        this.getHistoricalTaskInstances(processDefinitionId),
        this.getRuntimeTaskInstances(processDefinitionId)
      ]);
      
      // Combine both datasets
      const allTasks = [...historicalTasks, ...runtimeTasks];
      
      if (!allTasks || allTasks.length === 0) {
        return { tasks: [], summary: null, hasRuntimeData: false, hasHistoricalData: false };
      }

      const taskStats = {};
      const now = new Date();

      allTasks.forEach(task => {
        const taskName = task.name || task.taskDefinitionKey || 'Unknown Task';
        const startTime = new Date(task.created || task.startTime);
        
        // For finished tasks, use actual end time
        // For runtime tasks, calculate duration from start to now (ongoing)
        let endTime;
        let isRuntime = false;
        
        if (task.endTime) {
          endTime = new Date(task.endTime);
        } else {
          endTime = now;
          isRuntime = true;
        }
        
        const durationMs = endTime - startTime;
        const durationSec = durationMs / 1000;

        if (!taskStats[taskName]) {
          taskStats[taskName] = {
            name: taskName,
            taskDefinitionKey: task.taskDefinitionKey,
            executions: 0,
            durations: [],
            totalDurationSec: 0,
            minDurationSec: Infinity,
            maxDurationSec: 0,
            runtimeCount: 0
          };
        }

        const stats = taskStats[taskName];
        stats.executions++;
        stats.durations.push(durationSec);
        stats.totalDurationSec += durationSec;
        stats.minDurationSec = Math.min(stats.minDurationSec, durationSec);
        stats.maxDurationSec = Math.max(stats.maxDurationSec, durationSec);
        if (isRuntime) stats.runtimeCount++;
      });

      // Calculate averages and sort by avg duration
      const results = Object.values(taskStats).map(stats => ({
        ...stats,
        avgDurationSec: stats.totalDurationSec / stats.executions,
        avgDurationFormatted: this.formatDuration(stats.totalDurationSec / stats.executions),
        minDurationFormatted: this.formatDuration(stats.minDurationSec),
        maxDurationFormatted: this.formatDuration(stats.maxDurationSec),
        totalDurationFormatted: this.formatDuration(stats.totalDurationSec),
        stdDeviation: this.calculateStdDeviation(stats.durations)
      }));

      results.sort((a, b) => b.avgDurationSec - a.avgDurationSec);

      // Summary statistics
      const summary = {
        totalTasksAnalyzed: allTasks.length,
        uniqueTaskTypes: results.length,
        slowestTask: results[0] || null,
        fastestTask: results[results.length - 1] || null,
        overallAvgDuration: results.reduce((sum, r) => sum + r.avgDurationSec, 0) / results.length,
        hasRuntimeData: runtimeTasks.length > 0,
        hasHistoricalData: historicalTasks.length > 0,
        runtimeTaskCount: runtimeTasks.length,
        historicalTaskCount: historicalTasks.length
      };

      return { tasks: results, summary };
    } catch (error) {
      console.error('Error calculating task duration analytics:', error);
      return { tasks: [], summary: null, error: error.message };
    }
  }

  /**
   * Generate heatmap data for process bottlenecks
   * Returns color-coded data based on duration thresholds
   */
  async getBottleneckHeatmap(processDefinitionId = null) {
    try {
      const analytics = await this.getTaskDurationAnalytics(processDefinitionId);
      
      if (!analytics.tasks || analytics.tasks.length === 0) {
        return { heatmap: [], thresholds: this.getHeatmapThresholds() };
      }

      const thresholds = this.getHeatmapThresholds();
      
      const heatmap = analytics.tasks.map(task => {
        const avgDurationHours = task.avgDurationSec / 3600;
        let color, level, severity;

        if (avgDurationHours < thresholds.low.maxHours) {
          color = '#4CAF50'; // Green - Fast
          level = 'low';
          severity = 'normal';
        } else if (avgDurationHours < thresholds.medium.maxHours) {
          color = '#FF9800'; // Orange - Warning
          level = 'medium';
          severity = 'warning';
        } else {
          color = '#F44336'; // Red - Bottleneck
          level = 'high';
          severity = 'critical';
        }

        return {
          taskDefinitionKey: task.taskDefinitionKey,
          name: task.name,
          avgDurationSec: task.avgDurationSec,
          avgDurationHours,
          executions: task.executions,
          color,
          level,
          severity,
          stdDeviation: task.stdDeviation,
          recommendation: this.generateBottleneckRecommendation(task, level)
        };
      });

      return { heatmap, thresholds, analytics: analytics.summary };
    } catch (error) {
      console.error('Error generating heatmap:', error);
      return { heatmap: [], thresholds: this.getHeatmapThresholds(), error: error.message };
    }
  }

  /**
   * Get heatmap threshold configuration
   */
  getHeatmapThresholds() {
    return {
      low: { maxHours: 1, label: 'Fast (< 1h)', color: '#4CAF50' },
      medium: { maxHours: 6, label: 'Moderate (1-6h)', color: '#FF9800' },
      high: { maxHours: Infinity, label: 'Bottleneck (> 6h)', color: '#F44336' }
    };
  }

  /**
   * Generate automatic recommendations based on process analysis
   */
  async generateRecommendations(processDefinitionId = null) {
    try {
      const analytics = await this.getTaskDurationAnalytics(processDefinitionId);
      const heatmap = await this.getBottleneckHeatmap(processDefinitionId);
      const processes = await this.getHistoricalProcessInstances(processDefinitionId);

      const recommendations = [];

      // Rule 1: Automate long manual tasks
      analytics.tasks.forEach(task => {
        const avgHours = task.avgDurationSec / 3600;
        if (avgHours > 4) {
          recommendations.push({
            type: 'automation',
            priority: 'high',
            task: task.name,
            taskDefinitionKey: task.taskDefinitionKey,
            message: `Automate this task (avg ${task.avgDurationFormatted})`,
            reason: `Manual task takes > 4 hours on average. Consider converting to Service Task or adding automation rules.`,
            impact: 'High time savings potential',
            actionable: true
          });
        }
      });

      // Rule 2: High variation suggests inconsistent process
      analytics.tasks.forEach(task => {
        if (task.stdDeviation > task.avgDurationSec * 0.5) {
          recommendations.push({
            type: 'standardization',
            priority: 'medium',
            task: task.name,
            taskDefinitionKey: task.taskDefinitionKey,
            message: `Standardize task execution`,
            reason: `High variation in completion time (${task.avgDurationFormatted} ± ${this.formatDuration(task.stdDeviation)}). Consider creating SOPs or checklists.`,
            impact: 'Improved predictability',
            actionable: true
          });
        }
      });

      // Rule 3: Few executions = low sample size warning
      analytics.tasks.forEach(task => {
        if (task.executions < 5) {
          recommendations.push({
            type: 'data_quality',
            priority: 'low',
            task: task.name,
            taskDefinitionKey: task.taskDefinitionKey,
            message: `Limited data for analysis`,
            reason: `Only ${task.executions} executions recorded. Recommendations may be less reliable.`,
            impact: 'Low confidence metrics',
            actionable: false
          });
        }
      });

      // Rule 4: Process-level insights
      if (processes.length > 0) {
        const avgProcessDuration = processes.reduce((sum, p) => {
          if (p.endTime && p.startTime) {
            return sum + (new Date(p.endTime) - new Date(p.startTime));
          }
          return sum;
        }, 0) / processes.length;

        const avgProcessHours = avgProcessDuration / (1000 * 60 * 60);
        
        if (avgProcessHours > 24) {
          recommendations.push({
            type: 'process_optimization',
            priority: 'high',
            task: null,
            message: `Process cycle time exceeds 24 hours`,
            reason: `Average process completion time is ${this.formatDuration(avgProcessDuration / 1000)}. Consider parallel task execution or removing unnecessary steps.`,
            impact: 'Significant process acceleration',
            actionable: true
          });
        }
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return {
        recommendations,
        totalRecommendations: recommendations.length,
        highPriorityCount: recommendations.filter(r => r.priority === 'high').length,
        actionableCount: recommendations.filter(r => r.actionable).length
      };
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return { recommendations: [], error: error.message };
    }
  }

  /**
   * Monte Carlo simulation for process duration prediction
   * Uses ONLY completed historical tasks (not runtime data) for realistic predictions
   */
  async simulateProcess(processDefinitionId, options = {}) {
    try {
      const {
        iterations = 1000,
        confidenceLevel = 0.95
      } = options;

      // Only use historical completed tasks for simulation
      const historicalTasks = await this.getHistoricalTaskInstances(processDefinitionId);
      
      if (!historicalTasks || historicalTasks.length === 0) {
        return { 
          error: 'No completed process instances available for simulation. Start and complete some process instances first.',
          dataQuality: 'insufficient'
        };
      }

      // Build statistics from historical data only
      const taskStats = {};
      historicalTasks.forEach(task => {
        if (!task.endTime || !task.startTime) return;

        const taskName = task.name || task.taskDefinitionKey || 'Unknown Task';
        const startTime = new Date(task.startTime);
        const endTime = new Date(task.endTime);
        const durationSec = (endTime - startTime) / 1000;

        if (!taskStats[taskName]) {
          taskStats[taskName] = {
            name: taskName,
            taskDefinitionKey: task.taskDefinitionKey,
            executions: 0,
            durations: [],
            totalDurationSec: 0
          };
        }

        const stats = taskStats[taskName];
        stats.executions++;
        stats.durations.push(durationSec);
        stats.totalDurationSec += durationSec;
      });

      // Calculate stats for each task
      const taskList = Object.values(taskStats).map(stats => ({
        ...stats,
        avgDurationSec: stats.totalDurationSec / stats.executions,
        stdDeviation: this.calculateStdDeviation(stats.durations)
      }));

      // Check data quality
      const totalExecutions = taskList.reduce((sum, t) => sum + t.executions, 0);
      const avgExecutionsPerTask = totalExecutions / taskList.length;
      const tasksWithLowData = taskList.filter(t => t.executions < 5).length;

      if (taskList.length === 0) {
        return { 
          error: 'No valid task data found for simulation.',
          dataQuality: 'insufficient'
        };
      }

      const simulations = [];

      // Run Monte Carlo simulation using Log-Normal distribution (more realistic for durations)
      for (let i = 0; i < iterations; i++) {
        let totalDuration = 0;
        const taskPredictions = [];

        taskList.forEach(task => {
          const mean = task.avgDurationSec;
          
          // Use measured std dev if available and meaningful, otherwise use coefficient of variation
          let stdDev;
          if (task.stdDeviation > 0 && task.executions >= 3) {
            stdDev = task.stdDeviation;
          } else {
            // Use coefficient of variation based on typical process variance (30-50%)
            // This is more realistic than fixed 20%
            const cv = 0.3 + (Math.random() * 0.2); // 30-50% coefficient of variation
            stdDev = mean * cv;
          }
          
          // Use Log-Normal distribution for more realistic duration modeling
          // (durations can't be negative and have long-tail behavior)
          const sigma = Math.sqrt(Math.log(1 + (stdDev * stdDev) / (mean * mean)));
          const mu = Math.log(mean) - (sigma * sigma) / 2;
          
          // Generate log-normal random value
          const u1 = Math.random();
          const u2 = Math.random();
          const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          const logNormal = Math.exp(mu + sigma * z0);
          
          // Add some minimum realistic duration (can't be instant)
          const randomDuration = Math.max(mean * 0.1, logNormal);

          totalDuration += randomDuration;
          taskPredictions.push({
            task: task.name,
            predictedDuration: randomDuration
          });
        });

        simulations.push({
          totalDuration,
          taskPredictions
        });
      }

      // Calculate statistics
      const durations = simulations.map(s => s.totalDuration).sort((a, b) => a - b);
      
      const results = {
        iterations,
        dataQuality: {
          totalTaskExecutions: totalExecutions,
          uniqueTaskTypes: taskList.length,
          avgExecutionsPerTask: Math.round(avgExecutionsPerTask * 10) / 10,
          tasksWithLowSampleSize: tasksWithLowData,
          warning: tasksWithLowData > 0 ? 'Some tasks have limited sample size (< 5 executions). Results may be less accurate.' : null
        },
        averageDuration: durations.reduce((a, b) => a + b, 0) / iterations,
        minDuration: durations[0],
        maxDuration: durations[durations.length - 1],
        medianDuration: durations[Math.floor(iterations / 2)],
        percentiles: {
          p10: durations[Math.floor(iterations * 0.1)],
          p25: durations[Math.floor(iterations * 0.25)],
          p50: durations[Math.floor(iterations * 0.5)],
          p75: durations[Math.floor(iterations * 0.75)],
          p90: durations[Math.floor(iterations * 0.9)],
          p95: durations[Math.floor(iterations * 0.95)]
        },
        confidenceInterval: {
          lower: durations[Math.floor(iterations * (1 - confidenceLevel) / 2)],
          upper: durations[Math.floor(iterations * (1 + confidenceLevel) / 2)]
        },
        formatted: {
          average: this.formatDuration(durations.reduce((a, b) => a + b, 0) / iterations),
          bestCase: this.formatDuration(durations[0]),
          worstCase: this.formatDuration(durations[durations.length - 1]),
          median: this.formatDuration(durations[Math.floor(iterations / 2)]),
          p10: this.formatDuration(durations[Math.floor(iterations * 0.1)]),
          p25: this.formatDuration(durations[Math.floor(iterations * 0.25)]),
          p75: this.formatDuration(durations[Math.floor(iterations * 0.75)]),
          p90: this.formatDuration(durations[Math.floor(iterations * 0.9)]),
          p95: this.formatDuration(durations[Math.floor(iterations * 0.95)]),
          confidenceInterval: `${this.formatDuration(durations[Math.floor(iterations * (1 - confidenceLevel) / 2)])} - ${this.formatDuration(durations[Math.floor(iterations * (1 + confidenceLevel) / 2)])}`
        }
      };

      return results;
    } catch (error) {
      console.error('Error running simulation:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate bottleneck recommendation for a specific task
   */
  generateBottleneckRecommendation(task, level) {
    const recommendations = {
      high: [
        'Consider automation or task parallelization',
        'Review task requirements and simplify if possible',
        'Add SLA alerts for this task',
        'Investigate root causes of delays'
      ],
      medium: [
        'Monitor for trends',
        'Ensure adequate resource allocation',
        'Consider task delegation options'
      ],
      low: [
        'Performing well - maintain current process',
        'Use as benchmark for other tasks'
      ]
    };

    const list = recommendations[level] || recommendations.medium;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * Helper: Format duration in human readable format
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else if (seconds < 86400) {
      return `${Math.round(seconds / 3600 * 10) / 10}h`;
    } else {
      return `${Math.round(seconds / 86400 * 10) / 10}d`;
    }
  }

  /**
   * Helper: Calculate standard deviation
   */
  calculateStdDeviation(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Generate demo analytics data for testing when no real data exists
   * Creates realistic fake task duration data
   */
  generateDemoAnalytics(processDefinitionId) {
    const demoTasks = [
      { 
        name: 'Collect Documents', 
        avgDurationSec: 1800, // 30 min
        executions: 15,
        variance: 0.3 
      },
      { 
        name: 'Background Check', 
        avgDurationSec: 259200, // 3 days
        executions: 12,
        variance: 0.5 
      },
      { 
        name: 'Setup IT Account and Equipment', 
        avgDurationSec: 10800, // 3 hours
        executions: 14,
        variance: 0.4 
      },
      { 
        name: 'Prepare Workspace', 
        avgDurationSec: 7200, // 2 hours
        executions: 14,
        variance: 0.3 
      },
      { 
        name: 'Manager: Prepare Onboarding Plan', 
        avgDurationSec: 86400, // 1 day
        executions: 13,
        variance: 0.6 
      },
      { 
        name: 'HR Orientation', 
        avgDurationSec: 14400, // 4 hours
        executions: 15,
        variance: 0.2 
      },
      { 
        name: 'System Training', 
        avgDurationSec: 172800, // 2 days
        executions: 11,
        variance: 0.7 
      },
      { 
        name: 'Final Review and Sign-off', 
        avgDurationSec: 1800, // 30 min
        executions: 15,
        variance: 0.2 
      }
    ];

    const taskResults = demoTasks.map(task => {
      const variance = task.avgDurationSec * task.variance;
      const minDuration = Math.max(60, task.avgDurationSec - variance);
      const maxDuration = task.avgDurationSec + variance;
      const stdDeviation = variance * 0.5;

      return {
        name: task.name,
        taskDefinitionKey: task.name.toLowerCase().replace(/\s+/g, '_'),
        executions: task.executions,
        avgDurationSec: task.avgDurationSec,
        avgDurationFormatted: this.formatDuration(task.avgDurationSec),
        minDurationSec: minDuration,
        minDurationFormatted: this.formatDuration(minDuration),
        maxDurationSec: maxDuration,
        maxDurationFormatted: this.formatDuration(maxDuration),
        totalDurationSec: task.avgDurationSec * task.executions,
        totalDurationFormatted: this.formatDuration(task.avgDurationSec * task.executions),
        stdDeviation: stdDeviation,
        demo: true
      };
    });

    // Sort by average duration (slowest first)
    taskResults.sort((a, b) => b.avgDurationSec - a.avgDurationSec);

    const summary = {
      totalTasksAnalyzed: demoTasks.reduce((sum, t) => sum + t.executions, 0),
      uniqueTaskTypes: demoTasks.length,
      slowestTask: taskResults[0],
      fastestTask: taskResults[taskResults.length - 1],
      overallAvgDuration: taskResults.reduce((sum, t) => sum + t.avgDurationSec, 0) / taskResults.length,
      demo: true
    };

    return { tasks: taskResults, summary };
  }

  /**
   * Get process overview with all metrics
   */
  async getProcessOverview(processDefinitionId = null) {
    try {
      const [analytics, heatmap, recommendations, processes] = await Promise.all([
        this.getTaskDurationAnalytics(processDefinitionId),
        this.getBottleneckHeatmap(processDefinitionId),
        this.generateRecommendations(processDefinitionId),
        this.getHistoricalProcessInstances(processDefinitionId, 100)
      ]);

      // If no real data exists, generate demo data
      const hasRealData = analytics.tasks && analytics.tasks.length > 0 && !analytics.summary?.demo;
      
      if (!hasRealData && processDefinitionId) {
        console.log('[ProcessIntelligence] No real data found, generating demo data');
        const demoAnalytics = this.generateDemoAnalytics(processDefinitionId);
        
        return {
          timestamp: new Date().toISOString(),
          processDefinitionId,
          summary: {
            totalCompletedProcesses: 15,
            totalTasksAnalyzed: demoAnalytics.summary.totalTasksAnalyzed,
            uniqueTaskTypes: demoAnalytics.summary.uniqueTaskTypes,
            overallAvgTaskDuration: demoAnalytics.summary.overallAvgDuration,
            demo: true
          },
          taskAnalytics: demoAnalytics,
          heatmap: this.generateDemoHeatmap(demoAnalytics.tasks),
          recommendations: this.generateDemoRecommendations(demoAnalytics.tasks),
          processes: []
        };
      }

      return {
        timestamp: new Date().toISOString(),
        processDefinitionId,
        summary: {
          totalCompletedProcesses: processes.length,
          totalTasksAnalyzed: analytics.summary?.totalTasksAnalyzed || 0,
          uniqueTaskTypes: analytics.summary?.uniqueTaskTypes || 0,
          overallAvgTaskDuration: analytics.summary?.overallAvgDuration || 0
        },
        taskAnalytics: analytics,
        heatmap: heatmap.heatmap,
        recommendations: recommendations,
        processes: processes.slice(0, 10)
      };
    } catch (error) {
      console.error('Error getting process overview:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate demo heatmap data
   */
  generateDemoHeatmap(tasks) {
    const thresholds = this.getHeatmapThresholds();
    
    return tasks.map(task => {
      const avgDurationHours = task.avgDurationSec / 3600;
      let color, level, severity;

      if (avgDurationHours < thresholds.low.maxHours) {
        color = '#4CAF50';
        level = 'low';
        severity = 'normal';
      } else if (avgDurationHours < thresholds.medium.maxHours) {
        color = '#FF9800';
        level = 'medium';
        severity = 'warning';
      } else {
        color = '#F44336';
        level = 'high';
        severity = 'critical';
      }

      return {
        taskDefinitionKey: task.taskDefinitionKey,
        name: task.name,
        avgDurationSec: task.avgDurationSec,
        avgDurationHours,
        executions: task.executions,
        color,
        level,
        severity,
        stdDeviation: task.stdDeviation,
        recommendation: this.generateBottleneckRecommendation(task, level),
        demo: true
      };
    });
  }

  /**
   * Generate demo recommendations
   */
  generateDemoRecommendations(tasks) {
    const recommendations = [];

    tasks.forEach(task => {
      const avgHours = task.avgDurationSec / 3600;
      
      if (avgHours > 24) {
        recommendations.push({
          type: 'automation',
          priority: 'high',
          task: task.name,
          taskDefinitionKey: task.taskDefinitionKey,
          message: `Automate this task (avg ${task.avgDurationFormatted})`,
          reason: `Manual task takes > 24 hours on average. Consider converting to Service Task or adding automation rules.`,
          impact: 'High time savings potential',
          actionable: true,
          demo: true
        });
      } else if (task.stdDeviation > task.avgDurationSec * 0.4) {
        recommendations.push({
          type: 'standardization',
          priority: 'medium',
          task: task.name,
          taskDefinitionKey: task.taskDefinitionKey,
          message: `Standardize task execution`,
          reason: `High variation in completion time (${task.avgDurationFormatted} ± ${this.formatDuration(task.stdDeviation)}). Consider creating SOPs or checklists.`,
          impact: 'Improved predictability',
          actionable: true,
          demo: true
        });
      }
    });

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      recommendations,
      totalRecommendations: recommendations.length,
      highPriorityCount: recommendations.filter(r => r.priority === 'high').length,
      actionableCount: recommendations.filter(r => r.actionable).length,
      demo: true
    };
  }
}

module.exports = new ProcessIntelligenceService();
