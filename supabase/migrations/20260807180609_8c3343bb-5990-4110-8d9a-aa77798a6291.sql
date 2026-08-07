-- RLS for order-receipts bucket
-- Allow authenticated users to manage their own store's receipts

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can view their own receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can delete their own receipts" ON storage.objects;
END $$;

-- Policy for viewing
CREATE POLICY "Authenticated users can view their own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-receipts' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.stores WHERE owner_id = auth.uid()
  )
);

-- Policy for inserting
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-receipts' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.stores WHERE owner_id = auth.uid()
  )
);

-- Policy for deleting
CREATE POLICY "Authenticated users can delete their own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-receipts' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.stores WHERE owner_id = auth.uid()
  )
);
