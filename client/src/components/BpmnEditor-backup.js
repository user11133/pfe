import React, { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './BpmnEditorFullscreen.css';

const BpmnEditor = ({ processDefinitionId, processName, xml: initialXml, onSave, onDeploy }) => {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const editorContainerRef = useRef(null);
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
        console.error('❌ Container not available for BPMN modeler');
        setError('Container not available for BPMN editor');
        setLoading(false);
        return;
      }

      console.log('🔄 Initializing BPMN modeler...');
      
      try {
        const modeler = new BpmnModeler({
          container: containerRef.current,
          keyboard: {
            bindTo: window
          }
        });

        modelerRef.current = modeler;
        console.log('✅ BPMN modeler created successfully');

      // Import XML with better error handling
        modeler.importXML(xml).then(() => {
          console.log('✅ BPMN XML imported successfully');
          setLoading(false);
          
          // Fit viewport
          const canvas = modeler.get('canvas');
          if (canvas) {
            canvas.zoom('fit-viewport');
          }
        }).catch(err => {
          console.error('❌ BPMN Import Error:', err);
          console.error('❌ Error details:', {
            message: err.message,
            name: err.name,
            stack: err.stack
          });
          
          // Try to create a minimal BPMN as fallback
          try {
            console.log('🔄 Attempting to create minimal BPMN fallback...');
            const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="fallback-process" name="Fallback Process" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start"/>
    <bpmn:userTask id="Task_1" name="Sample Task"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
  </bpmn:process>
</bpmn:definitions>`;
            
            modeler.importXML(minimalXml).then(() => {
              console.log('✅ Minimal BPMN fallback loaded successfully');
              setLoading(false);
              setError('Warning: Using minimal BPMN template due to import error');
            }).catch(fallbackErr => {
              console.error('❌ Even fallback failed:', fallbackErr);
              setError('Failed to initialize BPMN editor: ' + err.message + ' (fallback also failed: ' + fallbackErr.message + ')');
              setLoading(false);
            });
          } catch (fallbackErr) {
            console.error('❌ Fallback creation failed:', fallbackErr);
            setError('Failed to initialize BPMN editor: ' + err.message + ' (fallback creation failed: ' + fallbackErr.message + ')');
            setLoading(false);
          }
        });

        // Listen for selection changes
        const eventBus = modeler.get('eventBus');
        let lastSelection = null;
        
        eventBus.on('selection.changed', (event) => {
          console.log('Selection changed:', event.newSelection.map(el => ({ id: el.id, type: el.type })));
          const selection = event.newSelection;
          
          // Prevent multiple clearings of the same selection
          const currentSelectionId = selection.length === 1 ? selection[0].id : null;
          const lastSelectionId = lastSelection ? lastSelection.id : null;
          
          if (currentSelectionId === lastSelectionId) {
            console.log('Selection unchanged, skipping');
            return;
          }
          
          lastSelection = selection.length === 1 ? selection[0] : null;
          
          // Use setTimeout to prevent immediate clearing
          setTimeout(() => {
            if (selection.length === 1) {
              console.log('Element selected:', selection[0].id, selection[0].type);
              const selectedEl = selection[0];
              setSelectedElement(selectedEl);
              updateProperties(selectedEl);
              
              // Check if selected element should trigger navigation (for testing with any element)
              if (selectedEl.type === 'bpmn:SubProcess' || selectedEl.type === 'bpmn:subProcess' || selectedEl.id.includes('Gateway')) {
                console.log('=== NAVIGATION TRIGGERED ===');
                const subprocessId = selectedEl.id;
                const subprocessName = selectedEl.businessObject?.name || `Element ${subprocessId}`;
                
                console.log('Navigation element clicked:', subprocessId, subprocessName, 'type:', selectedEl.type);
                console.log('Current state before navigation:', { currentSubprocess, navigationStack });
                
                // Add current level to navigation stack before navigating
                const currentLevel = currentSubprocess || { 
                  id: 'root', 
                  name: processName || 'Main Process' 
                };
                
                console.log('Adding to stack:', currentLevel);
                
                setNavigationStack(prev => {
                  const newStack = [...prev, currentLevel];
                  console.log('New navigation stack:', newStack);
                  return newStack;
                });
                
                setCurrentSubprocess({ id: subprocessId, name: subprocessName });
                
                // Zoom to selected element
                const canvas = modeler.get('canvas');
                canvas.zoom('fit-viewport', { element: selectedEl });
                
                console.log('Navigated to element:', subprocessName);
              } else {
                console.log('=== NOT A NAVIGATION ELEMENT ===');
                console.log('Element type:', selectedEl.type);
                console.log('Element ID:', selectedEl.id);
                console.log('Expected types: bpmn:SubProcess, bpmn:subProcess, or any Gateway');
              }
            } else {
              console.log('Selection cleared');
              setSelectedElement(null);
              setProperties({});
            }
          }, 10);
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
    console.log('Updating properties for element:', element.id, element.type);
    const newProperties = {
      id: element.id,
      name: element.businessObject?.name || '',
      type: element.type,
      documentation: element.businessObject?.documentation?.[0]?.text || ''
    };
    console.log('New properties:', newProperties);
    setProperties(newProperties);
  };

  const handlePropertyChange = (key, value) => {
    console.log('Property change:', { key, value, selectedElement: selectedElement?.id });
    
    if (!selectedElement || !modelerRef.current) {
      console.log('Property change blocked: no selected element or modeler');
      return;
    }

    const modeling = modelerRef.current.get('modeling');
    const businessObject = selectedElement.businessObject;

    if (key === 'name') {
      console.log('Updating name to:', value);
      modeling.updateLabel(selectedElement, value);
    } else if (key === 'documentation') {
      console.log('Updating documentation to:', value);
      // Update documentation via command stack
      const commandStack = modelerRef.current.get('commandStack');
      commandStack.execute('element.updateProperties', {
        element: selectedElement,
        properties: {
          documentation: [{ text: value }]
        }
      });
    }

    setProperties(prev => ({ ...prev, [key]: value }));
  };

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
    console.log('=== NAVIGATE BACK CALLED ===');
    console.log('Current navigation stack:', navigationStack);
    console.log('Current subprocess:', currentSubprocess);
    
    if (navigationStack.length === 0) {
      console.log('No navigation stack to go back to');
      return;
    }
    
    const newStack = [...navigationStack];
    const previousLevel = newStack.pop();
    
    console.log('Going back to:', previousLevel);
    console.log('New stack after pop:', newStack);
    
    setNavigationStack(newStack);
    setCurrentSubprocess(previousLevel.id === 'root' ? null : previousLevel);
    
    // Zoom back to previous level
    const canvas = modelerRef.current.get('canvas');
    if (previousLevel.id === 'root') {
      console.log('Zooming to root level');
      canvas.zoom('fit-viewport');
    } else {
      const elementRegistry = modelerRef.current.get('elementRegistry');
      const subprocessElement = elementRegistry.get(previousLevel.id);
      
      console.log('Looking for element:', previousLevel.id);
      console.log('Found element:', subprocessElement);
      
      if (subprocessElement) {
        canvas.zoom('fit-viewport', { element: subprocessElement });
      } else {
        console.log('Element not found, zooming to fit viewport');
        canvas.zoom('fit-viewport');
      }
    }
  };

  const navigateToBreadcrumb = (index) => {
    console.log('=== NAVIGATE TO BREADCRUMB CALLED ===');
    console.log('Breadcrumb index:', index);
    console.log('Current navigation stack:', navigationStack);
    console.log('Current subprocess:', currentSubprocess);
    
    if (index === 0) {
      // Navigate to root
      console.log('Navigating to root level');
      setNavigationStack([]);
      setCurrentSubprocess(null);
      const canvas = modelerRef.current.get('canvas');
      canvas.zoom('fit-viewport');
      return;
    }
    
    // Navigate to specific level
    const targetLevel = navigationStack[index - 1];
    const newStack = navigationStack.slice(0, index);
    
    console.log('Target level:', targetLevel);
    console.log('New stack:', newStack);
    
    setNavigationStack(newStack);
    setCurrentSubprocess(targetLevel);
    
    // Zoom to target level
    const canvas = modelerRef.current.get('canvas');
    const elementRegistry = modelerRef.current.get('elementRegistry');
    const subprocessElement = elementRegistry.get(targetLevel.id);
    
    console.log('Looking for breadcrumb element:', targetLevel.id);
    console.log('Found breadcrumb element:', subprocessElement);
    
    if (subprocessElement) {
      canvas.zoom('fit-viewport', { element: subprocessElement });
    } else {
      console.log('Breadcrumb element not found, zooming to fit viewport');
      canvas.zoom('fit-viewport');
    }
  };

  // Full-screen functions
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // Enter fullscreen for editor container only
      if (editorContainerRef.current) {
        editorContainerRef.current.requestFullscreen().catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      }
    } else {
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
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
      <div 
        ref={editorContainerRef}
        className="bpmn-editor-container"
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0, // Important for flex children
          position: 'relative',
          backgroundColor: isFullscreen ? '#fff' : 'transparent'
        }}
      >
        {/* Toolbar with Breadcrumbs */}
        <div 
          className="toolbar"
          style={{ 
            padding: '10px', 
            borderBottom: '1px solid #ddd', 
            display: 'flex', 
            gap: '10px',
            background: '#f5f5f5',
            alignItems: 'center'
          }}>
          {/* Breadcrumbs */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            flex: 1,
            fontSize: '14px'
          }}>
            <span 
              onClick={() => navigateToBreadcrumb(0)}
              style={{ 
                cursor: 'pointer',
                color: !currentSubprocess ? '#2196F3' : '#666',
                fontWeight: !currentSubprocess ? 'bold' : 'normal'
              }}
            >
              {processName || 'Main Process'}
            </span>
            
            {navigationStack.map((level, index) => (
              <React.Fragment key={level.id}>
                <span style={{ color: '#999' }}>›</span>
                <span 
                  onClick={() => navigateToBreadcrumb(index + 1)}
                  style={{ 
                    cursor: 'pointer',
                    color: currentSubprocess?.id === level.id ? '#2196F3' : '#666',
                    fontWeight: currentSubprocess?.id === level.id ? 'bold' : 'normal'
                  }}
                >
                  {level.name}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Back Button */}
          {navigationStack.length > 0 && (
            <button 
              onClick={navigateBack}
              style={{
                padding: '8px 16px',
                background: '#2196F3',
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
                e.target.style.background = '#1976D2';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#2196F3';
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
            style={{
              padding: '8px 12px',
              background: isFullscreen ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {isFullscreen ? '⛶ Exit' : '⛶ Full'}
          </button>
        </div>

        {/* BPMN Canvas */}
        <div 
          className="canvas-container"
          style={{ 
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
        width: '40%', 
        border: '1px solid #ddd', 
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
