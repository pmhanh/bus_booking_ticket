import { Link } from 'react-router-dom';

export const AccountBannedPage = () => (
  <section
    className="mx-auto my-12 max-w-lg rounded-3xl border border-red-400/20 bg-white/5 px-6 py-10 text-center shadow-xl"
    aria-labelledby="account-banned-title"
  >
    <div
      aria-hidden="true"
      className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-red-500/10 text-red-300"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m6 6 12 12" />
      </svg>
    </div>
    <h1 id="account-banned-title" className="text-2xl font-bold text-white">
      Tài khoản bị cấm
    </h1>
    <p className="mt-4 text-gray-300">
      Tài khoản của bạn đã bị khóa quyền truy cập. Bạn không thể đăng nhập bằng
      tài khoản này.
    </p>
    <p className="mt-3 text-sm text-gray-400">
      Nếu cho rằng đây là nhầm lẫn, vui lòng liên hệ quản trị viên để được kiểm
      tra và hỗ trợ.
    </p>
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Link
        to="/login"
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90"
      >
        Đăng nhập tài khoản khác
      </Link>
      <Link
        to="/"
        className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
      >
        Về trang chủ
      </Link>
    </div>
  </section>
);
