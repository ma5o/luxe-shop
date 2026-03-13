import { useState, useEffect, useRef, createContext, useContext } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

/* ═══════════════════════════════════════════════════════════
   API SERVICE
═══════════════════════════════════════════════════════════ */
const BASE = 'http://localhost:8000/api'
const MEDIA_BASE = 'http://localhost:8000'
const imgUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  if (path.startsWith('/')) return `${MEDIA_BASE}${path}`
  return `${MEDIA_BASE}/media/${path}`
}
const getToken = () => localStorage.getItem('access_token')
const authHeaders = () => ({ 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) })
const fileHeaders = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {})

const handleRes = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.detail || 'Une erreur est survenue')
  }
  return res.json()
}

const API = {
  // Auth
  login:       (d) => fetch(`${BASE}/auth/login/`,    { method:'POST', headers: authHeaders(), body: JSON.stringify(d) }).then(handleRes),
  register:    (d) => fetch(`${BASE}/auth/register/`, { method:'POST', headers: authHeaders(), body: JSON.stringify(d) }).then(handleRes),
  me:          ()  => fetch(`${BASE}/auth/me/`,        { headers: authHeaders() }).then(handleRes),
  getUsers:    ()  => fetch(`${BASE}/auth/users/`,     { headers: authHeaders() }).then(handleRes),
  deleteUser:  (id)=> fetch(`${BASE}/auth/users/${id}/delete/`, { method:'DELETE', headers: authHeaders() }).then(handleRes),
  banUser:     (id)=> fetch(`${BASE}/auth/users/${id}/ban/`,    { method:'PATCH',  headers: authHeaders() }).then(handleRes),
  // Shop
  getProducts: (p) => fetch(`${BASE}/shop/products/?${new URLSearchParams(p)}`, { headers: authHeaders() }).then(handleRes),
  getCategories:() => fetch(`${BASE}/shop/categories/`, { headers: authHeaders() }).then(handleRes),
  createOrder: (d) => fetch(`${BASE}/shop/orders/`,     { method:'POST', headers: authHeaders(), body: JSON.stringify(d) }).then(handleRes),
  myOrders:    ()  => fetch(`${BASE}/shop/orders/mine/`,{ headers: authHeaders() }).then(handleRes),
  uploadPayment:(id,fd)=> fetch(`${BASE}/shop/orders/${id}/payment/`, { method:'POST', headers: fileHeaders(), body: fd }).then(handleRes),
  createProduct:(fd)=> fetch(`${BASE}/shop/admin/products/`,    { method:'POST',   headers: fileHeaders(), body: fd }).then(handleRes),
  updateProduct:(id,fd)=>fetch(`${BASE}/shop/admin/products/${id}/`, { method:'PATCH', headers: fileHeaders(), body: fd }).then(handleRes),
  deleteProduct:(id)=> fetch(`${BASE}/shop/admin/products/${id}/`,   { method:'DELETE', headers: authHeaders() }).then(handleRes),
  adminOrders: (s) => fetch(`${BASE}/shop/admin/orders/${s?'?status='+s:''}`, { headers: authHeaders() }).then(handleRes),
  updateOrderStatus:(id,status)=> fetch(`${BASE}/shop/admin/orders/${id}/status/`, { method:'PATCH', headers: authHeaders(), body: JSON.stringify({status}) }).then(handleRes),
  // Chat
  myMessages:       ()  => fetch(`${BASE}/chat/messages/`,          { headers: authHeaders() }).then(handleRes),
  adminRooms:       ()  => fetch(`${BASE}/chat/admin/rooms/`,        { headers: authHeaders() }).then(handleRes),
  adminRoomMessages:(id)=> fetch(`${BASE}/chat/admin/rooms/${id}/`,  { headers: authHeaders() }).then(handleRes),
}

const openWS = (userId = null) =>
  new WebSocket(`ws://localhost:8000/ws/chat/${userId ? userId + '/' : ''}?token=${getToken()}`)

/* ═══════════════════════════════════════════════════════════
   CONTEXTS
═══════════════════════════════════════════════════════════ */
const AuthContext = createContext(null)
const CartContext = createContext(null)

