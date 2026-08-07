-- 1. Create order_receipts table
CREATE TABLE public.order_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    store_id UUID NOT NULL, -- Assuming store_id exists or we use user_id
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Grant permissions
GRANT SELECT, INSERT, DELETE ON public.order_receipts TO authenticated;
GRANT ALL ON public.order_receipts TO service_role;

-- 3. Enable RLS
ALTER TABLE public.order_receipts ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for the table
CREATE POLICY "Users can manage receipts for their own store/user"
ON public.order_receipts
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- 5. Create Storage Bucket
-- Note: Storage buckets are usually managed via supabase--storage_create_bucket or manually,
-- but we can attempt to insert into storage.buckets if we have permissions, 
-- though the tool is safer.

