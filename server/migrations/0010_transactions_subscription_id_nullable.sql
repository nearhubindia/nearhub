DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE "transactions"
    ALTER COLUMN "subscription_id" DROP NOT NULL;
  END IF;
END $$;
