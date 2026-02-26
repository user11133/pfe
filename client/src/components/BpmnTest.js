import React, { useState, useEffect } from 'react';

const BpmnTest = ({ processDefinitionId }) => {
  const [xmlData, setXmlData] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!processDefinitionId) return;

    const testXml = async () => {
      setLoading(true);
      setError('');
      
      try {
        console.log('Testing BPMN XML fetch for:', processDefinitionId);
        const response = await fetch(`/api/processes/${processDefinitionId}/xml`);
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.text();
        console.log('Raw XML data length:', data.length);
        console.log('First 500 chars:', data.substring(0, 500));
        
        if (!data || data.trim().length === 0) {
          throw new Error('Empty XML response');
        }
        
        setXmlData(data);
        
        // Basic XML validation
        if (!data.includes('<bpmn:definitions')) {
          throw new Error('Invalid BPMN XML: Missing <bpmn:definitions> tag');
        }
        
        if (!data.includes('</bpmn:definitions>')) {
          throw new error('Invalid BPMN XML: Missing closing </bpmn:definitions> tag');
        }
        
        console.log('✅ XML appears to be valid BPMN format');
        
      } catch (err) {
        console.error('❌ Test failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    testXml();
  }, [processDefinitionId]);

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', margin: '20px' }}>
      <h3>BPMN XML Test</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>Process ID:</strong> {processDefinitionId || 'None'}
      </div>
      
      {loading && (
        <div>Loading...</div>
      )}
      
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {xmlData && !error && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <strong>✅ XML Length:</strong> {xmlData.length} characters
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <strong>XML Preview:</strong>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              {xmlData.substring(0, 1000)}
            </pre>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <strong>Validation:</strong> Basic BPMN structure appears valid
          </div>
        </div>
      )}
    </div>
  );
};

export default BpmnTest;
