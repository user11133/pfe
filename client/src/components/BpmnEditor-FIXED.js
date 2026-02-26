import React, { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './BpmnEditor.css';
import './BpmnEditor.css';

const BpmnEditor = ({ processDefinitionId, processName, xml: initialXml, onSave, onDeploy }) => {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [xml, setXml] = useState(initialXml || null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [properties, setProperties] = useState({});
  const [saving, setSaving] = useState(false);
  const [navigationStack, setNavigationStack] = useState([]);
  const [currentSubprocess, setCurrentSubprocess] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch BPMN XML
  useEffect(() => {
    if (initialXml) {
      setXml(initialXml);
      return;
    }
    
    if (!processDefinitionId) return;

    const fetchXml = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/processes/${processDefinitionId}/xml`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch BPMN XML');
        }
        
        const data = await response.text();
        setXml(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchXml();
  }, [processDefinitionId, initialXml]);

  // Initialize modeler
  useEffect(() => {
    if (!xml) return;

    // Small delay to ensure container is mounted
    const initModeler = () => {
      if (!containerRef.current) {
        console.error('Container not available');
        return;
      }

      const modeler = new BpmnModeler({
        container: containerRef.current,
        keyboard: {
          bindTo: window
        }
      });

      modelerRef.current = modeler;

      // Import XML with better error handling
      modeler.importXML(xml).then(() => {
        setLoading(false);
        
        // Fit viewport
        const canvas = modeler.get('canvas');
        if (canvas) {
          canvas.zoom('fit-viewport');
        }
      }).catch(err => {
        console.error('BPMN Import Error:', err);
        setError('Error importing BPMN: ' + (err.message || err.toString()));
        setLoading(false);
      });

      // Listen for selection changes
      const eventBus = modeler.get('eventBus');
      eventBus.on('selection.changed', (event) => {
        const selection = event.newSelection;
        if (selection.length === 1) {
          setSelectedElement(selection[0]);
          updateProperties(selection[0]);
        } else {
          setSelectedElement(null);
          setProperties({});
        }
      });

      // Listen for element clicks (separate from selection for subprocess navigation)
      eventBus.on('element.click', (event) => {
        const element = event.element;
        
        // Check if clicked element is a subprocess (handle both bpmn:SubProcess and bpmn:subProcess)
        if (element.type === 'bpmn:SubProcess' || element.type === 'bpmn:subProcess') {
          const subprocessId = element.id;
          const subprocessName = element.businessObject?.name || `SubProcess ${subprocessId}`;
          
          // Add to navigation stack
          setNavigationStack(prev => [...prev, { 
            id: currentSubprocess?.id || 'root', 
            name: currentSubprocess?.name || processName || 'Main Process' 
          }]);
          setCurrentSubprocess({ id: subprocessId, name: subprocessName });
          
          // Zoom to subprocess
          const canvas = modeler.get('canvas');
          if (canvas) {
            canvas.zoom('fit-viewport', { element });
          }
          
          console.log('Navigated to subprocess:', subprocessName);
        }
      });

      // Listen for element changes
      eventBus.on('element.changed', (event) => {
        if (selectedElement && event.element.id === selectedElement.id) {
          updateProperties(event.element);
        }
      });

      return () => {
        modeler.destroy();
      };
    };

    // Delay initialization to ensure DOM is ready
    setTimeout(initModeler, 100);
  }, [xml, currentSubprocess?.id, currentSubprocess?.name, processName, selectedElement]);

  const updateProperties = (element) => {
    setProperties({
      id: element.id,
      name: element.businessObject?.name || '',
      type: element.type,
      documentation: element.businessObject?.documentation?.[0]?.text || ''
    });
  };

  const handlePropertyChange = (key, value) => {
    if (!selectedElement || !modelerRef.current) return;

    const modeling = modelerRef.current.get('modeling');
    const businessObject = selectedElement.businessObject;
    
    if (key === 'name') {
      modeling.updateProperties(selectedElement, {
        name: value
      });
    } else if (key === 'documentation') {
      modeling.updateProperties(selectedElement, {
        documentation: value ? [{ text: value }] : undefined
      });
    }
    
    setProperties(prev => ({ ...prev, [key]: value }));
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  // Add fullscreen event listener
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleSave = async () => {
    if (!modelerRef.current) return;

    try {
      setSaving(true);
      const { xml: newXml } = await modelerRef.current.saveXML({ format: true });
      
      if (onSave) {
        await onSave(newXml);
      }
      
      setSaving(false);
    } catch (err) {
      console.error('Error saving BPMN:', err);
      setError('Error saving BPMN: ' + err.message);
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!modelerRef.current) return;

    try {
      setSaving(true);
      const { xml: newXml } = await modelerRef.current.saveXML({ format: true });
      
      // Default deploy behavior
      const response = await fetch('/api/deploy-process-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: newXml,
          filename: `${processName || 'process'}.bpmn`
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Process deployed successfully:', result);
        if (onDeploy) {
          onDeploy(result);
        }
      } else {
        console.error('Deploy failed:', response.statusText);
        setError('Failed to deploy process to Camunda');
      }
      
      setSaving(false);
    } catch (err) {
      console.error('Error deploying process:', err);
      setError('Error deploying process: ' + err.message);
      setSaving(false);
    }
  };

  const downloadXml = async () => {
    if (!modelerRef.current) return;

    try {
      const { xml: newXml } = await modelerRef.current.saveXML({ format: true });
      
      const blob = new Blob([newXml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${processName || 'process'}.bpmn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading BPMN:', err);
      setError('Error downloading BPMN: ' + err.message);
    }
  };

  const navigateBack = () => {
    if (navigationStack.length === 0) {
      console.log('No navigation stack to go back to');
      return;
    }
    
    const newStack = [...navigationStack];
    const previousLevel = newStack.pop();
    
    console.log('Going back to:', previousLevel);
    
    setNavigationStack(newStack);
    setCurrentSubprocess(previousLevel.id === 'root' ? null : previousLevel);
    
    // Zoom back to previous level
    const canvas = modelerRef.current.get('canvas');
    if (previousLevel.id === 'root') {
      canvas.zoom('fit-viewport');
    } else {
      // Find the subprocess element in the current diagram
      const elementRegistry = modelerRef.current.get('elementRegistry');
      const subprocessElement = elementRegistry.get(previousLevel.id);
      
      if (subprocessElement) {
        canvas.zoom('fit-viewport', { element: subprocessElement });
      }
    }
  };

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#c62828' }}>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={`bpmn-editor-container ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Left Panel - BPMN Editor */}
      <div className="editor-panel">
        {/* Header */}
        <div style={{ 
          background: '#f8f9fa', 
          padding: '10px 15px', 
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h4 style={{ margin: 0, color: '#2c3e50' }}>
              {currentSubprocess ? currentSubprocess.name : (processName || 'BPMN Editor')}
            </h4>
            {navigationStack.length > 0 && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Navigation: {navigationStack.map((item, index) => 
                  <span key={index}>
                    {item.name}
                    {index < navigationStack.length - 1 && ' → '}
                  </span>
                ).concat(currentSubprocess ? [currentSubprocess.name] : [])}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Full-screen toggle button */}
            <button 
              onClick={toggleFullscreen}
              className="fullscreen-button"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? '⛶ Exit' : '⛶ Full'}
            </button>

            {/* Back button */}
            {navigationStack.length > 0 && (
              <button 
                onClick={navigateBack}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#5a6268';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#6c757d';
                }}
              >
                ← Back to Previous Level
              </button>
            )}
          </div>
        </div>

        {/* BPMN Canvas */}
        <div style={{ 
          flex: 1, 
          position: 'relative',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '16px',
              color: '#666',
              zIndex: 10
            }}>
              Loading BPMN Editor...
            </div>
          )}
          
          {/* Fallback when modeler fails */}
          {!loading && !modelerRef.current && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#666',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <h3>BPMN Editor Loading Issue</h3>
              <p>Unable to initialize BPMN editor.</p>
              <p style={{ fontSize: '14px' }}>Please refresh page and try again.</p>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                Refresh Page
              </button>
            </div>
          )}

          <div 
            ref={containerRef} 
            style={{ 
              width: '100%', 
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0
            }} 
          />
        </div>
      </div>

      {/* Properties Panel */}
      <div style={{ 
        width: isFullscreen ? '0%' : '40%', 
        border: '1px solid #ddd', 
        borderRadius: '4px',
        padding: '20px',
        background: '#fafafa',
        overflowY: 'auto'
      }}>
        {selectedElement ? (
          <div>
            <h3 style={{ 
              margin: '0 0 15px 0', 
              color: '#2c3e50',
              borderBottom: '2px solid #e74c3c',
              paddingBottom: '10px'
            }}>
              Element Properties
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold', 
                color: '#333' 
              }}>
                ID:
              </label>
              <input
                type="text"
                value={properties.id}
                readOnly
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold', 
                color: '#333' 
              }}>
                Name:
              </label>
              <input
                type="text"
                value={properties.name}
                onChange={(e) => handlePropertyChange('name', e.target.value)}
                placeholder="Element name..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold', 
                color: '#333' 
              }}>
                Type:
              </label>
              <input
                type="text"
                value={properties.type}
                readOnly
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold', 
                color: '#333' 
              }}>
                Documentation:
              </label>
              <textarea
                value={properties.documentation}
                onChange={(e) => handlePropertyChange('documentation', e.target.value)}
                placeholder="Add documentation..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ 
              padding: '10px', 
              background: '#e3f2fd', 
              borderRadius: '4px',
              fontSize: '12px',
              color: '#1976d2'
            }}>
              Click on any element in the diagram to edit its properties.
              Drag from palette to add new elements.
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
            <div style={{ marginBottom: '10px' }}>No element selected</div>
            <div style={{ fontSize: '12px' }}>
              Click on an element in the diagram to edit its properties
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BpmnEditor;
