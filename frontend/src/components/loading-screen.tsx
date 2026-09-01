import './loading-screen.css';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <img src="/logo.png" alt="K-Mestre AI" />
      </div>
      <div className="loading-bar">
        <div className="loading-bar-fill"></div>
      </div>
    </div>
  );
}