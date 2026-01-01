import { Link, useSearchParams } from "react-router-dom";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";

type Props = { status: "success" | "cancel" };

function StripeResultPage({ status }: Props) {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const isSuccess = status === "success";
  const title = isSuccess ? "Thanh toán thành công" : "Thanh toán bị hủy";
  const description = isSuccess
    ? "Stripe đã xác nhận thanh toán, bạn có thể kiểm tra vé hoặc email xác nhận."
    : "Bạn đã hủy thanh toán. Có thể quay lại chọn phương thức khác hoặc thử lại.";

  return (
    <div className="max-w-xl mx-auto mt-12 space-y-4">
      <Card>
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="text-gray-300 text-sm">{description}</p>
          {sessionId ? (
            <p className="text-xs text-gray-400">Session: {sessionId}</p>
          ) : null}
          <div className="flex gap-3 justify-center pt-2">
            <Link to="/bookings">
              <Button variant="primary">Xem vé/đơn đặt</Button>
            </Link>
            <Link to="/search">
              <Button variant="secondary">Tiếp tục đặt vé</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export const StripeSuccessPage = () => <StripeResultPage status="success" />;
export const StripeCancelPage = () => <StripeResultPage status="cancel" />;
