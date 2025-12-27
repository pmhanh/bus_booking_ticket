import { HomeSearchForm } from '../components/HomeSearchForm';

export const HomePage = () => {
  // TODO: sau này có thể lấy từ localStorage hoặc API
  const recentRoutes = [
    { from: 'Sài Gòn', to: 'Đà Lạt', date: 'Hôm qua', price: '260.000đ' },
    { from: 'Hà Nội', to: 'Sa Pa', date: '2 ngày trước', price: '280.000đ' },
    { from: 'Đà Nẵng', to: 'Huế', date: 'Tuần này', price: '110.000đ' },
  ];

  return (
    <div className="relative bg-[#0b1021] pb-20">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-16 -top-16 h-64 w-64 bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 bg-sky-400/10 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto space-y-10">
        {/* TITLE */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">
            Đặt vé xe nhanh chóng, <span className="text-emerald-400">khởi hành bất cứ đâu.</span>
          </h1>
          <p className="text-gray-300 text-sm md:text-base mt-3">
            Tìm và so sánh hàng trăm tuyến xe khách, limousine từ nhiều nhà xe uy tín.
          </p>
        </div>

        {/* SEARCH BOX TO, Ở TRÊN CÙNG */}
        <div className="w-full flex justify-center">
          <div
            className="
              w-full 
              max-w-4xl 
              bg-white/10 
              backdrop-blur-xl 
              border border-white/20 
              rounded-3xl 
              p-6 md:p-8 
              shadow-[0_8px_30px_rgba(0,0,0,0.4)]
            "
          >
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 text-center">
              Tìm chuyến xe của bạn
            </h2>

            <HomeSearchForm />
          </div>
        </div>

        {/* TRUST METRICS 24/7 – 4.8 – % */}
        <div className="flex flex-wrap justify-center gap-6 text-xs md:text-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-300 text-xs font-semibold">
              24/7
            </div>
            <div>
              <div className="text-white font-semibold">Hỗ trợ 24/7</div>
              <div className="text-gray-400">Đồng hành suốt hành trình</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-300 text-xs font-semibold">
              4.8
            </div>
            <div>
              <div className="text-white font-semibold">Đánh giá cao</div>
              <div className="text-gray-400">Từ hàng nghìn lượt đặt vé</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-300 text-xs font-semibold">
              %
            </div>
            <div>
              <div className="text-white font-semibold">Giá minh bạch</div>
              <div className="text-gray-400">Không phí ẩn, xem giá cuối cùng</div>
            </div>
          </div>
        </div>

        {/* BLOCK "CHUYẾN TIẾP THEO" + TUYẾN ĐƯỜNG GẦN ĐÂY */}
        <section className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-stretch">
          {/* Card chuyến tiếp theo */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/25 via-sky-500/20 to-blue-600/25 border border-white/10 p-5 md:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-100 mb-1">
                  Chuyến tiếp theo
                </div>
                <div className="text-lg font-semibold text-white">Sài Gòn → Đà Lạt</div>
                <div className="text-xs text-gray-100 mt-1">
                  Limousine giường nằm • Wifi • Nước uống
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-100">Chỉ từ</div>
                <div className="text-xl font-bold text-emerald-200">260.000đ</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-100 mb-4">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-emerald-100/80">
                  Giờ khởi hành
                </div>
                <div className="text-sm font-medium text-white">22:30 • Hôm nay</div>
                <div className="text-[11px] text-gray-200">Bến xe Miền Đông mới</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-emerald-100/80">
                  Thời gian di chuyển
                </div>
                <div className="text-sm font-medium text-white">6 giờ 30 phút</div>
                <div className="text-[11px] text-gray-200">Đến nơi ~ 05:00 sáng</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-100 mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-emerald-100/80">
                  Ghế trống
                </div>
                <div className="text-sm font-semibold text-white">09 / 34</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-emerald-100/80">
                  Đánh giá nhà xe
                </div>
                <div className="text-sm font-semibold text-white">4.7 ★</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-emerald-100/80">
                  Hủy / đổi vé
                </div>
                <div className="text-sm font-semibold text-white">Hỗ trợ linh hoạt</div>
              </div>
            </div>

            <div className="h-20 rounded-2xl bg-black/20 border border-white/10 flex items-center px-4">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-xs font-bold text-slate-950">
                  GO
                </div>
                <div className="text-xs text-gray-100">
                  Bắt đầu từ ô tìm kiếm – nhập hành trình và xem ngay các lựa chọn tốt nhất.
                </div>
              </div>
            </div>
          </div>

          {/* TUYẾN ĐƯỜNG ĐÃ TÌM GẦN ĐÂY */}
          <div className="h-full">
            <div className="h-full rounded-3xl bg-white/5 border border-white/10 px-5 py-5 flex flex-col">
              <div className="space-y-3 mb-3">
                <div className="inline-flex uppercase items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-3 py-1 text-[13px] text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 " />
                  Tuyến đường đã tìm gần đây
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-semibold text-white mb-1">
                    Tiếp tục hành trình của bạn
                  </h3>
                </div>
              </div>

              <div className="flex-1 space-y-2 text-xs text-gray-200">
                {recentRoutes.map((route) => (
                  <button
                    key={`${route.from}-${route.to}-${route.date}`}
                    className="w-full text-left rounded-2xl bg-white/5 border border-white/10 px-3 py-2 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-white">
                        {route.from} → {route.to}
                      </span>
                      <span className="text-[11px] text-emerald-200">
                        {route.price}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>Đã tìm: {route.date}</span>
                      <span className="text-gray-300">Tiếp tục &gt;</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TUYẾN ĐƯỜNG PHỔ BIẾN */}
        <section className="mt-10">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3">
            Tuyến đường phổ biến
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { from: 'Sài Gòn', to: 'Đà Lạt', price: '260.000đ', time: '~ 6h30' },
              { from: 'Sài Gòn', to: 'Nha Trang', price: '320.000đ', time: '~ 8h' },
              { from: 'Hà Nội', to: 'Sa Pa', price: '280.000đ', time: '~ 6h' },
              { from: 'Hà Nội', to: 'Ninh Bình', price: '120.000đ', time: '~ 2h' },
              { from: 'Đà Nẵng', to: 'Huế', price: '110.000đ', time: '~ 2h30' },
              { from: 'Cần Thơ', to: 'Sài Gòn', price: '150.000đ', time: '~ 4h' },
            ].map((route) => (
              <button
                key={`${route.from}-${route.to}`}
                className="
                  group 
                  rounded-2xl 
                  bg-white/5 
                  border border-white/10 
                  px-4 py-3 
                  text-left 
                  hover:bg-white/10 
                  transition-all 
                  hover:scale-[1.02]
                "
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-white font-semibold text-sm">
                    {route.from} → {route.to}
                  </div>
                  <div className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                    {route.time}
                  </div>
                </div>
                <div className="text-xs text-gray-300">
                  Từ <span className="text-emerald-300 font-semibold">{route.price}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
