'use client';

import { useState, useEffect, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Topbar } from '@/components/Topbar';
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react';

interface Product {
  id?: number;
  code: string;
  name: string;
  aliases: string[];
}

export default function ProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('code');
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  }

  async function addProduct() {
    setError('');
    if (!newCode.trim() || !newName.trim()) {
      setError('Kod i nazwa są wymagane');
      return;
    }
    const code = newCode.trim().toUpperCase();
    const aliases = newAliases.split(',').map(a => a.trim()).filter(Boolean);
    // Zawsze dodaj sam kod jako alias
    if (!aliases.includes(code)) aliases.unshift(code);

    const { error: err } = await supabase.from('products').insert({
      code, name: newName.trim(), aliases,
    });
    if (err) {
      setError(err.message.includes('unique') ? `Kod "${code}" już istnieje` : err.message);
      return;
    }
    setNewCode(''); setNewName(''); setNewAliases('');
    showSuccess(`Dodano produkt ${code}`);
    load();
  }

  async function updateProduct(id: number, patch: Partial<Product>) {
    const { error: err } = await supabase.from('products').update(patch).eq('id', id);
    if (!err) showSuccess('Zapisano');
    load();
  }

  async function deleteProduct(id: number, code: string) {
    if (!confirm(`Usunąć produkt "${code}"?`)) return;
    await supabase.from('products').delete().eq('id', id);
    showSuccess(`Usunięto ${code}`);
    load();
  }

  const filtered = products.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const inputClass = "px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  return (
    <div className="p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Produkty</h1>
          <p className="text-sm text-gray-500">Zarządzaj listą produktów i ich aliasami</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Odśwież
        </button>
      </div>

      {/* Dodaj nowy produkt */}
      <div className="bg-white rounded shadow-sm p-4 mb-4 border">
        <h2 className="text-sm font-semibold mb-3 text-gray-700">➕ Dodaj nowy produkt</h2>
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Kod *</label>
            <input value={newCode} onChange={e => setNewCode(e.target.value)}
              className={`${inputClass} w-24 uppercase`} placeholder="np. KM" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nazwa *</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              className={`${inputClass} w-48`} placeholder="np. Kasza Manna" />
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs text-gray-500 block mb-1">Aliasy (oddzielone przecinkiem)</label>
            <input value={newAliases} onChange={e => setNewAliases(e.target.value)}
              className={`${inputClass} w-full`} placeholder="np. KASZA MANNA, kasza manna, km"
              onKeyDown={e => e.key === 'Enter' && addProduct()} />
          </div>
          <button onClick={addProduct}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium">
            <Plus size={14} /> Dodaj
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        {success && <p className="text-xs text-green-600 mt-2">✓ {success}</p>}
      </div>

      {/* Szukaj */}
      <div className="mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className={`${inputClass} w-64`} placeholder="🔍 Szukaj po kodzie lub nazwie..." />
        {search && <span className="text-xs text-gray-500 ml-2">{filtered.length} z {products.length}</span>}
      </div>

      {/* Lista produktów */}
      <div className="bg-white rounded shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="text-left p-2 w-24">Kod</th>
              <th className="text-left p-2 w-48">Nazwa</th>
              <th className="text-left p-2">Aliasy</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">Ładowanie...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">Brak produktów</td></tr>
            ) : filtered.map((p, i) => (
              <ProductRow key={p.id} product={p} odd={i % 2 === 1}
                onUpdate={(patch) => p.id && updateProduct(p.id, patch)}
                onDelete={() => p.id && deleteProduct(p.id, p.code)} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        💡 Aliasy to alternatywne nazwy które możesz wpisać w polu KWIT — system automatycznie rozpozna produkt.
        Kod zawsze jest aliasem samego siebie.
      </p>
    </div>
  );
}

function ProductRow({ product, odd, onUpdate, onDelete }: {
  product: Product; odd: boolean;
  onUpdate: (patch: Partial<Product>) => void;
  onDelete: () => void;
}) {
  const [code, setCode] = useState(product.code);
  const [name, setName] = useState(product.name);
  const [aliases, setAliases] = useState(product.aliases.join(', '));
  const [dirty, setDirty] = useState(false);

  function save() {
    const aliasArr = aliases.split(',').map(a => a.trim()).filter(Boolean);
    if (!aliasArr.includes(code)) aliasArr.unshift(code);
    onUpdate({ code, name, aliases: aliasArr });
    setDirty(false);
  }

  const inputClass = "px-2 py-1 border border-transparent rounded text-sm outline-none focus:border-blue-400 focus:bg-white w-full";
  const bg = odd ? 'bg-gray-50' : 'bg-white';

  return (
    <tr className={`${bg} border-t hover:bg-blue-50 transition-colors`}>
      <td className="p-1">
        <input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setDirty(true); }}
          className={`${inputClass} font-mono font-semibold text-blue-700 w-20`} />
      </td>
      <td className="p-1">
        <input value={name} onChange={e => { setName(e.target.value); setDirty(true); }}
          className={inputClass} />
      </td>
      <td className="p-1">
        <input value={aliases} onChange={e => { setAliases(e.target.value); setDirty(true); }}
          className={`${inputClass} text-gray-500 text-xs`}
          placeholder="alias1, alias2, alias3" />
      </td>
      <td className="p-1 flex items-center gap-1 justify-end">
        {dirty && (
          <button onClick={save}
            className="p-1 rounded text-green-600 hover:bg-green-50 transition-colors" title="Zapisz">
            <Save size={13} />
          </button>
        )}
        <button onClick={onDelete}
          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Usuń">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}
