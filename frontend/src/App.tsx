
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Room from './Room';

function Home() {
  const navigate = useNavigate();

  const createRoom = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Live Session' })
      });
      const data = await res.json();
      if (data.id) {
        navigate(`/room/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create room', err);
      // Fallback for local dev if backend is down
      const randomId = Math.random().toString(36).substring(7);
      navigate(`/room/${randomId}`);
    }
  };

  return (
    <div className="home-container">
      <div className="hero-card glass-panel">
        <h1 className="hero-title">LiveCollab</h1>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          Real-time, conflict-free collaborative coding built on CRDTs.
        </p>
        <button className="btn-primary" onClick={createRoom}>
          Create New Room
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </Router>
  );
}

export default App;
