type TripFareProps = {
  price: number | string | null | undefined;
};

export const TripFare = ({ price }: TripFareProps) => {
  const amount =
    price === null || price === undefined || price === '' ? NaN : Number(price);

  return (
    <div>
      <div className="text-xs font-medium uppercase text-gray-400">Giá vé</div>
      <div className="mt-1 text-2xl font-bold text-emerald-300">
        {Number.isFinite(amount) && amount >= 0 ? (
          <>
            {amount.toLocaleString('vi-VN')} đ
            <span className="ml-1 text-sm font-normal text-gray-400">
              / ghế
            </span>
          </>
        ) : (
          <span className="text-sm font-normal text-gray-400">
            Chưa có thông tin giá
          </span>
        )}
      </div>
    </div>
  );
};
