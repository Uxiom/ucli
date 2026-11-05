import React from 'react';

export default function BadComponent() {
  const handleClick = () => {
    console.log('Clicked');
  };

  return (
    <div style={{ padding: '13px 17px', backgroundColor: '#333333' }}>
      <h1 style={{ color: '#ff4500' }}>Welcome to Uxiom Dashboard</h1>
      
      {/* Skipped heading level from h1 to h4 */}
      <h4>Quick Statistics</h4>

      {/* Missing alt attribute on image */}
      <img src="/logo.png" />

      {/* Clickable div without role="button" or tabIndex */}
      <div 
        onClick={handleClick} 
        style={{ 
          margin: '11px 0px', 
          backgroundColor: '#ff4500', 
          color: '#ffffff' 
        }}
      >
        Submit Action
      </div>

      {/* Form input without label or aria-label */}
      <input type="text" placeholder="Enter username..." />
    </div>
  );
}
