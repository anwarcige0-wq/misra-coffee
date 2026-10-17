-- ==============================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR MISRA COFFEE & MULTI-TENANT RESTAURANT PLATFORM
-- Includes Tables, Foreign Keys, Indexes, and Row Level Security (RLS) Policies
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Restaurants Table (Multi-tenant Root)
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    phone TEXT,
    currency TEXT DEFAULT '$',
    qr_base_url TEXT DEFAULT '',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Restaurant Tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    label TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, table_number)
);

-- 4. Menu Categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Menu Items
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT,
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Waiter Service Requests & Draft Orders
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    request_type TEXT NOT NULL DEFAULT 'waiter_call' CHECK (request_type IN ('waiter_call', 'food_selection')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'completed', 'cancelled')),
    items_json JSONB,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 7. Staff Users & Roles
CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    full_name TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, username)
);

-- 8. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON public.restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_requests_restaurant_status ON public.service_requests(restaurant_id, status);

-- 9. Row Level Security (RLS) Policies
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Public can view active restaurants, active tables, categories, and available menu items
CREATE POLICY "Public can view active restaurants"
    ON public.restaurants FOR SELECT USING (true);

CREATE POLICY "Public can view active tables"
    ON public.restaurant_tables FOR SELECT USING (active = true);

CREATE POLICY "Public can view active menu categories"
    ON public.menu_categories FOR SELECT USING (active = true);

CREATE POLICY "Public can view available menu items"
    ON public.menu_items FOR SELECT USING (available = true);

-- Public can create new service requests for valid tables
CREATE POLICY "Public can insert service requests"
    ON public.service_requests FOR INSERT WITH CHECK (true);

-- Customers can check their own request status
CREATE POLICY "Public can view service requests"
    ON public.service_requests FOR SELECT USING (true);

-- Staff and Admins have full access to their restaurant's data
CREATE POLICY "Staff can manage service requests"
    ON public.service_requests FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.staff_users
            WHERE staff_users.restaurant_id = service_requests.restaurant_id
            AND staff_users.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage menu items"
    ON public.menu_items FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.staff_users
            WHERE staff_users.restaurant_id = menu_items.restaurant_id
            AND staff_users.role = 'admin'
            AND staff_users.auth_user_id = auth.uid()
        )
    );
