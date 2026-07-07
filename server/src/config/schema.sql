-- RestoLab - Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'driver', 'manager_driver')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================
-- DRIVER TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_positions_driver ON driver_positions(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_positions_time ON driver_positions(recorded_at DESC);

-- ============================================================
-- PRODUCT CATALOG & INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_business ON product_categories(business_id);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  stock_quantity INT DEFAULT 0,
  stock_alert_threshold INT DEFAULT 5,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ============================================================
-- PROMO CODES
-- ============================================================

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_delivery')),
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_uses INT,
  current_uses INT DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_business ON promo_codes(business_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,

  -- Customer info
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),
  delivery_address TEXT NOT NULL,
  delivery_latitude DOUBLE PRECISION,
  delivery_longitude DOUBLE PRECISION,
  delivery_notes TEXT,

  -- Financials
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Payment
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'meal_voucher')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'problem', 'cancelled')),

  -- Tour assignment
  tour_id UUID,
  stop_order INT,

  estimated_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_tour ON orders(tour_id);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================
-- ORDER STATUS HISTORY (for timeline tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- ============================================================
-- TOURS (delivery rounds)
-- ============================================================

CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  start_latitude DOUBLE PRECISION,
  start_longitude DOUBLE PRECISION,
  optimized_route JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tours_business ON tours(business_id);
CREATE INDEX IF NOT EXISTS idx_tours_driver ON tours(driver_id);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status);

-- Add foreign key for orders.tour_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_tour') THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- DAILY CLOSINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL,
  total_orders INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_cancelled INT DEFAULT 0,
  total_problems INT DEFAULT 0,
  revenue_cash DECIMAL(10,2) DEFAULT 0,
  revenue_card DECIMAL(10,2) DEFAULT 0,
  revenue_meal_voucher DECIMAL(10,2) DEFAULT 0,
  revenue_total DECIMAL(10,2) DEFAULT 0,
  total_discount DECIMAL(10,2) DEFAULT 0,
  total_delivery_fees DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_closings_unique ON daily_closings(business_id, closing_date);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;

-- ============================================================
-- INGREDIENTS (matières premières)
-- ============================================================

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'unité',
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  alert_threshold DECIMAL(10,2) DEFAULT 5,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  supplier VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_business ON ingredients(business_id);

CREATE TABLE IF NOT EXISTS ingredient_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'waste')),
  quantity DECIMAL(10,2) NOT NULL,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredient_movements_ingredient ON ingredient_movements(ingredient_id);

-- ============================================================
-- CUSTOMERS & LOYALTY
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  loyalty_points INT DEFAULT 0,
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS loyalty_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  points_per_euro INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  welcome_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  points_cost INT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('discount_percentage', 'discount_fixed', 'free_product', 'free_delivery')),
  value DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_business ON loyalty_rewards(business_id);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'bonus', 'adjustment')),
  points INT NOT NULL,
  description TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);

-- Add customer_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- ============================================================
-- EMAIL VERIFICATION & PASSWORD RESET
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Mark existing users as verified so they aren't locked out
UPDATE users SET email_verified = true WHERE email_verified = false AND verification_token IS NULL;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Mark existing customers as verified so they aren't locked out
UPDATE customers SET email_verified = true WHERE email_verified = false AND verification_token IS NULL;

-- ============================================================
-- RESTAURANT TABLES (plan de table)
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_number INT NOT NULL,
  capacity INT NOT NULL DEFAULT 2,
  status VARCHAR(20) DEFAULT 'available'
    CHECK (status IN ('available', 'occupied', 'reserved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_business ON restaurant_tables(business_id);

-- ============================================================
-- RESERVATIONS
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS reservation_number_seq START 5001;

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reservation_number VARCHAR(20) UNIQUE NOT NULL,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  customer_last_name VARCHAR(100) NOT NULL,
  customer_first_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INT NOT NULL DEFAULT 1,
  status VARCHAR(20) DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_business ON reservations(business_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(business_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_number ON reservations(reservation_number);

-- ============================================================
-- CASH REGISTER (caisse)
-- ============================================================

CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  opening_float DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(10,2),
  expected_amount DECIMAL(10,2),
  difference DECIMAL(10,2),
  total_cash DECIMAL(10,2) DEFAULT 0,
  total_card DECIMAL(10,2) DEFAULT 0,
  total_meal_voucher DECIMAL(10,2) DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  transaction_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_business ON cash_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(business_id, status);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'refund', 'expense', 'deposit', 'withdrawal')),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'meal_voucher')),
  amount DECIMAL(10,2) NOT NULL,
  label VARCHAR(255),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_session ON cash_transactions(session_id);

-- ============================================================
-- HELPER: generate order numbers
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

