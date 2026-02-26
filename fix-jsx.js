// Fix the JSX syntax errors in BpmnEditor.js
// This replaces the broken toolbar section

const fixedToolbarSection = `
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
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#6c757d';
              }}
            >
              ← Back to Previous Level
            </button>
          )}
        </div>
`;

console.log('Fixed toolbar section:');
console.log(fixedToolbarSection);
console.log('Copy this section into BpmnEditor.js to replace the broken part');
