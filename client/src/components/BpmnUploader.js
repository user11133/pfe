import React, { useState } from 'react';

const BpmnUploader = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const bpmnFile = files.find(file => 
      file.name.toLowerCase().endsWith('.bpmn') || 
      file.name.toLowerCase().endsWith('.xml')
    );
    
    if (!bpmnFile) {
      setUploadStatus('Please drop a BPMN file (.bpmn or .xml)');
      setTimeout(() => setUploadStatus(''), 3000);
      return;
    }
    
    await uploadFile(bpmnFile);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.bpmn') && !file.name.toLowerCase().endsWith('.xml')) {
      setUploadStatus('Please select a BPMN file (.bpmn or .xml)');
      setTimeout(() => setUploadStatus(''), 3000);
      return;
    }
    
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadStatus(`Uploading ${file.name}...`);
    
    try {
      // Read file as text
      const fileText = await file.text();
      
      // Send as base64 to avoid FormData issues
      const response = await fetch('/api/deploy-process-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'deployment-name': file.name.replace(/\.[^/.]+$/, ''),
          'deployment-source': 'GRC-BPM-Platform-Upload',
          'data': fileText,
          'filename': file.name
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setUploadStatus(`${file.name} deployed successfully!`);
        setTimeout(() => {
          setUploadStatus('');
          if (onUploadSuccess) onUploadSuccess();
        }, 2000);
      } else {
        setUploadStatus(`Failed to deploy: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ 
      border: '2px dashed #ccc', 
      borderRadius: '8px', 
      padding: '40px', 
      textAlign: 'center',
      background: '#f8f9fa',
      margin: '20px 0'
    }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>
        Deploy BPMN Process
      </h3>
      
      <div
        style={{
          border: '2px dashed #007bff',
          borderRadius: '8px',
          padding: '60px 40px',
          background: dragActive ? '#e3f2fd' : 'white',
          transition: 'all 0.3s ease',
          cursor: dragActive ? 'grabbing' : 'grab'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div>
            <div>{uploadStatus}</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '16px', color: '#666' }}>
              Drag & Drop BPMN file here
            </div>
            <div style={{ fontSize: '14px', margin: '20px 0', color: '#999' }}>
              or
            </div>
            <label style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: '#007bff',
              color: 'white',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}>
              Browse Files
              <input
                type="file"
                accept=".bpmn,.xml"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}
      </div>
      
      {uploadStatus && uploadStatus.includes('successfully') && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#d4edda', 
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          {uploadStatus}
        </div>
      )}
      
      {uploadStatus && uploadStatus.includes('Failed') && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#f8d7da', 
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          {uploadStatus}
        </div>
      )}
      
      <div style={{ 
        marginTop: '30px', 
        fontSize: '12px', 
        color: '#666',
        lineHeight: '1.5'
      }}>
        <div><strong>Supported formats:</strong> .bpmn, .xml</div>
        <div><strong>Max file size:</strong> 10MB</div>
        <div><strong>After upload:</strong> Process will be available in Processes tab</div>
      </div>
    </div>
  );
};

export default BpmnUploader;
