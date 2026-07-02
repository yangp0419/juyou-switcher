import { X } from "lucide-react";

function getQrImageSrc(value: string): string {
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}`;
}

interface PaymentQrModalProps {
  qrCodeUrl: string;
  currentTradeNo: string;
  paymentPolling: boolean;
  onClose: () => void;
}

export function PaymentQrModal({
  qrCodeUrl,
  currentTradeNo,
  paymentPolling,
  onClose,
}: PaymentQrModalProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-[400px] rounded-xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 hover:bg-gray-100"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
        <h2 className="mb-4 text-center text-lg font-bold text-gray-900">
          微信扫码支付
        </h2>
        <div className="mb-4 flex justify-center">
          {qrCodeUrl ? (
            <img
              src={getQrImageSrc(qrCodeUrl)}
              alt="支付二维码"
              className="h-52 w-52 rounded-lg border-2 border-gray-200"
            />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
              正在生成二维码...
            </div>
          )}
        </div>
        <p className="mb-2 text-center text-sm text-gray-600">
          请使用微信扫描二维码完成支付
        </p>
        {paymentPolling && (
          <p className="text-center text-xs text-blue-600">等待支付中...</p>
        )}
        <div className="mt-4 text-center text-xs text-gray-400">
          订单号: {currentTradeNo || "加载中..."}
        </div>
      </div>
    </div>
  );
}