function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (getToken()) {
      API.me().then(setUser).catch(() => localStorage.clear()).finally(() => setLoading(false))
    } else setLoading(false)
  }, [])

  const login    = async (d) => { const r = await API.login(d);    localStorage.setItem('access_token', r.access); setUser(r.user); return r.user }
  const register = async (d) => { const r = await API.register(d); localStorage.setItem('access_token', r.access); setUser(r.user); return r.user }
  const logout   = () => { localStorage.clear(); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}

function CartProvider({ children }) {
  const [cart, setCart]   = useState([])
  const [cartOpen, setCartOpen] = useState(false)

  const addToCart    = (product, qty = 1) => {
    setCart(c => {
      const ex = c.find(i => i.product.id === product.id)
      return ex ? c.map(i => i.product.id === product.id ? { ...i, qty: i.qty + qty } : i) : [...c, { product, qty }]
    })
    setCartOpen(true)
  }
  const removeItem   = (id)      => setCart(c => c.filter(i => i.product.id !== id))
  const updateQty    = (id, qty) => qty <= 0 ? removeItem(id) : setCart(c => c.map(i => i.product.id === id ? { ...i, qty } : i))
  const clearCart    = ()        => setCart([])
  const cartTotal    = cart.reduce((s, i) => s + parseFloat(i.product.price) * i.qty, 0)
  const cartCount    = cart.reduce((s, i) => s + i.qty, 0)

  return (
    <CartContext.Provider value={{ cart, cartOpen, setCartOpen, addToCart, removeItem, updateQty, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  )
}

const useAuth = () => useContext(AuthContext)
const useCart = () => useContext(CartContext)

/* ═══════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
═══════════════════════════════════════════════════════════ */
const Spinner = ({ sm }) => <span className={`spinner ${sm ? 'spinner--sm' : ''}`} />

const Alert = ({ type, msg }) => msg ? <div className={`alert alert--${type}`}>{msg}</div> : null

function InputField({ label, type = 'text', value, onChange, placeholder, required }) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <input className="field__input" type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} />
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   AUTH PAGES  (Login + Register)
═══════════════════════════════════════════════════════════ */
function AuthPages() {
  const { login, register } = useAuth()
  const [mode, setMode]     = useState('login')
  const [form, setForm]     = useState({ username:'', email:'', first_name:'', last_name:'', password:'', password2:'' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { mode === 'login' ? await login(form) : await register(form) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className={`auth-card ${mode === 'register' ? 'auth-card--wide' : ''}`}>
        <div className="auth-brand">
          <span className="auth-logo">✦</span>
          <h1 className="auth-title">LUXE<span>SHOP</span></h1>
          <p className="auth-sub">{mode === 'login' ? 'Connectez-vous pour continuer' : 'Créez votre compte gratuit'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <Alert type="error" msg={error} />

          {mode === 'register' && (
            <div className="field-row">
              <InputField label="Prénom" value={form.first_name} onChange={set('first_name')} placeholder="Jean" />
              <InputField label="Nom"    value={form.last_name}  onChange={set('last_name')}  placeholder="Dupont" />
            </div>
          )}

          <InputField label="Nom d'utilisateur *" value={form.username} onChange={set('username')} placeholder="jean_dupont" required />

          {mode === 'register' && (
            <InputField label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="jean@exemple.com" required />
          )}

          {mode === 'register' ? (
            <div className="field-row">
              <InputField label="Mot de passe *"  type="password" value={form.password}  onChange={set('password')}  placeholder="••••••••" required />
              <InputField label="Confirmer *"     type="password" value={form.password2} onChange={set('password2')} placeholder="••••••••" required />
            </div>
          ) : (
            <InputField label="Mot de passe" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          )}

          <button type="submit" className="btn btn--gold btn--full" disabled={loading}>
            {loading ? <Spinner sm /> : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? "Pas encore de compte ? " : "Déjà un compte ? "}
          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════════════ */
function Navbar({ page, navigate }) {
  const { user, logout }           = useAuth()
  const { cartCount, setCartOpen } = useCart()
  const [menuOpen, setMenuOpen]    = useState(false)

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <button className="navbar__brand" onClick={() => navigate('home')}>
          <span className="navbar__logo">✦</span> LUXE<em>SHOP</em>
        </button>

        <div className={`navbar__links ${menuOpen ? 'navbar__links--open' : ''}`}>
          {[['home','Boutique'], ['orders','Mes commandes']].map(([k, l]) => (
            <button key={k} className={`navbar__link ${page === k ? 'navbar__link--active' : ''}`}
              onClick={() => { navigate(k); setMenuOpen(false) }}>{l}</button>
          ))}
          {user?.is_staff && (
            <button className={`navbar__link navbar__link--admin ${page === 'admin' ? 'navbar__link--active' : ''}`}
              onClick={() => { navigate('admin'); setMenuOpen(false) }}>⚙ Admin</button>
          )}
        </div>

        <div className="navbar__actions">
          <button className="navbar__cart" onClick={() => setCartOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            {cartCount > 0 && <span className="navbar__cart-badge">{cartCount}</span>}
          </button>

          <div className="navbar__user">
            <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <span className="navbar__username">{user?.first_name || user?.username}</span>
            <button className="navbar__logout" onClick={logout} title="Déconnexion">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>

          <button className="navbar__burger" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </nav>
  )
}

/* ═══════════════════════════════════════════════════════════
   CART SIDEBAR
═══════════════════════════════════════════════════════════ */
function CartSidebar({ onCheckout }) {
  const { cart, cartOpen, setCartOpen, removeItem, updateQty, clearCart, cartTotal } = useCart()
  if (!cartOpen) return null

  return (
    <>
      <div className="backdrop" onClick={() => setCartOpen(false)} />
      <aside className="cart-sidebar">
        <div className="cart-sidebar__head">
          <h2>Panier <span className="badge">{cart.length}</span></h2>
          <button className="btn-icon" onClick={() => setCartOpen(false)}>✕</button>
        </div>

        {cart.length === 0 ? (
          <div className="cart-sidebar__empty">
            <span>🛒</span><p>Votre panier est vide</p>
          </div>
        ) : (
          <>
            <div className="cart-sidebar__items">
              {cart.map(({ product, qty }) => (
                <div key={product.id} className="cart-item">
                  <div className="cart-item__img">
                    {product.image
                      ? <img src={imgUrl(product.image)} alt={product.name} />
                      : <span>📦</span>}
                  </div>
                  <div className="cart-item__info">
                    <p className="cart-item__name">{product.name}</p>
                    <p className="cart-item__price">{parseFloat(product.price).toFixed(2)} MRU</p>
                  </div>
                  <div className="cart-item__qty">
                    <button onClick={() => updateQty(product.id, qty - 1)}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => updateQty(product.id, qty + 1)}>+</button>
                  </div>
                  <button className="cart-item__remove" onClick={() => removeItem(product.id)}>✕</button>
                </div>
              ))}
            </div>
            <div className="cart-sidebar__foot">
              <div className="cart-total">
                <span>Total</span>
                <span className="cart-total__price">{cartTotal.toFixed(2)} MRU</span>
              </div>
              <button className="btn btn--gold btn--full" onClick={() => { setCartOpen(false); onCheckout() }}>
                Commander →
              </button>
              <button className="btn btn--ghost btn--full" onClick={clearCart}>Vider le panier</button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   HOME PAGE  (Boutique)
═══════════════════════════════════════════════════════════ */
function HomePage() {
  const { addToCart }           = useCart()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch]     = useState('')
  const [dSearch, setDSearch]   = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading]   = useState(true)
  const [justAdded, setJustAdded] = useState({})

  // debounce search
  useEffect(() => { const t = setTimeout(() => setDSearch(search), 400); return () => clearTimeout(t) }, [search])

  useEffect(() => { API.getCategories().then(setCategories).catch(() => {}) }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (dSearch)   params.q        = dSearch
    if (category)  params.category = category
    API.getProducts(params).then(setProducts).catch(() => {}).finally(() => setLoading(false))
  }, [dSearch, category])

  const handleAdd = (p) => {
    addToCart(p)
    setJustAdded(a => ({ ...a, [p.id]: true }))
    setTimeout(() => setJustAdded(a => ({ ...a, [p.id]: false })), 1500)
  }

  return (
    <div className="page shop-page">
      <div className="shop-hero">
        <h1>Notre <em>Boutique</em></h1>
        <p>Découvrez notre sélection de produits premium</p>
      </div>

      <div className="shop-controls">
        <div className="search-bar">
          <svg className="search-bar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="search-bar__input" placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-bar__clear" onClick={() => setSearch('')}>✕</button>}
        </div>

        <div className="category-bar">
          {[['', 'Tous'], ...categories.map(c => [c.slug, c.name])].map(([s, l]) => (
            <button key={s} className={`cat-pill ${category === s ? 'cat-pill--active' : ''}`}
              onClick={() => setCategory(s)}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="products-grid">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span>🔍</span>
          <p>Aucun produit trouvé</p>
          <button className="btn btn--ghost" onClick={() => { setSearch(''); setCategory('') }}>Réinitialiser</button>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => (
            <div key={p.id} className="product-card">
              <div className="product-card__img">
                {p.image
                  ? <img src={imgUrl(p.image)} alt={p.name} />
                  : <div className="product-card__placeholder">📦</div>}
                {p.stock > 0 && p.stock <= 5 && <span className="product-card__stock-tag">Seulement {p.stock} restants</span>}
                {p.stock === 0 && <span className="product-card__stock-tag product-card__stock-tag--out">Rupture</span>}
              </div>
              <div className="product-card__body">
                {p.category_name && <span className="product-card__cat">{p.category_name}</span>}
                <h3 className="product-card__name">{p.name}</h3>
                <p className="product-card__desc">{p.description}</p>
                <div className="product-card__foot">
                  <span className="product-card__price">{parseFloat(p.price).toFixed(2)} MRU</span>
                  <button
                    className={`btn btn--add ${justAdded[p.id] ? 'btn--added' : ''}`}
                    onClick={() => handleAdd(p)}
                    disabled={p.stock === 0}
                  >{justAdded[p.id] ? '✓ Ajouté' : '+ Panier'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ORDERS PAGE
═══════════════════════════════════════════════════════════ */
const STATUS_COLOR = { pending:'#f59e0b', payment_uploaded:'#8b5cf6', validated:'#4ade80', shipped:'#60a5fa', delivered:'#34d399', cancelled:'#ef4444' }
const STATUS_ICON  = { pending:'⏳', payment_uploaded:'📤', validated:'✅', shipped:'🚚', delivered:'📦', cancelled:'❌' }
const STATUSES     = [['pending','En attente'],['payment_uploaded','Paiement reçu'],['validated','Validée'],['shipped','Expédiée'],['delivered','Livrée'],['cancelled','Annulée']]

function CheckoutModal({ onClose, onSuccess }) {
  const { cart, cartTotal } = useCart()
  const [address, setAddress] = useState('')
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleOrder = async () => {
    setLoading(true); setError('')
    try {
      const items = cart.map(i => ({ product_id: i.product.id, quantity: i.qty }))
      const order = await API.createOrder({ items, shipping_address: address, notes })
      onSuccess(order)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title="Confirmer la commande" onClose={onClose}>
      <div className="order-summary">
        {cart.map(({ product, qty }) => (
          <div key={product.id} className="order-summary__row">
            <span>{product.name} × {qty}</span>
            <span>{(parseFloat(product.price) * qty).toFixed(2)} MRU</span>
          </div>
        ))}
        <div className="order-summary__total">
          <strong>Total</strong><strong className="text-gold">{cartTotal.toFixed(2)} MRU</strong>
        </div>
      </div>
      <div className="bankily-info">
        <span>💳</span>
        <div>
          <div className="bankily-info__label">Paiement via Bankily</div>
          <div className="bankily-info__number">26455225</div>
        </div>
      </div>
      <Alert type="error" msg={error} />
      <InputField label="Adresse de livraison" value={address} onChange={e => setAddress(e.target.value)} placeholder="Votre adresse complète..." />
      <InputField label="Notes (optionnel)"     value={notes}   onChange={e => setNotes(e.target.value)}   placeholder="Instructions spéciales..." />
      <div className="modal__footer">
        <button className="btn btn--ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn--gold"  onClick={handleOrder} disabled={loading}>{loading ? <Spinner sm /> : 'Passer la commande'}</button>
      </div>
    </Modal>
  )
}

function PaymentModal({ order, onClose, onSuccess }) {
  const [file, setFile]       = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const onFile = (e) => {
    const f = e.target.files[0]
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)) }
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('payment_screenshot', file)
      await API.uploadPayment(order.id, fd)
      onSuccess()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title="Envoyer le paiement" onClose={onClose}>
      <p className="text-muted">Capture d'écran pour la commande <strong>#{order.id}</strong> — {parseFloat(order.total_price).toFixed(2)} MRU</p>
      <Alert type="error" msg={error} />
      <div className="upload-zone">
        <input type="file" id="pay-file" accept="image/*" onChange={onFile} hidden />
        <label htmlFor="pay-file" className="upload-zone__label">
          {preview
            ? <img src={preview} alt="preview" className="upload-zone__preview" />
            : <><span>📎</span><span>Cliquez pour sélectionner une image</span></>}
        </label>
      </div>
      <div className="modal__footer">
        <button className="btn btn--ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn--gold" onClick={handleUpload} disabled={!file || loading}>{loading ? <Spinner sm /> : 'Envoyer'}</button>
      </div>
    </Modal>
  )
}

function OrdersPage({ showCheckout, onCheckoutDone }) {
  const { clearCart }           = useCart()
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [payOrder, setPayOrder] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const loadOrders = () => API.myOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { loadOrders() }, [])

  const onOrderSuccess = (order) => {
    clearCart(); setSuccessMsg(order); loadOrders()
    if (onCheckoutDone) onCheckoutDone()
  }

  return (
    <div className="page orders-page">
      <h1 className="page-title">Mes Commandes</h1>

      {successMsg && (
        <div className="success-banner">
          ✅ Commande <strong>#{successMsg.id}</strong> créée !
          <button className="btn btn--sm btn--outline-green" onClick={() => { setPayOrder(successMsg); setSuccessMsg(null) }}>
            Envoyer le paiement
          </button>
          <button className="success-banner__close" onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="skeleton-list">{[...Array(3)].map((_, i) => <div key={i} className="skeleton-row" />)}</div>
      ) : orders.length === 0 ? (
        <div className="empty-state"><span>📋</span><p>Vous n'avez pas encore de commandes</p></div>
      ) : (
        <div className="orders-list">
          {orders.map(o => (
            <div key={o.id} className="order-card">
              <div className="order-card__head">
                <span className="order-card__id">Commande #{o.id}</span>
                <span className="order-card__status" style={{ color: STATUS_COLOR[o.status] }}>
                  {STATUS_ICON[o.status]} {o.status_display}
                </span>
                <span className="order-card__date">{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="order-card__items">
                {o.items?.map(i => <span key={i.id} className="order-item-tag">{i.product_name} ×{i.quantity}</span>)}
              </div>
              <div className="order-card__foot">
                <span className="order-card__total">{parseFloat(o.total_price).toFixed(2)} MRU</span>
                {o.status === 'pending' && (
                  <button className="btn btn--outline-gold btn--sm" onClick={() => setPayOrder(o)}>
                    📤 Envoyer paiement
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCheckout && <CheckoutModal onClose={onCheckoutDone} onSuccess={onOrderSuccess} />}
      {payOrder && (
        <PaymentModal
          order={payOrder}
          onClose={() => setPayOrder(null)}
          onSuccess={() => { setPayOrder(null); loadOrders() }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   CHAT WIDGET  (client flottant)
═══════════════════════════════════════════════════════════ */
function ChatWidget() {
  const { user }              = useAuth()
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [ws, setWs]           = useState(null)
  const [connected, setConnected] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (!open) return
    API.myMessages().then(setMessages).catch(() => {})
    const socket = openWS()
    socket.onopen    = () => setConnected(true)
    socket.onclose   = () => setConnected(false)
    socket.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'message') setMessages(m => [...m, d.message])
    }
    setWs(socket)
    return () => socket.close()
  }, [open])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMsg = () => {
    if (!input.trim() || !connected) return
    ws.send(JSON.stringify({ type: 'message', content: input }))
    setInput('')
  }

  return (
    <div className="chat-widget">
      <button className={`chat-widget__fab ${open ? 'chat-widget__fab--open' : ''}`} onClick={() => setOpen(o => !o)}>
        {open ? '✕' : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="chat-box">
          <div className="chat-box__head">
            <div className="chat-box__head-info">
              <div className={`status-dot ${connected ? 'status-dot--on' : 'status-dot--off'}`} />
              <div>
                <div className="chat-box__head-title">Support LuxeShop</div>
                <div className="chat-box__head-sub">{connected ? 'En ligne' : 'Hors ligne'}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="chat-box__messages">
            {messages.length === 0 && (
              <div className="chat-box__welcome">
                <span>👋</span><p>Comment pouvons-nous vous aider ?</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id || i} className={`chat-msg ${m.sender === user?.username || m.sender_id === user?.id ? 'chat-msg--mine' : 'chat-msg--theirs'}`}>
                <div className="chat-msg__bubble">{m.content}</div>
                <div className="chat-msg__time">
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="chat-box__input">
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMsg() }}
              placeholder="Tapez un message..." className="chat-box__input-field"
            />
            <button className="chat-box__send" onClick={sendMsg} disabled={!input.trim() || !connected}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ADMIN — Products Tab
═══════════════════════════════════════════════════════════ */
function AdminProducts() {
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ name:'', description:'', price:'', stock:'' })
  const [imgFile, setImgFile]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const load = () => API.getProducts({}).then(setProducts).catch(() => {})
  useEffect(() => { load() }, [])

  const openForm = (p = null) => {
    setEditing(p)
    setForm(p ? { name: p.name, description: p.description, price: p.price, stock: p.stock } : { name:'', description:'', price:'', stock:'' })
    setImgFile(null); setError(''); setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      fd.append('is_active', 'true')
      if (imgFile) fd.append('image', imgFile)
      editing ? await API.updateProduct(editing.id, fd) : await API.createProduct(fd)
      setShowForm(false); load()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return
    await API.deleteProduct(id).catch(() => {}); load()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="admin-section">
      <div className="admin-section__head">
        <h2>Produits ({products.length})</h2>
        <button className="btn btn--gold btn--sm" onClick={() => openForm()}>+ Ajouter</button>
      </div>

      {showForm && (
        <Modal title={editing ? 'Modifier le produit' : 'Nouveau produit'} onClose={() => setShowForm(false)} wide>
          <form onSubmit={handleSubmit}>
            <Alert type="error" msg={error} />
            <div className="field-row">
              <InputField label="Nom *"      value={form.name}  onChange={set('name')}  placeholder="Nom du produit" required />
              <InputField label="Prix (€) *" value={form.price} onChange={set('price')} placeholder="0.00" type="number" required />
            </div>
            <InputField label="Description" value={form.description} onChange={set('description')} placeholder="Description..." />
            <div className="field-row">
              <InputField label="Stock" value={form.stock} onChange={set('stock')} placeholder="0" type="number" />
              <div className="field">
                <label className="field__label">Image</label>
                <input className="field__input" type="file" accept="image/*" onChange={e => setImgFile(e.target.files[0])} />
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn--gold" disabled={loading}>{loading ? <Spinner sm /> : editing ? 'Modifier' : 'Créer'}</button>
            </div>
          </form>
        </Modal>
      )}

      <div className="admin-products-grid">
        {products.map(p => (
          <div key={p.id} className="admin-product-card">
            <div className="admin-product-card__img">
              {p.image ? <img src={imgUrl(p.image)} alt={p.name} /> : '📦'}
            </div>
            <div className="admin-product-card__info">
              <h4>{p.name}</h4>
              <p>{parseFloat(p.price).toFixed(2)} MRU · Stock : {p.stock}</p>
            </div>
            <div className="admin-product-card__actions">
              <button className="btn-icon" onClick={() => openForm(p)} title="Modifier">✏️</button>
              <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(p.id)} title="Supprimer">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ADMIN — Orders Tab
═══════════════════════════════════════════════════════════ */
function AdminOrders() {
  const [orders, setOrders]     = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading]   = useState(true)

  const load = () => {
    setLoading(true)
    API.adminOrders(statusFilter).then(setOrders).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [statusFilter])

  const updateStatus = async (id, status) => {
    await API.updateOrderStatus(id, status).catch(() => {})
    load(); setExpanded(null)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__head">
        <h2>Commandes ({orders.length})</h2>
        <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="skeleton-list">{[...Array(3)].map((_, i) => <div key={i} className="skeleton-row" />)}</div>
      ) : (
        <div className="admin-orders-list">
          {orders.map(o => (
            <div key={o.id} className={`admin-order-row ${expanded === o.id ? 'admin-order-row--expanded' : ''}`}>
              <div className="admin-order-row__main" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                <span className="order-id-pill">#{o.id}</span>
                <span className="admin-order-row__user">{o.username}</span>
                <span className="admin-order-row__amount text-gold">{parseFloat(o.total_price).toFixed(2)} MRU</span>
                <span className="admin-order-row__status" style={{ color: STATUS_COLOR[o.status] }}>{o.status_display}</span>
                <span className="admin-order-row__date">{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                <span className="expand-arrow">{expanded === o.id ? '▲' : '▼'}</span>
              </div>

              {expanded === o.id && (
                <div className="admin-order-row__detail">
                  <div className="order-detail-grid">
                    <div>
                      <h4>Articles</h4>
                      {o.items?.map(i => <p key={i.id}>{i.product_name} × {i.quantity} = {parseFloat(i.total).toFixed(2)} MRU</p>)}
                    </div>
                    <div>
                      <h4>Client</h4>
                      <p>{o.username} — {o.user_email}</p>
                      <p>Adresse : {o.shipping_address || 'Non renseignée'}</p>
                      {o.notes && <p>Notes : {o.notes}</p>}
                    </div>
                    {o.payment_screenshot && (
                      <div>
                        <h4>Capture de paiement</h4>
                        <a href={imgUrl(o.payment_screenshot)} target="_blank" rel="noreferrer">
                          <img src={imgUrl(o.payment_screenshot)} className="payment-thumb" alt="paiement" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="status-actions">
                    <span>Changer le statut :</span>
                    {STATUSES.map(([v, l]) => (
                      <button key={v}
                        className={`btn btn--xs ${o.status === v ? 'btn--gold' : 'btn--ghost'}`}
                        onClick={() => updateStatus(o.id, v)}
                        disabled={o.status === v}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ADMIN — Users Tab
═══════════════════════════════════════════════════════════ */
function AdminUsers() {
  const [users, setUsers] = useState([])
  const load = () => API.getUsers().then(setUsers).catch(() => {})
  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    await API.deleteUser(id).catch(() => {}); load()
  }
  const handleBan = async (id) => { await API.banUser(id).catch(() => {}); load() }

  return (
    <div className="admin-section">
      <div className="admin-section__head"><h2>Utilisateurs ({users.length})</h2></div>
      <div className="users-table">
        <div className="users-table__header">
          <span>Utilisateur</span><span>Email</span><span>Inscrit le</span><span>Statut</span><span>Actions</span>
        </div>
        {users.map(u => (
          <div key={u.id} className="users-table__row">
            <span className="user-cell">
              <div className="avatar avatar--sm">{u.username?.[0]?.toUpperCase()}</div>
              <div><strong>{u.username}</strong>{u.is_staff && <span className="admin-pill">Admin</span>}</div>
            </span>
            <span>{u.email}</span>
            <span>{new Date(u.date_joined).toLocaleDateString('fr-FR')}</span>
            <span className={u.profile?.is_banned ? 'text-red' : 'text-green'}>
              {u.profile?.is_banned ? 'Banni' : 'Actif'}
            </span>
            <span className="table-actions">
              {!u.is_staff && (
                <>
                  <button className={`btn btn--xs ${u.profile?.is_banned ? 'btn--ghost' : 'btn--warn'}`}
                    onClick={() => handleBan(u.id)}>
                    {u.profile?.is_banned ? 'Réactiver' : 'Bannir'}
                  </button>
                  <button className="btn btn--xs btn--danger" onClick={() => handleDelete(u.id)}>Supprimer</button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ADMIN — Chat Tab
═══════════════════════════════════════════════════════════ */
function AdminChat() {
  const [rooms, setRooms]       = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [ws, setWs]             = useState(null)
  const endRef = useRef(null)

  useEffect(() => { API.adminRooms().then(setRooms).catch(() => {}) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const openRoom = async (room) => {
    if (ws) ws.close()
    setSelected(room)
    const msgs = await API.adminRoomMessages(room.user_id).catch(() => [])
    setMessages(msgs)
    const socket = openWS(room.user_id)
    socket.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'message') setMessages(m => [...m, d.message])
    }
    setWs(socket)
  }

  const sendMsg = () => {
    if (!input.trim() || !ws) return
    ws.send(JSON.stringify({ type: 'message', content: input }))
    setInput('')
  }

  return (
    <div className="admin-section">
      <div className="admin-chat-layout">
        <div className="admin-chat-rooms">
          <h3>Conversations</h3>
          {rooms.length === 0 && <p className="text-muted">Aucune conversation</p>}
          {rooms.map(r => (
            <div key={r.id} className={`room-item ${selected?.id === r.id ? 'room-item--active' : ''}`}
              onClick={() => openRoom(r)}>
              <div className="avatar avatar--sm">{r.username?.[0]?.toUpperCase()}</div>
              <div className="room-item__info">
                <div className="room-item__name">{r.username}</div>
                {r.last_message && <div className="room-item__preview">{r.last_message.content}</div>}
              </div>
              {r.unread_count > 0 && <span className="badge badge--gold">{r.unread_count}</span>}
            </div>
          ))}
        </div>

        <div className="admin-chat-window">
          {!selected ? (
            <div className="admin-chat-empty"><span>💬</span><p>Sélectionnez une conversation</p></div>
          ) : (
            <>
              <div className="admin-chat-window__head">
                <div className="avatar avatar--sm">{selected.username?.[0]?.toUpperCase()}</div>
                <strong>{selected.username}</strong>
              </div>
              <div className="admin-chat-window__messages">
                {messages.map((m, i) => (
                  <div key={m.id || i} className={`chat-msg ${m.is_staff ? 'chat-msg--mine' : 'chat-msg--theirs'}`}>
                    <div className="chat-msg__bubble">{m.content}</div>
                    <div className="chat-msg__time">
                      {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="chat-box__input">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendMsg() }}
                  placeholder="Répondre..." className="chat-box__input-field" />
                <button className="chat-box__send" onClick={sendMsg} disabled={!input.trim()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ADMIN DASHBOARD
═══════════════════════════════════════════════════════════ */
function AdminDashboard() {
  const [tab, setTab] = useState('products')
  const TABS = [['products','📦 Produits'], ['orders','📋 Commandes'], ['users','👥 Utilisateurs'], ['chat','💬 Chat']]

  return (
    <div className="page admin-page">
      <h1 className="page-title">⚙ Tableau de Bord Admin</h1>
      <div className="admin-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={`admin-tab-btn ${tab === k ? 'admin-tab-btn--active' : ''}`}
            onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'products' && <AdminProducts />}
      {tab === 'orders'   && <AdminOrders />}
      {tab === 'users'    && <AdminUsers />}
      {tab === 'chat'     && <AdminChat />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════ */
function AppContent() {
  const { user, loading }         = useAuth()
  const [page, setPage]           = useState('home')
  const [showCheckout, setShowCheckout] = useState(false)

  if (loading) {
    return (
      <div className="full-loader">
        <div className="full-loader__inner">
          <span className="full-loader__logo">✦</span>
          <Spinner />
        </div>
      </div>
    )
  }

  if (!user) return <AuthPages />

  return (
    <div className="app-wrapper">
      <Navbar page={page} navigate={setPage} />
      <main className="app-main">
        {page === 'home'   && <HomePage />}
        {page === 'orders' && <OrdersPage showCheckout={showCheckout} onCheckoutDone={() => setShowCheckout(false)} />}
        {page === 'admin'  && user.is_staff && <AdminDashboard />}
      </main>
      <CartSidebar onCheckout={() => { setPage('orders'); setShowCheckout(true) }} />
      {!user.is_staff && <ChatWidget />}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)