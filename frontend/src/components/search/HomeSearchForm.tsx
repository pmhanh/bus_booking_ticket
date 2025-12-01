import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { searchCities } from '../../api/cities';
import type { CityOption } from '../../api/cities';

type HomeSearchFormProps = {
  onSubmit?: (params: { originId: number; destinationId: number; date: string }) => void;
};

type AutocompleteState = {
  query: string;
  options: CityOption[];
  selected: CityOption | null;
  open: boolean;
  loading: boolean;
};

const useCityAutocomplete = () => {
  const [state, setState] = useState<AutocompleteState>({
    query: '',
    options: [],
    selected: null,
    open: false,
    loading: false,
  });

  useEffect(() => {
    if (!state.query) {
      setState((prev) => ({ ...prev, options: [], open: false, loading: false }));
      return;
    }
    const handle = setTimeout(async () => {
      setState((prev) => ({ ...prev, loading: true, open: true }));
      try {
        const opts = await searchCities(state.query, 10);
        setState((prev) => ({ ...prev, options: opts, loading: false, open: true }));
      } catch {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [state.query]);

  const select = (opt: CityOption) => {
    setState((prev) => ({
      ...prev,
      selected: opt,
      query: opt.name,
      open: false,
    }));
  };

  const setQuery = (q: string) => setState((prev) => ({ ...prev, query: q, open: true }));

  return {
    state,
    setQuery,
    select,
    setOpen: (open: boolean) => setState((prev) => ({ ...prev, open })),
  };
};

export const HomeSearchForm = ({ onSubmit }: HomeSearchFormProps) => {
  const navigate = useNavigate();
  const origin = useCityAutocomplete();
  const destination = useCityAutocomplete();
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const originId = origin.state.selected?.id;
    const destinationId = destination.state.selected?.id;
    if (!originId || !destinationId || !date) {
      setError('Vui lòng chọn điểm đi, điểm đến và ngày khởi hành.');
      return;
    }
    if (onSubmit) {
      onSubmit({ originId, destinationId, date });
    } else {
      navigate(`/search?originId=${originId}&destinationId=${destinationId}&date=${date}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-200 mb-1">Điểm đi</label>
          <input
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={origin.state.query}
            onChange={(e) => origin.setQuery(e.target.value)}
            onFocus={() => origin.setOpen(true)}
            placeholder="Chọn điểm xuất phát"
          />
          {origin.state.open && origin.state.options.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-white/10 rounded-lg shadow-lg max-h-60 overflow-auto">
              {origin.state.options.map((opt) => (
                <div
                  key={opt.id}
                  className="px-3 py-2 text-sm text-gray-100 hover:bg-emerald-500/20 cursor-pointer"
                  onClick={() => origin.select(opt)}
                >
                  {opt.name}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-200 mb-1">Điểm đến</label>
          <input
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={destination.state.query}
            onChange={(e) => destination.setQuery(e.target.value)}
            onFocus={() => destination.setOpen(true)}
            placeholder="Chọn điểm đến"
          />
          {destination.state.open && destination.state.options.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-white/10 rounded-lg shadow-lg max-h-60 overflow-auto">
              {destination.state.options.map((opt) => (
                <div
                  key={opt.id}
                  className="px-3 py-2 text-sm text-gray-100 hover:bg-emerald-500/20 cursor-pointer"
                  onClick={() => destination.select(opt)}
                >
                  {opt.name}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">Ngày khởi hành</label>
          <input
            type="date"
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">Tìm chuyến xe</Button>
      </div>
      {error ? <div className="text-sm text-red-400 mt-2">{error}</div> : null}
    </form>
  );
};
