import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import OrdersPage from './pages/OrdersPage';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';
import CartSidebar from './components/CartSidebar';
import ChatWidget from './components/ChatWidget';
import './styles.css';

// ─── Contenu principal (après connexion) ──────────────────
function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode]     = useState('login');   // 'login' ou 'register'
  const [currentPage, setCurrentPage] = useState('home');  // page active
  const [showCheckout, setShowCheckout] = useState(false); // afficher modal commande

  // Pendant le chargement (vérification du token)
  if (loading) {
    return (
      <div className="full-loader">
        <div className="full-loader__inner">
          <span className="full-loader__logo">✦</span>
          <span className="spinner" />
        </div>
      </div>
    );
  }

  // Si pas connecté → afficher Login ou Register
  if (!user) {
    return authMode === 'login'
      ? <LoginPage    onSwitch={() => setAuthMode('register')} />
      : <RegisterPage onSwitch={() => setAuthMode('login')} />;
  }

  // Si connecté → afficher le site
  return (
    <div className="app-wrapper">

      {/* Barre de navigation en haut */}
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />

      {/* Contenu de la page selon la navigation */}
      <main className="app-main">
        {currentPage === 'home'   && <HomePage />}
        {currentPage === 'orders' && (
          <OrdersPage
            showCheckout={showCheckout}
            onCheckoutDone={() => setShowCheckout(false)}
          />
        )}
        {currentPage === 'admin' && user.is_staff && <AdminDashboard />}
      </main>

      {/* Panier (sidebar droite, visible partout) */}
      <CartSidebar
        onCheckout={() => {
          setCurrentPage('orders');
          setShowCheckout(true);
        }}
      />

      {/* Chat widget flottant (visible seulement pour les clients) */}
      {!user.is_staff && <ChatWidget />}

    </div>
  );
}

// ─── App racine — enveloppe tout avec les Contexts ────────
export default function App() {
  return (
    <AuthProvider>   {/* donne accès à user, login, logout partout */}
      <CartProvider> {/* donne accès au panier partout */}
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}
