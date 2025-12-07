import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { searchCities, type CityOption } from '../../api/cities';

type HomeSearchFormProps = {
  onSubmit?: (params: {
    originId: number;
    destinationId: number;
    date: string;
    originName: string;
    destinationName: string;
  }) => void;
  initialOrigin?: { id: number; name: string };
  initialDestination?: { id: number; name: string };
  initialDate?: string;
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

  const loadPopular = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, open: true }));
    try {
      const opts = await searchCities('', 10);
      setState((prev) => ({ ...prev, options: opts, loading: false, open: true }));
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

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
    setOpen: (open: boolean) => {
      setState((prev) => ({ ...prev, open }));
      if (open && !state.query && !state.options.length) {
        void loadPopular();
      }
    },
    close: () => setState((prev) => ({ ...prev, open: false })),
  };
};

export const HomeSearchForm = ({
  onSubmit,
  initialOrigin,
  initialDestination,
  initialDate,
}: HomeSearchFormProps) => {
  const navigate = useNavigate();
  const origin = useCityAutocomplete();
  const destination = useCityAutocomplete();
  const [date, setDate] = useState(initialDate || '');
  const [error, setError] = useState('');
  const originRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const originId = origin.state.selected?.id;
    const destinationId = destination.state.selected?.id;
    const originName = origin.state.selected?.name || '';
    const destinationName = destination.state.selected?.name || '';
    if (!originId || !destinationId || !date) {
      setError('Vui lòng chọn điểm đi, điểm đến và ngày khởi hành.');
      return;
    }
    if (onSubmit) {
      onSubmit({ originId, destinationId, date, originName, destinationName });
    } else {
      navigate(`/search?originId=${originId}&destinationId=${destinationId}&date=${date}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !originRef.current?.contains(target)) origin.close();
      if (target && !destinationRef.current?.contains(target)) destination.close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [origin, destination]);

  useEffect(() => {
    if (initialOrigin) {
      origin.select({ id: initialOrigin.id, name: initialOrigin.name, code: 0, slug: '' });
    }
    if (initialDestination) {
      destination.select({
        id: initialDestination.id,
        name: initialDestination.name,
        code: 0,
        slug: '',
      });
    }
    if (initialDate) setDate(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrigin?.id, initialDestination?.id, initialDate]);

  return (
    <form onSubmit={handleSubmit} className="relative z-50 space-y-4">
      <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        <div className="relative z-50" ref={originRef}>
          <label className="block text-sm font-medium text-gray-200 mb-1">Điểm đi</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 19l19-7-19-7 5 7-5 7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12h1.5" />
              </svg>
            </span>
            <input
              className="w-full pl-10 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={origin.state.query}
              onChange={(e) => origin.setQuery(e.target.value)}
              onFocus={() => origin.setOpen(true)}
              placeholder="Thành phố xuất phát"
            />
          </div>
          {origin.state.open && origin.state.options.length > 0 && (
            <div className="absolute left-0 right-0 z-50 mt-1 bg-slate-900/95 backdrop-blur border border-white/10 rounded-lg shadow-xl max-h-60 overflow-auto pr-1">
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
          )}
        </div>

        <div className="relative z-50" ref={destinationRef}>
          <label className="block text-sm font-medium text-gray-200 mb-1">Điểm đến</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10 12 3l9 7" />
              </svg>
            </span>
            <input
              className="w-full pl-10 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={destination.state.query}
              onChange={(e) => destination.setQuery(e.target.value)}
              onFocus={() => destination.setOpen(true)}
              placeholder="Thành phố muốn đến"
            />
          </div>
          {destination.state.open && destination.state.options.length > 0 && (
            <div className="absolute left-0 right-0 z-50 mt-1 bg-slate-900/95 backdrop-blur border border-white/10 rounded-lg shadow-xl max-h-60 overflow-auto pr-1">
              {destination.state.options.map((opt) => (
                <div
                  key={opt.id}
                  className="px-3 py-2 text-sm text-gray-100 hover:bg-sky-500/20 cursor-pointer"
                  onClick={() => destination.select(opt)}
                >
                  {opt.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-200 mb-1">Ngày khởi hành</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            <input
              type="date"
              className="w-full appearance-none pl-10 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onFocus={(e) => {
                // ensure the calendar pops immediately on focus when supported
                if (typeof (e.target as HTMLInputElement).showPicker === 'function') {
                  (e.target as HTMLInputElement).showPicker();
                }
              }}
            />
          </div>
        </div>

        <div className="md:flex md:justify-end">
          <Button type="submit" className="w-full md:w-auto">
            Tìm chuyến
          </Button>
        </div>
      </div>
      {error ? <div className="text-sm text-red-400 mt-2">{error}</div> : null}
    </form>
  );
};


