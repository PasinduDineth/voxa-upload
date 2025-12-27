import React from 'react';
import './PageHeader.css';

function PageHeader({ icon, title, description }) {
  return (
    <div className="page-header">
      <div className="page-header-content">
        <div className="page-icon">{icon}</div>
        <div className="page-text">
          <h2 className="page-title">{title}</h2>
          <p className="page-description">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default PageHeader;
