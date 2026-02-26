import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import BpmnViewer from './components/BpmnViewer';
import BpmnEditor from './components/BpmnEditor';
import BpmnUploader from './components/BpmnUploader';
import ProcessIntelligence from './components/ProcessIntelligence';
import TaskList from './components/TaskList';
import './App.css';
import logo from './assets/logo.png';

function App() {
  const [activeTab, setActiveTab] = useState('risks');
  const [risks, setRisks] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in (from localStorage)
    const savedUser = localStorage.getItem('v-bpm-user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // Fetch initial data
    fetch('/api/risks')
      .then(res => res.json())
      .then(data => setRisks(data))
      .catch(err => console.error('Error fetching risks:', err));

    fetch('/api/processes')
      .then(res => res.json())
      .then(data => setProcesses(data))
      .catch(err => console.error('Error fetching processes:', err));
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('v-bpm-user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('v-bpm-user');
  };

  const handleProcessClick = (process) => {
    setSelectedProcess(process);
    setActiveTab('diagram');
  };

  // Show Auth component if not logged in
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="header-left">
            <div className="title-section">
              <h1>v-bpm</h1>
             
            </div>
          </div>
          <div className="user-info">
            <span>Welcome, {user.name}</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <div className="main-layout">
        <div className="taskbar">
          <div className="taskbar-header text-center">
            <img src={logo} alt="Company Logo" style={{ 
              height: '40px', 
              width: 'auto', 
              maxHeight: '40px',
              maxWidth: '120px',
              objectFit: 'contain',
              marginBottom: '15px'
            }} />
          </div>
          <button 
            className={`taskbar-item ${activeTab === 'risks' ? 'active' : ''}`}
            onClick={() => setActiveTab('risks')}
          >
            Risks
          </button>
          <button 
            className={`taskbar-item ${activeTab === 'processes' ? 'active' : ''}`}
            onClick={() => setActiveTab('processes')}
          >
            Processes
          </button>
          <button 
            className={`taskbar-item ${activeTab === 'diagram' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagram')}
            disabled={!selectedProcess}
          >
            Diagram
          </button>
          <button 
            className={`taskbar-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload
          </button>
          <button 
            className={`taskbar-item ${activeTab === 'intelligence' ? 'active' : ''}`}
            onClick={() => setActiveTab('intelligence')}
            disabled={!selectedProcess}
          >
            Intelligence
          </button>
          <button 
            className={`taskbar-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
            disabled={!selectedProcess}
          >
            Tasks
          </button>
        </div>

        <div className="content">
        {activeTab === 'risks' && (
          <div>
            <h2>Risk Management</h2>
            <div className="card-container">
              {risks.map(risk => (
                <div key={risk.id} className="card">
                  <h3>{risk.title}</h3>
                  <p><strong>Level:</strong> {risk.level}</p>
                  <p><strong>Status:</strong> {risk.status}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'processes' && (
          <div>
            <h2>Process Management</h2>
            <div className="card-container">
              {processes.map(process => (
                <div key={process.id} className="card clickable" onClick={() => handleProcessClick(process)}>
                  <h3>{process.name}</h3>
                  <p><strong>Key:</strong> {process.key}</p>
                  <p><strong>Version:</strong> {process.version}</p>
                  <p><strong>Status:</strong> {process.status}</p>
                  <p><strong>Running Instances:</strong> {process.instances || 0}</p>
                  <p><strong>Active Tasks:</strong> {process.activeTasks || 0}</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startProcess(process.id);
                    }}
                    style={{
                      marginTop: '10px',
                      padding: '5px 10px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    Start Process
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'diagram' && selectedProcess && (
          <div>
            <h2>BPMN Editor</h2>
            <BpmnEditor 
              processDefinitionId={selectedProcess.id}
              processName={selectedProcess.name}
              onDeploy={async (xml, name) => {
                const response = await fetch('/api/deploy-process-json', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    data: xml,
                    filename: `${name || 'process'}.bpmn`
                  })
                });
                const result = await response.json();
                if (result.success) {
                  alert('Process deployed successfully!');
                  fetch('/api/processes')
                    .then(res => res.json())
                    .then(data => setProcesses(data));
                } else {
                  alert('Deploy failed: ' + result.error);
                }
              }}
            />
          </div>
        )}

        {activeTab === 'upload' && (
          <div>
            <h2>Deploy BPMN Process</h2>
            <BpmnUploader 
              onUploadSuccess={() => {
                // Refresh processes list after successful upload
                fetch('/api/processes')
                  .then(res => res.json())
                  .then(data => setProcesses(data));
                setActiveTab('processes');
              }}
            />
          </div>
        )}

        {activeTab === 'intelligence' && selectedProcess && (
          <div>
            <ProcessIntelligence 
              processDefinitionId={selectedProcess.id}
              processName={selectedProcess.name}
            />
          </div>
        )}

        {activeTab === 'tasks' && selectedProcess && (
          <div>
            <h2>Task Management</h2>
            <TaskList 
              processDefinitionId={selectedProcess.id}
              processName={selectedProcess.name}
              onTaskCompleted={() => {
                // Refresh processes to update task count
                fetch('/api/processes')
                  .then(res => res.json())
                  .then(data => setProcesses(data));
              }}
            />
          </div>
        )}
      </div>
    </div>
  </div>
  );

  function startProcess(processId) {
    fetch(`/api/processes/${processId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variables: {},
        businessKey: `process-${Date.now()}`
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Process started successfully!');
        // Refresh processes to update instance count
        fetch('/api/processes')
          .then(res => res.json())
          .then(data => setProcesses(data));
      } else {
        alert('Failed to start process');
      }
    })
    .catch(err => {
      console.error('Error starting process:', err);
      alert('Error starting process');
    });
  }
}

export default App;
