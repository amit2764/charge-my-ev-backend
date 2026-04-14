import { useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (phoneNumber) => {
    setUser(phoneNumber);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div>
      {!user ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
