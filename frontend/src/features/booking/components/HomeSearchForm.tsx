import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { searchCities, type CityOption } from '../../route/api/cities';

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

function getTodayYYYYMMDD() {
  return new Date().toISOString().split('T')[0];
}

function useClickOutside(
  refs: Array<React.RefObject<HTMLElement | null>>,
  onOutside: () => void
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const isInside = refs.some((r) => r.current?.contains(target));
      if (!isInside) onOutside();
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [refs, onOutside]);
}

type UseCityAutocompleteProps = {
  initialValue?: CityOption | null;
  limit?: number;
};

const useCityAutocomplete = ({ initialValue = null, limit = 10 }: UseCityAutocompleteProps = {}) => {
  const [query, setQuery] = useState(initialValue?.name ?? '');
  const [selected, setSelected] = useState<CityOption | null>(initialValue);
  const [options, setOptions] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // chống race condition (request cũ về sau không đè request mới)
  const reqIdRef = useRef(0);

  const loadPopular = useCallback(async () => {
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const result = await searchCities('', limit); // backend: '' => popular
      if (reqIdRef.current !== myReqId) return;
      setOptions(result);
    } catch {
      if (reqIdRef.current !== myReqId) return;
      setOptions([]);
    } finally {
      if (reqIdRef.current === myReqId) setLoading(false);
    }
  }, [limit]);

  // Debounce search khi query có chữ và open = true
  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (!q) return; // query rỗng => không search (sẽ load popular khi focus)

    const myReqId = ++reqIdRef.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchCities(q, limit);
        if (reqIdRef.current !== myReqId) return;
        setOptions(result);
      } catch {
        if (reqIdRef.current !== myReqId) return;
        setOptions([]);
      } finally {
        if (reqIdRef.current === myReqId) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query, open, limit]);

  const onChange = (value: string) => {
    setQuery(value);
    setSelected(null); // user gõ lại => reset selected
    setOpen(true);
  };

  const onFocus = () => {
    setOpen(true);
    if (!query.trim() && options.length === 0 && !loading) {
      void loadPopular();
    }
  };

  const onSelect = (opt: CityOption) => {
    setQuery(opt.name);
    setSelected(opt);
    setOpen(false);
  };

  const close = () => setOpen(false);

  const clear = () => {
    setQuery('');
    setSelected(null);
    setOptions([]);
    setOpen(false);
    reqIdRef.current++; // invalidate request đang bay
  };

  const setInitial = (opt: CityOption | null) => {
    setSelected(opt);
    setQuery(opt?.name ?? '');
  };

  return {
    query,
    selected,
    options,
    open,
    loading,
    onChange,
    onFocus,
    onSelect,
    close,
    clear,
    setInitial,
    setOpen,
  };
};

type AutocompleteInputProps = {
  label: string;
  placeholder?: string;
  value: string;
  loading: boolean;
  open: boolean;
  options: CityOption[];
  onChange: (v: string) => void;
  onFocus: () => void;
  onSelect: (opt: CityOption) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  icon?: React.ReactNode;
  hoverClassName?: string;
  invalid?: boolean;
};

