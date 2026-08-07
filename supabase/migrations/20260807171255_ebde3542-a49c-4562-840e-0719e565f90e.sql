-- Create order_receipts table
CREATE TABLE IF NOT EXISTS public.order_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    store_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.order_receipts TO authenticated;
GRANT ALL ON public.order_receipts TO service_role;

-- Enable RLS
ALTER TABLE public.order_receipts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'order_receipts' AND policyname = 'Users can manage receipts for their own user_id'
    ) THEN
        CREATE POLICY "Users can manage receipts for their own user_id"
        ON public.order_receipts
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END $$;
