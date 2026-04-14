import { useState } from 'react';
import Login from './Login';

function App() {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (phoneNumber) => {
    setUser(phoneNumber);
  };

  return (
    <div>
      {!user ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
          <h1>Welcome, {user}! 🎉</h1>
          <p>You are officially connected to the live Render backend.</p>
        </div>
      )}
    </div>
  );
}

export default App;
