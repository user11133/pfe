import React, { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './BpmnEditorFullscreen.css';

const BpmnEditor = ({ processDefinitionId, processName, xml: initialXml, onSave, onDeploy }) => {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const editorContainerRef = useRef(null);
  const paletteRef = useRef(null);
  const mainContainerRef = useRef(null);
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
          },
          palette: true
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
          
          // Use setTimeout to prevent immediate clearing
          setTimeout(() => {
            if (selection.length === 1) {
              console.log('Element selected:', selection[0].id, selection[0].type);
              const selectedEl = selection[0];
              setSelectedElement(selectedEl);
              updateProperties(selectedEl);
              
              // Only trigger navigation for SubProcesses, not for other elements
              if (selectedEl.type === 'bpmn:SubProcess' || selectedEl.type === 'bpmn:subProcess') {
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
                setNavigationStack(prev => [...prev, currentLevel]);
                setCurrentSubprocess({ id: subprocessId, name: subprocessName });
                
                console.log('Navigated to element:', subprocessName);
                
                // Zoom to the subprocess
                const canvas = modeler.get('canvas');
                if (canvas) {
                  canvas.zoom('fit-viewport', { element: selectedEl });
                }
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
      } catch (initErr) {
        console.error('❌ Modeler initialization failed:', initErr);
        setError('Failed to initialize BPMN modeler: ' + initErr.message);
        setLoading(false);
      }
    };

    // Delay initialization to ensure DOM is ready
    setTimeout(initModeler, 100);
  }, [xml]);

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
      // Enter fullscreen for the entire BPMN editor layout
      if (mainContainerRef.current) {
        mainContainerRef.current.requestFullscreen().catch(err => {
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
    const isCurrentlyFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isCurrentlyFullscreen);
    
    console.log('Fullscreen changed:', isCurrentlyFullscreen);
    
    // Manually adjust layout for fullscreen - use refs for reliability
    const palette = paletteRef.current;
    const canvas = editorContainerRef.current;
    
    console.log('Palette found:', !!palette);
    console.log('Canvas found:', !!canvas);
    
    if (isCurrentlyFullscreen) {
      // Enter fullscreen - adjust layout
      console.log('Entering fullscreen - adjusting layout');
      if (palette) {
        palette.style.position = 'fixed';
        palette.style.top = '0';
        palette.style.left = '0';
        palette.style.width = '250px';
        palette.style.height = '100vh';
        palette.style.zIndex = '10001';
        palette.style.background = '#f8f9fa';
        palette.style.borderRight = '1px solid #ddd';
        console.log('Palette styles applied');
      }
      if (canvas) {
        canvas.style.marginLeft = '250px';
        canvas.style.height = '100vh';
        console.log('Canvas styles applied');
      }
    } else {
      // Exit fullscreen - restore original layout
      console.log('Exiting fullscreen - restoring layout');
      if (palette) {
        palette.style.position = '';
        palette.style.top = '';
        palette.style.left = '';
        palette.style.width = '';
        palette.style.height = '';
        palette.style.zIndex = '';
        palette.style.background = '';
        palette.style.borderRight = '';
        console.log('Palette styles restored');
      }
      if (canvas) {
        canvas.style.marginLeft = '';
        canvas.style.height = '';
        console.log('Canvas styles restored');
      }
    }
  };

  // Add fullscreen event listener
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Search-based element palette
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredElements, setFilteredElements] = useState([]);
  
  // BPMN elements database
  const bpmnElements = [
    // Events
    { id: 'bpmn:StartEvent', name: 'Start Event', category: 'Events', icon: '⭕' },
    { id: 'bpmn:EndEvent', name: 'End Event', category: 'Events', icon: '⭕' },
    { id: 'bpmn:IntermediateEvent', name: 'Intermediate Event', category: 'Events', icon: '⭕' },
    
    // Boundary Events
    { id: 'bpmn:BoundaryEvent', name: 'Escalation Boundary Event', category: 'Boundary Events', icon: '⭕', type: 'escalation' },
    { id: 'bpmn:BoundaryEvent', name: 'Conditional Boundary Event', category: 'Boundary Events', icon: '⭕', type: 'conditional' },
    { id: 'bpmn:BoundaryEvent', name: 'Signal Boundary Event', category: 'Boundary Events', icon: '⭕', type: 'signal' },
    { id: 'bpmn:BoundaryEvent', name: 'Timer Boundary Event', category: 'Boundary Events', icon: '⭕', type: 'timer' },
    { id: 'bpmn:BoundaryEvent', name: 'Error Boundary Event', category: 'Boundary Events', icon: '⭕', type: 'error' },
    { id: 'bpmn:BoundaryEvent', name: 'Message Boundary Event', category: 'Boundary Events', icon: '⭕', type: 'message' },
    
    // Tasks
    { id: 'bpmn:UserTask', name: 'User Task', category: 'Tasks', icon: '👤' },
    { id: 'bpmn:ServiceTask', name: 'Service Task', category: 'Tasks', icon: '⚙️' },
    { id: 'bpmn:ScriptTask', name: 'Script Task', category: 'Tasks', icon: '📝' },
    { id: 'bpmn:ManualTask', name: 'Manual Task', category: 'Tasks', icon: '✋' },
    { id: 'bpmn:SendTask', name: 'Send Task', category: 'Tasks', icon: '📤' },
    { id: 'bpmn:ReceiveTask', name: 'Receive Task', category: 'Tasks', icon: '📥' },
    { id: 'bpmn:BusinessRuleTask', name: 'Business Rule Task', category: 'Tasks', icon: '📋' },
    
    // Gateways
    { id: 'bpmn:ExclusiveGateway', name: 'Exclusive Gateway', category: 'Gateways', icon: '◇' },
    { id: 'bpmn:ParallelGateway', name: 'Parallel Gateway', category: 'Gateways', icon: '◈' },
    { id: 'bpmn:InclusiveGateway', name: 'Inclusive Gateway', category: 'Gateways', icon: '⬡' },
    { id: 'bpmn:ComplexGateway', name: 'Complex Gateway', category: 'Gateways', icon: '❖' },
    { id: 'bpmn:EventBasedGateway', name: 'Event Based Gateway', category: 'Gateways', icon: '⬢' },
    
    // Sub Processes
    { id: 'bpmn:SubProcess', name: 'Sub Process', category: 'Sub Processes', icon: '📦' },
    { id: 'bpmn:CallActivity', name: 'Call Activity', category: 'Sub Processes', icon: '🔄' },
    
    // Data Elements
    { id: 'bpmn:DataObjectReference', name: 'Data Object Reference', category: 'Data', icon: '📄' },
    { id: 'bpmn:DataStoreReference', name: 'Data Store Reference', category: 'Data', icon: '💾' },
    
    // Participants/Collaboration
    { id: 'bpmn:Participant', name: 'Expanded Pool/Participant', category: 'Participants', icon: '🏊', expanded: true },
    { id: 'bpmn:Participant', name: 'Empty Pool/Participant', category: 'Participants', icon: '🏊', expanded: false },
    
    // Events (Advanced)
    { id: 'bpmn:IntermediateCatchEvent', name: 'Timer Intermediate Event', category: 'Events', icon: '⏰', type: 'timer' },
    { id: 'bpmn:IntermediateCatchEvent', name: 'Signal Intermediate Event', category: 'Events', icon: '📡', type: 'signal' },
    { id: 'bpmn:IntermediateCatchEvent', name: 'Message Intermediate Event', category: 'Events', icon: '📧', type: 'message' },
    { id: 'bpmn:IntermediateCatchEvent', name: 'Error Intermediate Event', category: 'Events', icon: '❌', type: 'error' },
    
    // Artifacts
    { id: 'bpmn:TextAnnotation', name: 'Text Annotation', category: 'Artifacts', icon: '📝' },
    { id: 'bpmn:Association', name: 'Association', category: 'Artifacts', icon: '↔️' },
    { id: 'bpmn:Group', name: 'Group', category: 'Artifacts', icon: '📂' }
  ];

  // Filter elements based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredElements(bpmnElements);
    } else {
      const filtered = bpmnElements.filter(element => 
        element.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        element.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredElements(filtered);
    }
  }, [searchTerm]);

  // Add element function
  const addSearchElement = (element) => {
    console.log('addSearchElement called with:', element);
    
    if (!modelerRef.current) {
      console.error('Modeler not available');
      return;
    }

    try {
      const modeler = modelerRef.current;
      const elementFactory = modeler.get('elementFactory');
      const modeling = modeler.get('modeling');
      const moddle = modeler.get('moddle');
      const canvas = modeler.get('canvas');
      
      console.log('Modeler services available:', {
        elementFactory: !!elementFactory,
        modeling: !!modeling,
        moddle: !!moddle,
        canvas: !!canvas
      });
      
      // Get the root element
      const rootElement = canvas.getRootElement();
      console.log('Root element:', rootElement);
      
      // Calculate position (center of viewport with some offset)
      const viewbox = canvas.viewbox();
      const centerX = -viewbox.x + viewbox.width / 2;
      const centerY = -viewbox.y + viewbox.height / 2;
      
      // Add some randomness to prevent exact overlap
      const randomOffset = () => (Math.random() - 0.5) * 100;
      
      // Special handling for boundary events - they need to be attached to a task
      if (element.id === 'bpmn:BoundaryEvent') {
        // Find a task to attach the boundary event to
        const allElements = canvas.getRootElement().children;
        const taskElement = allElements.find(el => 
          el.type === 'bpmn:UserTask' || 
          el.type === 'bpmn:ServiceTask' || 
          el.type === 'bpmn:ScriptTask' ||
          el.type === 'bpmn:Task'
        );
        
        if (!taskElement) {
          console.warn('No task found to attach boundary event. Creating a User Task first.');
          // Create a simple task first
          const taskBusinessObject = moddle.create('bpmn:UserTask', {
            id: `bpmn_UserTask_${Date.now()}`,
            name: 'Task with Boundary Event'
          });
          
          const taskConfig = {
            id: taskBusinessObject.id,
            type: 'bpmn:UserTask',
            businessObject: taskBusinessObject,
            x: centerX + randomOffset(),
            y: centerY + randomOffset(),
            width: 100,
            height: 80
          };
          
          const taskElement = elementFactory.createShape(taskConfig);
          canvas.addShape(taskElement, rootElement);
          
          // Now create the boundary event attached to this task
          const boundaryBusinessObject = moddle.create('bpmn:BoundaryEvent', {
            id: `${element.id.replace(':', '_')}_${Date.now()}`,
            name: element.name,
            cancelActivity: element.type !== 'signal'
          });
          
          // Add event definition
          let eventDefinition;
          switch (element.type) {
            case 'timer':
              eventDefinition = moddle.create('bpmn:TimerEventDefinition');
              break;
            case 'signal':
              eventDefinition = moddle.create('bpmn:SignalEventDefinition');
              break;
            case 'message':
              eventDefinition = moddle.create('bpmn:MessageEventDefinition');
              break;
            case 'error':
              eventDefinition = moddle.create('bpmn:ErrorEventDefinition');
              break;
            case 'escalation':
              eventDefinition = moddle.create('bpmn:EscalationEventDefinition');
              break;
            case 'conditional':
              eventDefinition = moddle.create('bpmn:ConditionalEventDefinition');
              break;
            default:
              eventDefinition = moddle.create('bpmn:TimerEventDefinition');
          }
          boundaryBusinessObject.eventDefinitions = [eventDefinition];
          
          const boundaryConfig = {
            id: boundaryBusinessObject.id,
            type: element.id,
            businessObject: boundaryBusinessObject,
            x: taskElement.x + taskElement.width - 18, // Attach to right edge
            y: taskElement.y - 18, // Attach to top edge
            width: 36,
            height: 36,
            host: taskElement // Attach to the task
          };
          
          const boundaryElement = elementFactory.createShape(boundaryConfig);
          canvas.addShape(boundaryElement, taskElement);
          
          // Select the boundary event
          const selection = modeler.get('selection');
          selection.select(boundaryElement);
          
          console.log(`✅ Added ${element.name} attached to task`);
          return;
        }
        
        console.log('Found task to attach boundary event:', taskElement.id);
        // ... rest of boundary event logic would go here
      }
      
      // Create the business object using moddle
      const businessObject = moddle.create(element.id, {
        id: `${element.id.replace(':', '_')}_${Date.now()}`,
        name: element.name
      });

      console.log('Created business object:', businessObject);

      // Add specific properties for boundary events (if not handled above)
      if (element.id === 'bpmn:BoundaryEvent' && element.type) {
        let eventDefinition;
        switch (element.type) {
          case 'timer':
            eventDefinition = moddle.create('bpmn:TimerEventDefinition');
            break;
          case 'signal':
            eventDefinition = moddle.create('bpmn:SignalEventDefinition');
            break;
          case 'message':
            eventDefinition = moddle.create('bpmn:MessageEventDefinition');
            break;
          case 'error':
            eventDefinition = moddle.create('bpmn:ErrorEventDefinition');
            break;
          case 'escalation':
            eventDefinition = moddle.create('bpmn:EscalationEventDefinition');
            break;
          case 'conditional':
            eventDefinition = moddle.create('bpmn:ConditionalEventDefinition');
            break;
          default:
            eventDefinition = moddle.create('bpmn:TimerEventDefinition');
        }
        businessObject.eventDefinitions = [eventDefinition];
        businessObject.cancelActivity = element.type !== 'signal'; // Non-interrupting for signal
      }

      // Add specific properties for intermediate events
      if (element.id === 'bpmn:IntermediateCatchEvent' && element.type) {
        let eventDefinition;
        switch (element.type) {
          case 'timer':
            eventDefinition = moddle.create('bpmn:TimerEventDefinition');
            break;
          case 'signal':
            eventDefinition = moddle.create('bpmn:SignalEventDefinition');
            break;
          case 'message':
            eventDefinition = moddle.create('bpmn:MessageEventDefinition');
            break;
          case 'error':
            eventDefinition = moddle.create('bpmn:ErrorEventDefinition');
            break;
          case 'escalation':
            eventDefinition = moddle.create('bpmn:EscalationEventDefinition');
            break;
          case 'conditional':
            eventDefinition = moddle.create('bpmn:ConditionalEventDefinition');
            break;
          default:
            eventDefinition = moddle.create('bpmn:TimerEventDefinition');
        }
        businessObject.eventDefinitions = [eventDefinition];
      }

      // Add specific properties for participants
      if (element.id === 'bpmn:Participant') {
        if (element.expanded) {
          const process = moddle.create('bpmn:Process');
          businessObject.processRef = process;
        }
      }
      
      const elementConfig = {
        id: businessObject.id,
        type: element.id,
        businessObject: businessObject,
        x: centerX + randomOffset(),
        y: centerY + randomOffset(),
        width: getElementWidth(element),
        height: getElementHeight(element)
      };

      console.log('Element config:', elementConfig);

      // Create the shape using elementFactory
      const createdElement = elementFactory.createShape(elementConfig);
      
      console.log('Created element:', createdElement);
      
      // Add the element to the canvas directly (avoiding the ordering provider issue)
      canvas.addShape(createdElement, rootElement);
      
      // Select the newly created element
      const selection = modeler.get('selection');
      selection.select(createdElement);
      
      console.log(`✅ Added ${element.name} to diagram`);
      
    } catch (error) {
      console.error('❌ Error adding element:', error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  // Helper functions for element dimensions
  const getElementWidth = (element) => {
    const widths = {
      'bpmn:StartEvent': 36, 'bpmn:EndEvent': 36, 'bpmn:IntermediateEvent': 36,
      'bpmn:BoundaryEvent': 36, 'bpmn:IntermediateCatchEvent': 36,
      'bpmn:UserTask': 100, 'bpmn:ServiceTask': 100, 'bpmn:ScriptTask': 100,
      'bpmn:ManualTask': 100, 'bpmn:SendTask': 100, 'bpmn:ReceiveTask': 100,
      'bpmn:BusinessRuleTask': 100,
      'bpmn:ExclusiveGateway': 50, 'bpmn:ParallelGateway': 50,
      'bpmn:InclusiveGateway': 50, 'bpmn:ComplexGateway': 50, 'bpmn:EventBasedGateway': 50,
      'bpmn:SubProcess': 120, 'bpmn:CallActivity': 100,
      'bpmn:DataObjectReference': 36, 'bpmn:DataStoreReference': 50,
      'bpmn:Participant': 400, 'bpmn:TextAnnotation': 100, 'bpmn:Group': 100
    };
    return widths[element.id] || 100;
  };

  const getElementHeight = (element) => {
    const heights = {
      'bpmn:StartEvent': 36, 'bpmn:EndEvent': 36, 'bpmn:IntermediateEvent': 36,
      'bpmn:BoundaryEvent': 36, 'bpmn:IntermediateCatchEvent': 36,
      'bpmn:UserTask': 80, 'bpmn:ServiceTask': 80, 'bpmn:ScriptTask': 80,
      'bpmn:ManualTask': 80, 'bpmn:SendTask': 80, 'bpmn:ReceiveTask': 80,
      'bpmn:BusinessRuleTask': 80,
      'bpmn:ExclusiveGateway': 50, 'bpmn:ParallelGateway': 50,
      'bpmn:InclusiveGateway': 50, 'bpmn:ComplexGateway': 50, 'bpmn:EventBasedGateway': 50,
      'bpmn:SubProcess': 80, 'bpmn:CallActivity': 80,
      'bpmn:DataObjectReference': 46, 'bpmn:DataStoreReference': 50,
      'bpmn:Participant': 200, 'bpmn:TextAnnotation': 50, 'bpmn:Group': 100
    };
    return heights[element.id] || 80;
  };

  // Group filtered elements by category
  const groupedElements = filteredElements.reduce((groups, element) => {
    if (!groups[element.category]) {
      groups[element.category] = [];
    }
    groups[element.category].push(element);
    return groups;
  }, {});

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#c62828' }}>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div ref={mainContainerRef} style={{ 
      display: 'flex', 
      height: '600px', 
      border: '1px solid #ddd',
      overflow: 'hidden'
    }}>
      {/* Search-based Element Palette */}
      <div ref={paletteRef} className="search-palette" style={{
        width: '250px',
        borderRight: '1px solid #ddd',
        background: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Search Bar */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid #ddd',
          background: '#fff'
        }}>
          <input
            type="text"
            placeholder="🔍 Search BPMN elements..."
            value={searchTerm}
            onChange={(e) => {
              console.log('Search input changed:', e.target.value);
              setSearchTerm(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Elements List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px'
        }}>
          {Object.entries(groupedElements).map(([category, elements]) => (
            <div key={category} style={{ marginBottom: '16px' }}>
              {/* Category Header */}
              <div style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#666',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '4px 8px',
                background: '#e9ecef',
                borderRadius: '4px'
              }}>
                {category}
              </div>

              {/* Category Elements */}
              {elements.map((element, index) => (
                <div
                  key={`${element.id}-${index}`}
                  onClick={() => {
                    console.log('Element clicked:', element);
                    addSearchElement(element);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    margin: '2px 0',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '13px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#e3f2fd';
                    e.target.style.borderColor = '#2196F3';
                    e.target.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#fff';
                    e.target.style.borderColor = '#ddd';
                    e.target.style.transform = 'translateX(0)';
                  }}
                >
                  <span style={{ fontSize: '16px', marginRight: '8px' }}>
                    {element.icon}
                  </span>
                  <span style={{ flex: 1, color: '#333' }}>
                    {element.name}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div 
        ref={editorContainerRef}
        className="bpmn-editor-container main-canvas"
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0,
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
          }}
        >
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
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<span class="logo-fallback">🏢 LOGO</span>';
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
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
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
        minHeight: 0,
        overflow: 'hidden'
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
