const fs = require('fs');
const axios = require('axios');

async function deployProcess() {
  try {
    const bpmnXml = fs.readFileSync('./demo-process.bpmn', 'utf8');
    
    // Create form data manually
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('deployment-name', 'RiskAssessment');
    formData.append('deployment-source', 'GRC-BPM-Platform');
    formData.append('data', bpmnXml, {
      filename: 'risk-assessment.bpmn',
      contentType: 'application/xml'
    });

    const response = await axios.post(
      'http://localhost:9090/engine-rest/deployment/create',
      formData,
      {
        headers: formData.getHeaders()
      }
    );

    console.log('Process deployed successfully!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error deploying process:', error.message);
  }
}

deployProcess();
