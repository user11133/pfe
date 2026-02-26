// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';

const BpmnViewer = ({ processDefinitionId, processName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diagramUrl, setDiagramUrl] = useState(null);
  const [processInfo, setProcessInfo] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const downloadDiagram = async () => {
    try {
      const response = await fetch(`/api/processes/${processDefinitionId}/diagram`);
      
      if (response.ok && response.status !== 204) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${processName || 'process'}-diagram.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('No diagram available for download');
      }
    } catch (error) {
      console.error('Error downloading diagram:', error);
      alert('Failed to download diagram');
    }
  };

  useEffect(() => {
    if (!processDefinitionId) return;

    // Fetch heatmap data
    const fetchHeatmap = async () => {
      try {
        const response = await fetch(`/api/intelligence/heatmap/${processDefinitionId}`);
        const data = await response.json();
        if (data.heatmap && data.heatmap.length > 0) {
          setHeatmapData(data.heatmap);
        }
      } catch (err) {
        console.error('Error fetching heatmap:', err);
      }
    };

    fetchHeatmap();
  }, [processDefinitionId]);

  useEffect(() => {
    if (!processDefinitionId) return;

    const loadDiagram = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Loading diagram for:', processDefinitionId);

        const svgResponse = await fetch(`/api/processes/${processDefinitionId}/diagram`);
        
        console.log('Response status:', svgResponse.status);
        const contentType = svgResponse.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        if (!svgResponse.ok || svgResponse.status === 204) {
          console.log('Bad response status:', svgResponse.status);
          const processesResponse = await fetch('/api/processes');
          const processes = await processesResponse.json();
          const currentProcess = processes.find(p => p.id === processDefinitionId);
          
          if (currentProcess) {
            setProcessInfo(currentProcess);
            setError('No BPMN diagram available in Camunda');
          } else {
            setError('Process not found');
          }
          setLoading(false);
          return;
        }

        const responseText = await svgResponse.text();
        console.log('Response text length:', responseText.length);
        
        if (!responseText || responseText.length === 0) {
          console.log('Empty response');
          const processesResponse = await fetch('/api/processes');
          const processes = await processesResponse.json();
          const currentProcess = processes.find(p => p.id === processDefinitionId);
          
          if (currentProcess) {
            setProcessInfo(currentProcess);
            setError('No BPMN diagram available in Camunda');
          } else {
            setError('Process not found');
          }
          setLoading(false);
          return;
        }

        console.log('Content has data, processing...');
        
        if (contentType && contentType.includes('application/xml')) {
          console.log('Received BPMN XML');
          
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(responseText, 'text/xml');
          
          // Find shapes and edges
          let shapes = [];
          let edges = [];
          
          const allElements = xmlDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const tagName = allElements[i].tagName.toLowerCase();
            if (tagName.includes('bpmnshape') || (allElements[i].id && allElements[i].id.includes('BPMNShape'))) {
              shapes.push(allElements[i]);
            }
            if (tagName.includes('bpmnedge') || (allElements[i].id && allElements[i].id.includes('BPMNEdge'))) {
              edges.push(allElements[i]);
            }
          }
          
          console.log(`Found ${shapes.length} shapes and ${edges.length} edges`);
          
          if (shapes.length > 0) {
            // Calculate bounds for viewBox
            let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
            
            // First pass: calculate bounds
            shapes.forEach((shape) => {
              const shapeChildren = shape.getElementsByTagName('*');
              let bounds = null;
              for (let i = 0; i < shapeChildren.length; i++) {
                if (shapeChildren[i].tagName.toLowerCase().includes('bounds')) {
                  bounds = shapeChildren[i];
                  break;
                }
              }
              
              if (bounds) {
                const x = parseFloat(bounds.getAttribute('x')) || 0;
                const y = parseFloat(bounds.getAttribute('y')) || 0;
                const width = parseFloat(bounds.getAttribute('width')) || 100;
                const height = parseFloat(bounds.getAttribute('height')) || 80;
                
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + width);
                maxY = Math.max(maxY, y + height);
              }
            });
            
            // Add padding
            minX = Math.max(0, minX - 50);
            minY = Math.max(0, minY - 50);
            maxX = maxX + 50;
            maxY = maxY + 50;
            
            const viewBoxWidth = maxX - minX;
            const viewBoxHeight = maxY - minY;
            
            let svgContent = `<svg width="100%" height="600" viewBox="${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;
            
            // Add a visible background
            svgContent += `<rect x="${minX}" y="${minY}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="#ffffff" stroke="#ccc" stroke-width="1"/>`;
            
            // Debug: log first shape coordinates
            const firstShape = shapes[0];
            let firstBounds = null;
            // Find bounds by checking all child elements
            const children = firstShape.getElementsByTagName('*');
            for (let i = 0; i < children.length; i++) {
              if (children[i].tagName.toLowerCase().includes('bounds')) {
                firstBounds = children[i];
                break;
              }
            }
            if (firstBounds) {
              console.log('First shape bounds:', {
                x: firstBounds.getAttribute('x'),
                y: firstBounds.getAttribute('y'),
                width: firstBounds.getAttribute('width'),
                height: firstBounds.getAttribute('height')
              });
            } else {
              console.log('No bounds found for first shape, shape XML:', firstShape.outerHTML.substring(0, 300));
            }
            
            // Add shapes
            shapes.forEach((shape, index) => {
              // Find bounds by checking all child elements
              let bounds = null;
              const shapeChildren = shape.getElementsByTagName('*');
              for (let i = 0; i < shapeChildren.length; i++) {
                if (shapeChildren[i].tagName.toLowerCase().includes('bounds')) {
                  bounds = shapeChildren[i];
                  break;
                }
              }
              
              if (bounds) {
                const x = parseFloat(bounds.getAttribute('x')) || 0;
                const y = parseFloat(bounds.getAttribute('y')) || 0;
                const width = parseFloat(bounds.getAttribute('width')) || 100;
                const height = parseFloat(bounds.getAttribute('height')) || 80;
                
                if (index === 0) console.log(`Shape ${index}: x=${x}, y=${y}, w=${width}, h=${height}`);
                
                const bpmnElement = shape.getAttribute('bpmnElement');
                let fillColor = '#f0f0f0';
                let strokeColor = '#333';
                let text = '';
                
                if (bpmnElement && bpmnElement.includes('StartEvent')) {
                  fillColor = '#4CAF50';
                  text = 'Start';
                } else if (bpmnElement && bpmnElement.includes('EndEvent')) {
                  fillColor = '#f44336';
                  text = 'End';
                } else if (bpmnElement && bpmnElement.includes('Task')) {
                  fillColor = '#2196F3';
                  const taskElement = xmlDoc.querySelector(`[id="${bpmnElement}"]`);
                  if (taskElement) {
                    const name = taskElement.getAttribute('name');
                    if (name) text = name;
                  }
                }
                
                svgContent += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" rx="5"/>`;
                
                if (text) {
                  svgContent += `<text x="${x + width/2}" y="${y + height/2}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="12" fill="white">${text}</text>`;
                }
              }
            });
            
            // Add edges
            edges.forEach(edge => {
              // Find waypoints by checking all child elements
              const edgeChildren = edge.getElementsByTagName('*');
              const waypoints = [];
              for (let i = 0; i < edgeChildren.length; i++) {
                if (edgeChildren[i].tagName.toLowerCase().includes('waypoint')) {
                  waypoints.push(edgeChildren[i]);
                }
              }
              
              if (waypoints.length >= 2) {
                const x1 = parseFloat(waypoints[0].getAttribute('x'));
                const y1 = parseFloat(waypoints[0].getAttribute('y'));
                const x2 = parseFloat(waypoints[waypoints.length - 1].getAttribute('x'));
                const y2 = parseFloat(waypoints[waypoints.length - 1].getAttribute('y'));
                
                svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>`;
              }
            });
            
            svgContent += `
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#333"/>
                </marker>
              </defs>
            </svg>`;
            
            console.log('Generated SVG:', svgContent.substring(0, 200) + '...');
            
            // Create a blob URL for the SVG instead of base64
            const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
            const svgUrl = URL.createObjectURL(svgBlob);
            console.log('Setting diagramUrl:', svgUrl);
            setDiagramUrl(svgUrl);
          } else {
            console.log('No diagram shapes found in BPMN XML');
            setError('No diagram shapes found in BPMN');
          }
        } else if (contentType && contentType.includes('application/json')) {
          const jsonResponse = JSON.parse(responseText);
          console.log('JSON Response:', jsonResponse);
          
          if (jsonResponse.data) {
            const imageUrl = `data:image/svg+xml;base64,${jsonResponse.data}`;
            setDiagramUrl(imageUrl);
          } else {
            setError('No diagram data available');
          }
        } else {
          const svgBlob = new Blob([responseText], { type: 'image/svg+xml' });
          const svgUrl = URL.createObjectURL(svgBlob);
          setDiagramUrl(svgUrl);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading BPMN diagram:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadDiagram();

    return () => {
      if (diagramUrl) {
        URL.revokeObjectURL(diagramUrl);
      }
    };
  }, [processDefinitionId, diagramUrl]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div>Loading BPMN diagram...</div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
          Make sure Camunda is running on port 9090
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '4px', margin: '20px 0' }}>
      <div style={{ 
        background: '#f5f5f5', 
        padding: '10px', 
        borderBottom: '1px solid #ccc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h4 style={{ margin: 0 }}>{processName || 'BPMN Diagram'}</h4>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Process ID: {processDefinitionId}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {heatmapData && (
            <button 
              onClick={() => setShowHeatmap(!showHeatmap)}
              style={{
                padding: '5px 10px',
                background: showHeatmap ? '#FF5722' : '#9C27B0',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
            </button>
          )}
          <button 
            onClick={downloadDiagram}
            style={{
              padding: '5px 10px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Download SVG
          </button>
        </div>
      </div>
      <div style={{ minHeight: '500px', overflow: 'auto', background: 'white', padding: '20px', border: '1px solid #eee', position: 'relative' }}>
        {/* Heatmap Legend */}
        {showHeatmap && heatmapData && (
          <div style={{
            position: 'absolute',
            top: '30px',
            right: '30px',
            background: 'white',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 100,
            minWidth: '200px'
          }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Bottleneck Heatmap</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '15px', height: '15px', background: '#4CAF50', borderRadius: '3px' }} />
                <span style={{ fontSize: '12px' }}>Fast (&lt; 1h)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '15px', height: '15px', background: '#FF9800', borderRadius: '3px' }} />
                <span style={{ fontSize: '12px' }}>Moderate (1-6h)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '15px', height: '15px', background: '#F44336', borderRadius: '3px' }} />
                <span style={{ fontSize: '12px' }}>Bottleneck (&gt; 6h)</span>
              </div>
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
              <div style={{ fontSize: '11px', color: '#666' }}>
                Based on {heatmapData.length} task types
              </div>
            </div>
          </div>
        )}

        {/* Heatmap Task List Overlay */}
        {showHeatmap && heatmapData && (
          <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '30px',
            right: '30px',
            background: 'rgba(255,255,255,0.95)',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 100,
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Task Details</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
              {heatmapData.map((item, idx) => (
                <div key={idx} style={{
                  padding: '10px',
                  background: item.color + '20',
                  borderLeft: `4px solid ${item.color}`,
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ color: '#666' }}>
                    {item.avgDurationFormatted || `${item.avgDurationHours.toFixed(1)}h`} avg • {item.executions} runs
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {diagramUrl ? (
          <div style={{ width: '100%', minHeight: '400px' }}>
            <img 
              src={diagramUrl} 
              alt="BPMN Diagram"
              style={{ 
                width: '100%', 
                height: 'auto',
                maxHeight: '600px',
                objectFit: 'contain',
                border: '2px solid #333',
                display: 'block'
              }}
              onError={(e) => {
                console.error('Image failed to load:', e);
                console.log('Failed URL:', diagramUrl);
              }}
              onLoad={() => console.log('Image loaded successfully')}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {error && (
              <div style={{ color: '#ff6b6b', marginBottom: '20px' }}>
                {error}
              </div>
            )}
            
            {processInfo && (
              <div style={{ 
                background: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px',
                textAlign: 'left',
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                <h5 style={{ margin: '0 0 15px 0', color: '#333' }}>
                  Process Information
                </h5>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Name:</strong> {processInfo.name || 'Unnamed Process'}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Key:</strong> {processInfo.key}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Version:</strong> {processInfo.version}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Status:</strong> {processInfo.status}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Running Instances:</strong> {processInfo.instances || 0}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Active Tasks:</strong> {processInfo.activeTasks || 0}
                </div>
                
                <div style={{ 
                  marginTop: '20px', 
                  padding: '20px', 
                  background: 'white', 
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <svg width="400" height="200" viewBox="0 0 400 200">
                    <circle cx="50" cy="100" r="20" fill="#4CAF50" />
                    <text x="50" y="105" textAnchor="middle" fill="white" fontSize="12">Start</text>
                    
                    <rect x="120" y="80" width="80" height="40" fill="#2196F3" rx="5" />
                    <text x="160" y="105" textAnchor="middle" fill="white" fontSize="12">Task 1</text>
                    
                    <rect x="240" y="80" width="80" height="40" fill="#2196F3" rx="5" />
                    <text x="280" y="105" textAnchor="middle" fill="white" fontSize="12">Task 2</text>
                    
                    <rect x="360" y="80" width="80" height="40" fill="#2196F3" rx="5" />
                    <text x="400" y="105" textAnchor="middle" fill="white" fontSize="12">Task 3</text>
                    
                    <circle cx="450" cy="100" r="20" fill="#F44336" />
                    <text x="450" y="105" textAnchor="middle" fill="white" fontSize="12">End</text>
                    
                    <line x1="70" y1="100" x2="120" y2="100" stroke="#333" strokeWidth="2" markerEnd="url(#arrowhead)" />
                    <line x1="200" y1="100" x2="240" y2="100" stroke="#333" strokeWidth="2" markerEnd="url(#arrowhead)" />
                    <line x1="320" y1="100" x2="360" y2="100" stroke="#333" strokeWidth="2" markerEnd="url(#arrowhead)" />
                    <line x1="440" y1="100" x2="430" y2="100" stroke="#333" strokeWidth="2" markerEnd="url(#arrowhead)" />
                    
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
                      </marker>
                    </defs>
                  </svg>
                  
                  <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
                    <strong>Sample BPMN Diagram</strong> - This is a placeholder visualization
                  </div>
                </div>
                
                <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  background: '#e3f2fd', 
                  borderRadius: '4px',
                  fontSize: '14px'
                }}>
                  <strong>Tip:</strong> To see actual BPMN diagrams, deploy processes with proper BPMN files to Camunda. 
                  You can still start and manage instances of this process using the controls above.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BpmnViewer;