const AutocompleteInput = ({
  label,
  placeholder,
  value,
  loading,
  open,
  options,
  onChange,
  onFocus,
  onSelect,
  containerRef,
  inputRef,
  icon,
  hoverClassName = 'hover:bg-emerald-500/20',
  invalid = false,
}: AutocompleteInputProps) => {
  const showDropdown = open && (loading || options.length > 0);

  return (
    <div className="relative z-50" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-200 mb-1">{label}</label>

      <div className="relative">
        {icon ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
        ) : null}

        <input
          ref={inputRef}
          className={[
            'w-full rounded-lg bg-black/40 border px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2',
            icon ? 'pl-10' : 'pl-3',
            invalid
              ? 'border-red-500/60 focus:ring-red-400'
              : 'border-white/10 focus:ring-emerald-400',
          ].join(' ')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-slate-900/95 backdrop-blur border border-white/10 rounded-lg shadow-xl max-h-60 overflow-auto pr-1">
          {loading ? <div className="px-3 py-2 text-sm text-gray-400">Đang tải...</div> : null}

          {!loading && options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">Không có kết quả</div>
          ) : null}

          {!loading &&
            options.map((opt) => (
              <div
                key={opt.id}
                className={`px-3 py-2 text-sm text-gray-100 ${hoverClassName} cursor-pointer`}
                onClick={() => onSelect(opt)}
              >
                {opt.name}
              </div>
            ))}
        </div>
      )}
    </div>
  );
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
  const today = useMemo(() => getTodayYYYYMMDD(), []);

  const [invalid, setInvalid] = useState({
    origin: false,
    destination: false,
    date: false,
  });

  const originRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useClickOutside([originRef, destinationRef], () => {
    origin.close();
    destination.close();
  });

  useEffect(() => {
    if (initialOrigin) {
      origin.setInitial({ id: initialOrigin.id, name: initialOrigin.name, code: 0, slug: '' });
    }
    if (initialDestination) {
      destination.setInitial({
        id: initialDestination.id,
        name: initialDestination.name,
        code: 0,
        slug: '',
      });
    }
    if (initialDate) setDate(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrigin?.id, initialDestination?.id, initialDate]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setInvalid({ origin: false, destination: false, date: false });

      const o = origin.selected;
      const d = destination.selected;

      if (!o) {
        setInvalid((p) => ({ ...p, origin: true }));
        origin.setOpen(true);
        originInputRef.current?.focus();
        return;
      }

      if (!d) {
        setInvalid((p) => ({ ...p, destination: true }));
        destination.setOpen(true);
        destinationInputRef.current?.focus();
        return;
      }

      if (!date) {
        setInvalid((p) => ({ ...p, date: true }));
        dateInputRef.current?.focus();
        if (typeof dateInputRef.current?.showPicker === 'function') {
          dateInputRef.current.showPicker();
        }
        return;
      }

      if (o.id === d.id) {
        setInvalid((p) => ({ ...p, destination: true }));
        destination.setOpen(true);
        destinationInputRef.current?.focus();
        return;
      }

      if (date < today) {
        setInvalid((p) => ({ ...p, date: true }));
        dateInputRef.current?.focus();
        if (typeof dateInputRef.current?.showPicker === 'function') {
          dateInputRef.current.showPicker();
        }
        return;
      }

      if (onSubmit) {
        onSubmit({
          originId: o.id,
          destinationId: d.id,
          date,
          originName: o.name,
          destinationName: d.name,
        });
      } else {
        navigate(`/search?originId=${o.id}&destinationId=${d.id}&date=${date}`);
      }
    },
    [date, today, origin, destination, onSubmit, navigate]
  );

  return (
    <form onSubmit={handleSubmit} className="relative z-50 space-y-4">
      <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        <AutocompleteInput
          label="Điểm đi"
          placeholder="Thành phố xuất phát"
          value={origin.query}
          loading={origin.loading}
          open={origin.open}
          options={origin.options}
          onChange={(v) => {
            setInvalid((p) => ({ ...p, origin: false }));
            origin.onChange(v);
          }}
          onFocus={() => {
            setInvalid((p) => ({ ...p, origin: false }));
            origin.onFocus();
          }}
          onSelect={(opt) => {
            setInvalid((p) => ({ ...p, origin: false }));
            origin.onSelect(opt);
            destination.clear(); // UX: đổi điểm đi => reset điểm đến
          }}
          containerRef={originRef}
          inputRef={originInputRef}
          invalid={invalid.origin}
          icon={
            <span className="text-emerald-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.5 19l19-7-19-7 5 7-5 7z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12h1.5" />
              </svg>
            </span>
          }
          hoverClassName="hover:bg-emerald-500/20"
        />

        <AutocompleteInput
          label="Điểm đến"
          placeholder="Thành phố muốn đến"
          value={destination.query}
          loading={destination.loading}
          open={destination.open}
          options={destination.options}
          onChange={(v) => {
            setInvalid((p) => ({ ...p, destination: false }));
            destination.onChange(v);
          }}
          onFocus={() => {
            setInvalid((p) => ({ ...p, destination: false }));
            destination.onFocus();
          }}
          onSelect={(opt) => {
            setInvalid((p) => ({ ...p, destination: false }));
            destination.onSelect(opt);
          }}
          containerRef={destinationRef}
          inputRef={destinationInputRef}
          invalid={invalid.destination}
          icon={
            <span className="text-sky-300">
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
          }
          hoverClassName="hover:bg-sky-500/20"
        />

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
              ref={dateInputRef}
              type="date"
              min={today}
              className={[
                'w-full appearance-none pl-10 rounded-lg bg-black/40 border px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 cursor-pointer',
                invalid.date ? 'border-red-500/60 focus:ring-red-400' : 'border-white/10 focus:ring-emerald-400',
                '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0',
              ].join(' ')}
              value={date}
              onChange={(e) => {
                setInvalid((p) => ({ ...p, date: false }));
                setDate(e.target.value);
              }}
              onFocus={(e) => {
                setInvalid((p) => ({ ...p, date: false }));
                const el = e.target as HTMLInputElement;
                if (typeof el.showPicker === 'function') el.showPicker();
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
    </form>
  );
};
