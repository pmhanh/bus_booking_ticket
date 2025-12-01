import { HomeSearchForm } from '../components/search/HomeSearchForm';

export const HomePage = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-3xl w-full">
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Đặt vé xe khách dễ dàng</h1>
          <p className="text-gray-400 text-sm md:text-base">
            Chọn điểm đi, điểm đến và ngày khởi hành để tìm chuyến phù hợp.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 backdrop-blur">
          <HomeSearchForm />
        </div>
      </div>
    </div>
  );
};
