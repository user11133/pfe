import React, { useState, useEffect } from 'react';

/**
 * Process Intelligence Dashboard
 * 
 * Features:
 * - Task duration analytics (avg, min, max, std deviation)
 * - Bottleneck heatmap visualization
 * - Automatic AI recommendations
 * - Monte Carlo simulation for process prediction
 */
const ProcessIntelligence = ({ processDefinitionId, processName }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data states
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [simulationLoading, setSimulationLoading] = useState(false);

  // Simulation options
  const [simOptions, setSimOptions] = useState({
    iterations: 1000,
    confidenceLevel: 0.95
  });

  const [generatingData, setGeneratingData] = useState(false);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = processDefinitionId 
        ? `/api/intelligence/overview/${processDefinitionId}`
        : '/api/intelligence/overview';

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setOverview(data);
        setAnalytics(data.taskAnalytics);
        setHeatmap(data.heatmap);
        setRecommendations(data.recommendations);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all data on mount
  useEffect(() => {
    fetchOverview();
  }, [processDefinitionId]);

  const runSimulation = async () => {
    if (!processDefinitionId) {
      alert('Please select a process first');
      return;
    }

    try {
      setSimulationLoading(true);
      
      const response = await fetch(`/api/intelligence/simulate/${processDefinitionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simOptions)
      });

      const data = await response.json();
      
      if (data.error) {
        alert('Simulation error: ' + data.error);
      } else {
        setSimulation(data);
        setActiveTab('simulation');
      }
    } catch (err) {
      alert('Failed to run simulation: ' + err.message);
    } finally {
      setSimulationLoading(false);
    }
  };

  // Simple bar chart component
  const BarChart = ({ data, maxValue, color, label }) => {
    const percentage = maxValue ? (data / maxValue) * 100 : 0;
    
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', width: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <span style={{ fontSize: '12px', marginLeft: '10px', color: '#666' }}>
            {typeof data === 'number' ? data.toFixed(1) : data}
          </span>
        </div>
        <div style={{ 
          width: '100%', 
          height: '20px', 
          background: '#f0f0f0', 
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(percentage, 100)}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>
    );
  };

  // Heatmap legend
  const HeatmapLegend = () => (
    <div style={{ 
      display: 'flex', 
      gap: '20px', 
      marginBottom: '20px',
      padding: '15px',
      background: '#f8f9fa',
      borderRadius: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '20px', height: '20px', background: '#4CAF50', borderRadius: '4px' }} />
        <span style={{ fontSize: '13px' }}>Fast (&lt; 1h)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '20px', height: '20px', background: '#FF9800', borderRadius: '4px' }} />
        <span style={{ fontSize: '13px' }}>Moderate (1-6h)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '20px', height: '20px', background: '#F44336', borderRadius: '4px' }} />
        <span style={{ fontSize: '13px' }}>Bottleneck (&gt; 6h)</span>
      </div>
    </div>
  );

  // Priority badge
  const PriorityBadge = ({ priority }) => {
    const colors = {
      high: '#F44336',
      medium: '#FF9800',
      low: '#4CAF50'
    };

    return (
      <span style={{
        background: colors[priority] || '#999',
        color: 'white',
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 'bold',
        textTransform: 'uppercase'
      }}>
        {priority}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>
          Loading Process Intelligence...
        </div>
        <div style={{ color: '#666', fontSize: '14px' }}>
          Analyzing historical data from Camunda
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '30px', textAlign: 'center' }}>
        <div style={{ color: '#F44336', marginBottom: '15px', fontSize: '18px' }}>
          Error Loading Data
        </div>
        <div style={{ color: '#666', marginBottom: '20px' }}>{error}</div>
        <button 
          onClick={fetchOverview}
          style={{
            padding: '10px 20px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const maxDuration = analytics?.tasks?.length > 0 
    ? Math.max(...analytics.tasks.map(t => t.avgDurationSec))
    : 0;

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          Process Intelligence
          {processName && <span style={{ fontSize: '16px', color: '#666', fontWeight: 'normal' }}>- {processName}</span>}
        </h2>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          AI-powered analytics, bottleneck detection, and process optimization
        </p>
      </div>

      {/* Summary Cards */}
      {overview?.summary && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{ 
            background: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Completed Processes</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2196F3' }}>
              {overview.summary.totalCompletedProcesses}
            </div>
          </div>
          
          <div style={{ 
            background: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Tasks Analyzed</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4CAF50' }}>
              {overview.summary.totalTasksAnalyzed}
            </div>
          </div>

          <div style={{ 
            background: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Unique Task Types</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#FF9800' }}>
              {overview.summary.uniqueTaskTypes}
            </div>
          </div>

          <div style={{ 
            background: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Avg Task Duration</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9C27B0' }}>
              {analytics?.summary?.overallAvgTaskDuration 
                ? `${(analytics.summary.overallAvgTaskDuration / 60).toFixed(1)}m`
                : 'N/A'
              }
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        borderBottom: '2px solid #eee',
        paddingBottom: '10px'
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: '' },
          { id: 'analytics', label: 'Task Analytics', icon: '' },
          { id: 'heatmap', label: 'Heatmap', icon: '' },
          { id: 'recommendations', label: 'Recommendations', icon: '' },
          { id: 'simulation', label: 'Simulation', icon: '' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? '#2196F3' : 'white',
              color: activeTab === tab.id ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Process Overview</h3>
            
            {analytics?.summary?.slowestTask && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginBottom: '30px'
              }}>
                <div style={{ 
                  padding: '20px', 
                  background: '#ffebee', 
                  borderRadius: '8px',
                  border: '1px solid #ef9a9a'
                }}>
                  <div style={{ fontSize: '12px', color: '#c62828', marginBottom: '5px', fontWeight: 'bold' }}>
                    SLOWEST TASK
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
                    {analytics.summary.slowestTask.name}
                  </div>
                  <div style={{ fontSize: '24px', color: '#c62828', fontWeight: 'bold' }}>
                    {analytics.summary.slowestTask.avgDurationFormatted}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    {analytics.summary.slowestTask.executions} executions
                  </div>
                </div>

                <div style={{ 
                  padding: '20px', 
                  background: '#e8f5e9', 
                  borderRadius: '8px',
                  border: '1px solid #a5d6a7'
                }}>
                  <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '5px', fontWeight: 'bold' }}>
                    FASTEST TASK
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
                    {analytics.summary.fastestTask.name}
                  </div>
                  <div style={{ fontSize: '24px', color: '#2e7d32', fontWeight: 'bold' }}>
                    {analytics.summary.fastestTask.avgDurationFormatted}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    {analytics.summary.fastestTask.executions} executions
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div style={{ marginTop: '20px' }}>
              <h4>Quick Insights</h4>
              <ul style={{ lineHeight: '1.8' }}>
                {recommendations?.recommendations?.slice(0, 3).map((rec, idx) => (
                  <li key={idx} style={{ marginBottom: '10px' }}>
                    <strong>{rec.type === 'automation' ? '[AUTO]' : rec.type === 'standardization' ? '[STD]' : '[TIP]'}</strong>{' '}
                    {rec.message}
                  </li>
                ))}
                {!recommendations?.recommendations?.length && (
                  <li>No recommendations available yet. Need more process execution data.</li>
                )}
              </ul>
              
              {/* Generate Test Data Button */}
              {processDefinitionId && (
                <div style={{ marginTop: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                    <strong>Need test data?</strong> Generate fake process instances with realistic completion times.
                  </div>
                  <button
                    onClick={async () => {
                      setGeneratingData(true);
                      try {
                        const response = await fetch(`/api/mock-data/generate/${processDefinitionId}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ count: 10 })
                        });
                        const result = await response.json();
                        if (result.success) {
                          alert(`Generated ${result.details.instancesCreated} instances with ${result.details.tasksCompleted} completed tasks`);
                          fetchOverview(); // Refresh data
                        } else {
                          alert('Failed: ' + result.error);
                        }
                      } catch (err) {
                        alert('Error: ' + err.message);
                      } finally {
                        setGeneratingData(false);
                      }
                    }}
                    disabled={generatingData}
                    style={{
                      padding: '10px 20px',
                      background: generatingData ? '#ccc' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: generatingData ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {generatingData ? 'Generating...' : 'Generate 10 Test Instances'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Task Duration Analytics</h3>
            
            {analytics?.tasks?.length > 0 ? (
              <div>
                <div style={{ marginBottom: '30px' }}>
                  <h4>Average Duration by Task</h4>
                  {analytics.tasks.map((task, idx) => (
                    <BarChart
                      key={idx}
                      data={task.avgDurationSec}
                      maxValue={maxDuration}
                      color={task.avgDurationSec > maxDuration * 0.7 ? '#F44336' : task.avgDurationSec > maxDuration * 0.4 ? '#FF9800' : '#4CAF50'}
                      label={task.name}
                    />
                  ))}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Task</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Executions</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Avg Duration</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Min</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Max</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Std Dev</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.tasks.map((task, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: '500' }}>{task.name}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{task.executions}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2196F3' }}>
                            {task.avgDurationFormatted}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#4CAF50' }}>
                            {task.minDurationFormatted}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#F44336' }}>
                            {task.maxDurationFormatted}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {task.stdDeviation ? `${(task.stdDeviation / 60).toFixed(1)}m` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div>No task analytics available yet.</div>
                <div style={{ fontSize: '14px', marginTop: '10px' }}>
                  Execute some process instances to see analytics here.
                </div>
              </div>
            )}
          </div>
        )}

        {/* HEATMAP TAB */}
        {activeTab === 'heatmap' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Bottleneck Heatmap</h3>
            
            <HeatmapLegend />
            
            {heatmap?.length > 0 ? (
              <div style={{ display: 'grid', gap: '15px' }}>
                {heatmap.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      padding: '15px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      borderLeft: `5px solid ${item.color}`
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: item.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {item.level === 'high' ? '[HOT]' : item.level === 'medium' ? '[WATCH]' : 'OK'}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {item.executions} executions • {item.avgDurationFormatted || `${item.avgDurationHours.toFixed(1)}h avg`}
                      </div>
                    </div>

                    <div style={{ 
                      padding: '8px 15px', 
                      background: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                      maxWidth: '250px'
                    }}>
                      <strong>Recommendation:</strong> {item.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div>No heatmap data available yet.</div>
                <div style={{ fontSize: '14px', marginTop: '10px' }}>
                  Need completed process instances with end times to generate heatmap.
                </div>
              </div>
            )}
          </div>
        )}

        {/* RECOMMENDATIONS TAB */}
        {activeTab === 'recommendations' && (
          <div>
            <h3 style={{ marginTop: 0 }}>AI-Powered Recommendations</h3>
            
            {recommendations?.totalRecommendations > 0 ? (
              <div>
                <div style={{ 
                  display: 'flex', 
                  gap: '20px', 
                  marginBottom: '20px',
                  padding: '15px',
                  background: '#f0f4ff',
                  borderRadius: '8px'
                }}>
                  <div>
                    <strong>{recommendations.totalRecommendations}</strong> total recommendations
                  </div>
                  <div>
                    <strong style={{ color: '#F44336' }}>{recommendations.highPriorityCount}</strong> high priority
                  </div>
                  <div>
                    <strong style={{ color: '#4CAF50' }}>{recommendations.actionableCount}</strong> actionable
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {recommendations.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '20px',
                        background: rec.priority === 'high' ? '#ffebee' : rec.priority === 'medium' ? '#fff3e0' : '#f5f5f5',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${rec.priority === 'high' ? '#F44336' : rec.priority === 'medium' ? '#FF9800' : '#9E9E9E'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <PriorityBadge priority={rec.priority} />
                        <span style={{ 
                          fontSize: '12px', 
                          color: '#666',
                          background: '#e3f2fd',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {rec.type}
                        </span>
                        {rec.actionable && (
                          <span style={{ 
                            fontSize: '11px', 
                            color: '#4CAF50',
                            fontWeight: 'bold'
                          }}>
                            ACTIONABLE
                          </span>
                        )}
                      </div>

                      <h4 style={{ margin: '0 0 8px 0' }}>{rec.message}</h4>
                      
                      {rec.task && (
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                          Task: <strong>{rec.task}</strong>
                        </div>
                      )}

                      <p style={{ margin: '0 0 8px 0', fontSize: '14px', lineHeight: '1.5' }}>
                        {rec.reason}
                      </p>

                      <div style={{ fontSize: '12px', color: '#2196F3', fontWeight: '500' }}>
                        Impact: {rec.impact}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div>No recommendations available yet.</div>
                <div style={{ fontSize: '14px', marginTop: '10px' }}>
                  Execute more process instances to generate AI recommendations.
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIMULATION TAB */}
        {activeTab === 'simulation' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Monte Carlo Process Simulation</h3>
            
            <div style={{ 
              padding: '20px', 
              background: '#f5f5f5', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ marginTop: 0 }}>Simulation Configuration</h4>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Iterations</label>
                  <select
                    value={simOptions.iterations}
                    onChange={(e) => setSimOptions({...simOptions, iterations: parseInt(e.target.value) })}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value={100}>100 (Fast)</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000 (Standard)</option>
                    <option value={5000}>5000 (High Precision)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Confidence Level</label>
                  <select
                    value={simOptions.confidenceLevel}
                    onChange={(e) => setSimOptions({...simOptions, confidenceLevel: parseFloat(e.target.value) })}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value={0.90}>90%</option>
                    <option value={0.95}>95%</option>
                    <option value={0.99}>99%</option>
                  </select>
                </div>
              </div>

              <button
                onClick={runSimulation}
                disabled={simulationLoading || !processDefinitionId}
                style={{
                  padding: '12px 24px',
                  background: simulationLoading || !processDefinitionId ? '#ccc' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: simulationLoading || !processDefinitionId ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {simulationLoading ? 'Running Simulation...' : 'Run Simulation'}
              </button>

              {!processDefinitionId && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#F44336' }}>
                  Select a process first to run simulation
                </div>
              )}
            </div>

            {simulation && !simulation.error && (
              <div>
                <h4>Simulation Results ({simulation.iterations} iterations)</h4>

                {/* Data Quality Info */}
                {simulation.dataQuality && (
                  <div style={{ 
                    padding: '15px', 
                    background: simulation.dataQuality.warning ? '#fff3e0' : '#e8f5e9', 
                    borderRadius: '8px',
                    marginBottom: '20px',
                    borderLeft: `4px solid ${simulation.dataQuality.warning ? '#FF9800' : '#4CAF50'}`
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>
                      Data Quality: {simulation.dataQuality.totalTaskExecutions} task executions across {simulation.dataQuality.uniqueTaskTypes} task types
                    </div>
                    {simulation.dataQuality.warning && (
                      <div style={{ fontSize: '12px', color: '#e65100' }}>
                        {simulation.dataQuality.warning}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Main Results Cards */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '15px',
                  marginBottom: '30px'
                }}>
                  <div style={{ 
                    padding: '20px', 
                    background: '#e3f2fd', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Average Duration</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                      {simulation.formatted.average}
                    </div>
                  </div>

                  <div style={{ 
                    padding: '20px', 
                    background: '#e8f5e9', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Best Case</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                      {simulation.formatted.bestCase}
                    </div>
                  </div>

                  <div style={{ 
                    padding: '20px', 
                    background: '#ffebee', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Worst Case</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F44336' }}>
                      {simulation.formatted.worstCase}
                    </div>
                  </div>

                  <div style={{ 
                    padding: '20px', 
                    background: '#fff3e0', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Median</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>
                      {simulation.formatted.median}
                    </div>
                  </div>
                </div>

                {/* Percentiles */}
                <div style={{ marginBottom: '30px' }}>
                  <h4>Duration Percentiles</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                    {[
                      { label: 'P10', value: simulation.formatted?.p10 || '-', color: '#4CAF50' },
                      { label: 'P25', value: simulation.formatted?.p25 || '-', color: '#8BC34A' },
                      { label: 'P50', value: simulation.formatted?.median || '-', color: '#FF9800' },
                      { label: 'P75', value: simulation.formatted?.p75 || '-', color: '#FF5722' },
                      { label: 'P90', value: simulation.formatted?.p90 || '-', color: '#F44336' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ textAlign: 'center', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: p.color }}>{p.value}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confidence Interval */}
                <div style={{ 
                  padding: '20px', 
                  background: '#f3e5f5', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                    {simOptions.confidenceLevel * 100}% Confidence Interval
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9C27B0' }}>
                    {simulation.formatted.confidenceInterval}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Process will complete within this range with {simOptions.confidenceLevel * 100}% probability
                  </div>
                </div>
              </div>
            )}

            {simulation?.error && (
              <div style={{ 
                padding: '20px', 
                background: '#ffebee', 
                borderRadius: '8px',
                color: '#c62828'
              }}>
                <strong>Simulation Error:</strong> {simulation.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessIntelligence;
