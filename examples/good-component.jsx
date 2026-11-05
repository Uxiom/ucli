import React from 'react';

export default function GoodComponent() {
  return (
    <section className="card-container">
      <h1>Welcome to Uxiom Dashboard</h1>
      <h2>Quick Statistics</h2>

      <img src="/logo.png" alt="Uxiom brand logo" />

      <button type="button" className="btn-primary">
        Submit Action
      </button>

      <label htmlFor="username-input">Username</label>
      <input id="username-input" type="text" placeholder="Enter username..." />
    </section>
  );
}
