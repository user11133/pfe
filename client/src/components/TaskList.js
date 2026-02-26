import React, { useState, useEffect } from 'react';

/**
 * TaskList Component
 * Displays active tasks and allows completing them
 */
const TaskList = ({ processDefinitionId, processName, onTaskCompleted }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState(null);

  // Fetch tasks when process changes
  useEffect(() => {
    fetchTasks();
  }, [processDefinitionId, fetchTasks]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      // Fetch all tasks and filter by processDefinitionId
      const response = await fetch('/api/tasks');
      const allTasks = await response.json();
      
      // Filter tasks for this process
      const processTasks = processDefinitionId 
        ? allTasks.filter(task => task.processDefinitionId === processDefinitionId)
        : allTasks;
      
      setTasks(processTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId) => {
    try {
      setCompletingTaskId(taskId);
      
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variables: {} // Add variables here if needed
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Remove completed task from list
        setTasks(tasks.filter(t => t.id !== taskId));
        
        // Notify parent component
        if (onTaskCompleted) {
          onTaskCompleted(taskId);
        }
      } else {
        alert('Failed to complete task: ' + result.error);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Error completing task: ' + error.message);
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Calculate how long task has been open
  const getTaskAge = (createdDate) => {
    if (!createdDate) return 'Unknown';
    const created = new Date(createdDate);
    const now = new Date();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
        Loading tasks...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '30px', 
        color: '#666',
        background: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '16px', marginBottom: '10px' }}>
          No active tasks
        </div>
        <div style={{ fontSize: '13px' }}>
          {processName 
            ? `All tasks for "${processName}" have been completed.` 
            : 'Start a process instance to see tasks here.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        <h3 style={{ margin: '0 0 5px 0' }}>
          Active Tasks ({tasks.length})
        </h3>
        {processName && (
          <div style={{ fontSize: '13px', color: '#666' }}>
            Process: {processName}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tasks.map(task => (
          <div
            key={task.id}
            style={{
              padding: '15px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #ddd',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '10px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '15px',
                  marginBottom: '5px'
                }}>
                  {task.name || 'Unnamed Task'}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Task ID: {task.id.substring(0, 8)}...
                </div>
              </div>
              
              <button
                onClick={() => completeTask(task.id)}
                disabled={completingTaskId === task.id}
                style={{
                  padding: '8px 16px',
                  background: completingTaskId === task.id ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: completingTaskId === task.id ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                {completingTaskId === task.id ? 'Completing...' : 'Complete'}
              </button>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              fontSize: '12px',
              color: '#666',
              background: '#f8f9fa',
              padding: '10px',
              borderRadius: '4px'
            }}>
              <div>
                <strong>Assignee:</strong> {task.assignee || 'Unassigned'}
              </div>
              <div>
                <strong>Created:</strong> {formatDate(task.created)}
              </div>
              <div>
                <strong>Age:</strong> {getTaskAge(task.created)}
              </div>
              {task.due && (
                <div>
                  <strong>Due:</strong> {formatDate(task.due)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskList;
