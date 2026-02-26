// BPMN XML validation and cleaning utilities

export const validateAndCleanBpmnXml = (xml) => {
  if (!xml || typeof xml !== 'string') {
    throw new Error('Invalid XML: Must be a string');
  }

  // Remove common issues that cause SVG matrix errors
  let cleanXml = xml
    .replace(/<[\s\S]*?[^>]*>/g, '') // Remove comments
    .replace(/&nbsp;/g, ' ') // Fix non-breaking spaces
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (match, code) => String.fromCharCode(parseInt(code, 16)));

  // Fix common SVG issues that cause matrix errors
  cleanXml = cleanXml
    // Fix invalid transform values
    .replace(/transform\s*=\s*matrix\([^)]+\)/gi, (match, matrix) => {
      try {
        // Clean the matrix values - remove non-finite values
        const cleanMatrix = matrix.replace(/[^0-9.,\s-]+/g, '0');
        return `transform=${cleanMatrix}`;
      } catch (e) {
        console.warn('Failed to clean matrix:', e);
        return '';
      }
    })
    // Fix invalid scale values
    .replace(/scale\([^)]+\)/gi, (match, scale) => {
      try {
        // Clean scale values - replace non-finite values
        const cleanScale = scale.replace(/[^0-9.,\s-]+/g, '1');
        return `scale=${cleanScale}`;
      } catch (e) {
        console.warn('Failed to clean scale:', e);
        return '';
      }
    })
    // Fix invalid translate values
    .replace(/translate\([^)]+\)/gi, (match, translate) => {
      try {
        // Clean translate values - replace non-finite values
        const cleanTranslate = translate.replace(/[^0-9.,\s-]+/g, '0');
        return `translate=${cleanTranslate}`;
      } catch (e) {
        console.warn('Failed to clean translate:', e);
        return '';
      }
    });

  // Validate basic BPMN structure
  if (!cleanXml.includes('<bpmn:definitions')) {
    throw new Error('Invalid BPMN: Missing <bpmn:definitions> tag');
  }
  
  if (!cleanXml.includes('</bpmn:definitions>')) {
    throw new Error('Invalid BPMN: Missing closing </bpmn:definitions> tag');
  }

  if (!cleanXml.includes('<bpmn:process>')) {
    throw new Error('Invalid BPMN: Missing <bpmn:process> tag');
  }

  // Check for common invalid characters that might cause parsing issues
  const invalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  if (invalidChars.test(cleanXml)) {
    console.warn('XML contains control characters, attempting to clean...');
    cleanXml = cleanXml.replace(invalidChars, '');
  }

  return cleanXml;
};

export const createMinimalBpmnXml = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <bpmn:userTask id="Task_1" name="Sample Task"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1"/>
    <bpmn:endEvent id="EndEvent_1" name="End"/>
  </bpmn:process>
</bpmn:definitions>`;
};

export const isValidBpmnXml = (xml) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    return doc.getElementsByTagName('bpmn:definitions').length > 0;
  } catch (e) {
    return false;
  }
};
