import ProductsPage from '@/components/ProductsPage';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <>
      <Topbar user={user} />
      <ProductsPage />
    </>
  );
}
