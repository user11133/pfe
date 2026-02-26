import React, { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
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
            canvas.zoom('fit-viewport', { element });
            
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

  // Full-screen functions
  const toggleFullscreenMode = () => {
    setIsFullscreen(!isFullscreen);
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
      
      // Download option
      const blob = new Blob([newXml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${processName || 'process'}.bpmn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!modelerRef.current) return;

    try {
      setSaving(true);
      const { xml: newXml } = await modelerRef.current.saveXML({ format: true });
      
      if (onDeploy) {
        await onDeploy(newXml, processName);
      } else {
        // Default deploy behavior
        const response = await fetch('/api/deploy-process-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: newXml,
            filename: `${processName || 'process'}.bpmn`
          })
        });
        
        const result = await response.json();
        if (result.success) {
          alert('Process deployed successfully!');
        } else {
          alert('Deploy failed: ' + result.error);
        }
      }
    } catch (err) {
      alert('Error deploying: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadXml = async () => {
    if (!modelerRef.current) return;

    try {
      const { xml: newXml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([newXml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${processName || 'process'}.bpmn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading: ' + err.message);
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
      const element = canvas.getGraphics(previousLevel.id);
      if (element) {
        canvas.zoom('fit-viewport', { element });
      }
    }
  };

  const navigateToBreadcrumb = (index) => {
    console.log('Navigating to breadcrumb index:', index);
    
    const targetLevel = index === 0 ? null : navigationStack[index - 1];
    const newStack = navigationStack.slice(0, index);
    
    setNavigationStack(newStack);
    setCurrentSubprocess(targetLevel);
    
    // Zoom to target level
    const canvas = modelerRef.current.get('canvas');
    if (!targetLevel) {
      canvas.zoom('fit-viewport');
    } else {
      const element = canvas.getGraphics(targetLevel.id);
      if (element) {
        canvas.zoom('fit-viewport', { element });
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
    <div style={{ 
      display: 'flex', 
      height: '600px', 
      border: '1px solid #ddd',
      overflow: 'hidden' // Prevent overflow issues
    }}>
      {/* Main Canvas */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minHeight: 0 // Important for flex children
      }}>
        {/* Toolbar with Breadcrumbs */}
        <div style={{ 
          padding: '10px', 
          borderBottom: '1px solid #ddd', 
          display: 'flex', 
          gap: '10px',
          background: '#f5f5f5',
          alignItems: 'center'
        }}>
          {/* Breadcrumbs */}
          <div style={{ fontSize: '12px', color: '#666' }}>
            Navigation: {navigationStack.map((item, index) => 
              <span key={index}>
                {item.name}
                {index < navigationStack.length - 1 && ' → '}
              </span>
            ).concat(currentSubprocess ? [currentSubprocess.name] : [])}
          </div> 

        {/* Back Button */}
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
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = '#6c757d';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            ← Back to Previous Level
          </button>
        )}

        <button 
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 16px',
            background: saving ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Saving...' : 'Download BPMN'}
        </button>
        
        <button 
          onClick={handleDeploy}
          disabled={saving}
          style={{
            padding: '8px 16px',
            background: saving ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Deploying...' : 'Deploy to Camunda'}
        </button>

        <button 
          onClick={downloadXml}
          style={{
            padding: '8px 16px',
            background: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Export XML
        </button>
        
        <button 
          onClick={toggleFullscreen}
          className="fullscreen-button"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? '⛶ Exit' : '⛶ Full'}
        </button>
        
        <button 
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          style={{
            padding: '8px 12px',
            background: isFullscreen ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = isFullscreen ? '#c82333' : '#218838';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = isFullscreen ? '#dc3545' : '#28a745';
          }}
        >
          {isFullscreen ? (
            <>
              <span>⛶</span>
              <span style={{ fontSize: '12px' }}>Exit</span>
            </>
          ) : (
            <>
              <span>⛶</span>
              <span style={{ fontSize: '12px' }}>Full</span>
            </>
          )}
        </button>

        <button 
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          style={{
            background: isFullscreen ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = isFullscreen ? '#c82333' : '#218838';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = isFullscreen ? '#dc3545' : '#28a745';
          }}
        >
          {isFullscreen ? (
            <>
              <span>⛶</span>
              <span style={{ fontSize: '12px' }}>Exit</span>
            </>
          ) : (
            <>
              <span>⛶</span>
              <span style={{ fontSize: '12px' }}>Full</span>
            </>
          )}
        </button>
      </div>

      {/* BPMN Canvas */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        minHeight: 0, // Important for flex layout
        overflow: 'hidden' // Prevent canvas overflow
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
          )}

          <button 
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: saving ? '#ccc' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Download BPMN'}
          </button>
          
          <button 
            onClick={handleDeploy}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: saving ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Deploying...' : 'Deploy to Camunda'}
          </button>

          <button 
            onClick={downloadXml}
            style={{
              padding: '8px 16px',
              background: '#757575',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Export XML
          </button>,
        
        <button 
          onClick={toggleFullscreen}
          className="fullscreen-button"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? '⛶ Exit' : '⛶ Full'}
        </button>
        </div>

        {/* BPMN Canvas */}
        <div style={{ 
          flex: 1, 
          position: 'relative',
          minHeight: 0, // Important for flex layout
          overflow: 'hidden' // Prevent canvas overflow
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
              width: isFullscreen ? '100vw' : '100%', 
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
        width: '300px', 
        borderLeft: '1px solid #ddd', 
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0, // Important for flex layout
        overflow: 'hidden' // Prevent overflow
      }}>
        <div style={{ 
          padding: '15px', 
          borderBottom: '1px solid #ddd',
          background: '#f0f0f0',
          fontWeight: 'bold'
        }}>
          Properties Panel
        </div>

        <div style={{ padding: '15px', overflowY: 'auto', flex: 1 }}>
          {selectedElement ? (
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  color: '#666', 
                  marginBottom: '5px',
                  fontWeight: 'bold'
                }}>
                  Element Type
                </label>
                <div style={{ 
                  padding: '8px', 
                  background: '#e0e0e0', 
                  borderRadius: '4px',
                  fontSize: '13px'
                }}>
                  {properties.type}
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  color: '#666', 
                  marginBottom: '5px',
                  fontWeight: 'bold'
                }}>
                  ID
                </label>
                <input
                  type="text"
                  value={properties.id}
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px',
                    background: '#f5f5f5'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  color: '#666', 
                  marginBottom: '5px',
                  fontWeight: 'bold'
                }}>
                  Name
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
                  fontSize: '12px', 
                  color: '#666', 
                  marginBottom: '5px',
                  fontWeight: 'bold'
                }}>
                  Documentation
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
                color: '#1976D2'
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

        {/* Help */}
        <div style={{ 
          padding: '15px', 
          borderTop: '1px solid #ddd',
          fontSize: '12px',
          color: '#666'
        }}>
          <strong>Tips:</strong>
          <ul style={{ margin: '5px 0', paddingLeft: '15px' }}>
            <li>Double-click to edit names directly</li>
            <li>Drag elements from palette</li>
            <li>Connect with sequence flows</li>
            <li>Ctrl+Z to undo</li>
            <li>Click on subprocesses to navigate into them</li>
            <li>Use breadcrumbs or Back button to navigate up</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BpmnEditor;