-- Order type (dine-in / takeaway / delivery)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'delivery'
  CHECK (order_type IN ('dine_in', 'takeaway', 'delivery'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);
ALTER TABLE orders ALTER COLUMN delivery_address DROP NOT NULL;

-- Configurable delivery fee per business
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 2.50;

-- ============================================================
-- FISCAL COMPLIANCE (loi anti-fraude TVA - inalterabilite,
-- securisation, conservation et archivage des donnees - ISCA)
-- ============================================================

-- Chaque commande encaissee (payment_status = 'paid') est un ticket fiscal :
-- elle recoit un numero de sequence et un hash chaine au ticket precedent.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fiscal_sequence BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fiscal_prev_hash VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fiscal_hash VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_fiscal_sequence ON orders(business_id, fiscal_sequence) WHERE fiscal_sequence IS NOT NULL;

-- Une fois encaissee, une commande ne peut plus voir ses montants/moyen de
-- paiement/numero modifies (les statuts operationnels comme "problem" restent
-- modifiables, seuls les champs fiscaux sont proteges).
CREATE OR REPLACE FUNCTION protect_paid_order_financials() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_status = 'paid' THEN
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.order_number IS DISTINCT FROM OLD.order_number
       OR NEW.fiscal_sequence IS DISTINCT FROM OLD.fiscal_sequence
       OR NEW.fiscal_prev_hash IS DISTINCT FROM OLD.fiscal_prev_hash
       OR NEW.fiscal_hash IS DISTINCT FROM OLD.fiscal_hash
    THEN
      RAISE EXCEPTION 'Modification interdite: ticket % deja encaisse (loi anti-fraude TVA)', OLD.order_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_paid_order_financials ON orders;
CREATE TRIGGER trg_protect_paid_order_financials
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION protect_paid_order_financials();

CREATE OR REPLACE FUNCTION prevent_paid_order_delete() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Suppression interdite: ticket % deja encaisse (loi anti-fraude TVA)', OLD.order_number;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_paid_order_delete ON orders;
CREATE TRIGGER trg_prevent_paid_order_delete
  BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION prevent_paid_order_delete();

-- Les lignes d'un ticket encaisse sont elles aussi protegees.
CREATE OR REPLACE FUNCTION protect_paid_order_items() RETURNS TRIGGER AS $$
DECLARE
  is_paid BOOLEAN;
BEGIN
  SELECT (payment_status = 'paid') INTO is_paid FROM orders WHERE id = OLD.order_id;
  IF is_paid THEN
    RAISE EXCEPTION 'Modification interdite: lignes d''un ticket deja encaisse (loi anti-fraude TVA)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_paid_order_items ON order_items;
CREATE TRIGGER trg_protect_paid_order_items
  BEFORE UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION protect_paid_order_items();

-- Generic trigger: interdit toute modification/suppression sur les tables
-- purement append-only du registre fiscal (cash_transactions, clotures).
CREATE OR REPLACE FUNCTION prevent_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Modification/suppression interdite: enregistrement fiscal inalterable (table %)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Journal de caisse (cash_transactions) : chaine + totalement immuable.
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
UPDATE cash_transactions ct SET business_id = cs.business_id FROM cash_sessions cs WHERE ct.session_id = cs.id AND ct.business_id IS NULL;
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS sequence_number BIGINT;
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_business ON cash_transactions(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_transactions_fiscal_sequence ON cash_transactions(business_id, sequence_number) WHERE sequence_number IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cash_transactions_immutable ON cash_transactions;
CREATE TRIGGER trg_cash_transactions_immutable
  BEFORE UPDATE OR DELETE ON cash_transactions
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- Clotures journalieres : chainees + immuables (plus de re-cloture possible).
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS sequence_number BIGINT;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS hash VARCHAR(64);

DROP TRIGGER IF EXISTS trg_daily_closings_immutable ON daily_closings;
CREATE TRIGGER trg_daily_closings_immutable
  BEFORE UPDATE OR DELETE ON daily_closings
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- Clotures mensuelles et annuelles (meme principe que les clotures
-- journalieres, granularite differente).
CREATE TABLE IF NOT EXISTS period_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('monthly', 'annual')),
  period_key VARCHAR(7) NOT NULL,
  total_orders INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_cancelled INT DEFAULT 0,
  total_problems INT DEFAULT 0,
  revenue_cash DECIMAL(10,2) DEFAULT 0,
  revenue_card DECIMAL(10,2) DEFAULT 0,
  revenue_meal_voucher DECIMAL(10,2) DEFAULT 0,
  revenue_total DECIMAL(10,2) DEFAULT 0,
  total_discount DECIMAL(10,2) DEFAULT 0,
  total_delivery_fees DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sequence_number BIGINT,
  prev_hash VARCHAR(64),
  hash VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_period_closings_unique ON period_closings(business_id, period_type, period_key);

DROP TRIGGER IF EXISTS trg_period_closings_immutable ON period_closings;
CREATE TRIGGER trg_period_closings_immutable
  BEFORE UPDATE OR DELETE ON period_closings
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- ============================================================
-- ABONNEMENT SAAS (facturation Stripe des commerces clients)
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'trialing'
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'suspended'));
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter';
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_plan_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_plan_check CHECK (plan IN ('starter', 'standard', 'premium'));
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
-- Date du premier echec de prelevement de la serie en cours ; sert de depart
-- a la periode de grace (voir GRACE_PERIOD_DAYS cote code). Remise a NULL des
-- qu'un paiement repasse.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_businesses_stripe_customer ON businesses(stripe_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_stripe_subscription ON businesses(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Super-admins RestoLab : separes de "users" pour ne jamais melanger un
-- compte plateforme (acces a tous les commerces) avec un compte scope a un
-- seul business_id.
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BRANDING (couleurs et logo personnalises par commerce)
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);

-- ============================================================
-- EQUIPIERS (acces restreint : caisse, commandes, reservations)
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('manager', 'driver', 'manager_driver', 'staff'));
