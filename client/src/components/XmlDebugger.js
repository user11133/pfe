import React, { useState, useEffect } from 'react';

const XmlDebugger = ({ processDefinitionId }) => {
  const [rawXml, setRawXml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!processDefinitionId) return;

    const debugXml = async () => {
      setLoading(true);
      setError('');
      
      try {
        console.log('🔍 Debugging BPMN XML for:', processDefinitionId);
        
        // Try different endpoints to see what's available
        const endpoints = [
          `/api/processes/${processDefinitionId}/xml`,
          `/api/processes/${processDefinitionId}`,
          `/api/process-definition/${processDefinitionId}/xml`,
          `/api/process-definition/${processDefinitionId}`
        ];

        for (const endpoint of endpoints) {
          try {
            console.log(`📡 Trying endpoint: ${endpoint}`);
            const response = await fetch(endpoint);
            
            console.log(`📊 Response status: ${response.status}`);
            console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));
            
            if (response.ok) {
              const data = await response.text();
              console.log(`📄 Data length: ${data.length}`);
              console.log(`📝 First 500 chars:`, data.substring(0, 500));
              
              // Check if it's JSON instead of XML
              if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
                console.log('🔍 Response appears to be JSON, not XML');
                try {
                  const jsonData = JSON.parse(data);
                  console.log('📋 Parsed JSON:', jsonData);
                  
                  // Look for XML in JSON response
                  if (jsonData.xml || jsonData.bpmn20Xml) {
                    const xmlData = jsonData.xml || jsonData.bpmn20Xml;
                    console.log('✅ Found XML in JSON response');
                    setRawXml(xmlData);
                    return;
                  }
                } catch (jsonError) {
                  console.error('❌ Failed to parse JSON:', jsonError);
                }
              } else {
                setRawXml(data);
                return;
              }
            } else {
              console.log(`❌ Endpoint failed: ${response.statusText}`);
            }
          } catch (endpointError) {
            console.error(`❌ Error with ${endpoint}:`, endpointError);
          }
        }
        
        throw new Error('No valid XML found from any endpoint');
        
      } catch (err) {
        console.error('❌ Debug failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    debugXml();
  }, [processDefinitionId]);

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ddd', 
      margin: '20px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3>🔍 BPMN XML Debugger</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>Process ID:</strong> {processDefinitionId || 'None'}
      </div>
      
      {loading && (
        <div>🔄 Debugging...</div>
      )}
      
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}
      
      {rawXml && !error && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <strong>✅ XML Length:</strong> {rawXml.length} characters
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <strong>📄 XML Preview:</strong>
            <pre style={{ 
              background: '#fff', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              maxHeight: '300px',
              overflow: 'auto',
              border: '1px solid #ddd'
            }}>
              {rawXml.substring(0, 1000)}
              {rawXml.length > 1000 && '\n... (truncated)'}
            </pre>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <strong>🔍 Analysis:</strong>
            <ul style={{ marginLeft: '20px' }}>
              <li>Contains &lt;bpmn:definitions&gt;: {rawXml.includes('<bpmn:definitions') ? '✅ Yes' : '❌ No'}</li>
              <li>Contains &lt;bpmn:process&gt;: {rawXml.includes('<bpmn:process') ? '✅ Yes' : '❌ No'}</li>
              <li>Starts with &lt;?xml: {rawXml.trim().startsWith('<?xml') ? '✅ Yes' : '❌ No'}</li>
              <li>Is JSON format: {rawXml.trim().startsWith('{') || rawXml.trim().startsWith('[') ? '✅ Yes' : '❌ No'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default XmlDebugger;
