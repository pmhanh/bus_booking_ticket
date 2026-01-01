import * as crypto from 'crypto';

export function hmacSHA256(raw: string, secretKey: string) {
  // trim + utf8 encode to avoid hidden whitespace or locale surprises
  return crypto.createHmac('sha256', secretKey.trim()).update(raw.trim(), 'utf8').digest('hex');
}

/**
 * MoMo yêu cầu rawSignature dạng key=value&key=value...
 * (tùy API, đúng thứ tự theo docs của endpoint)
 */
export type MomoCreateParams = {
  accessKey: string;
  amount: number;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
};

export function buildCreateRawSignature(params: MomoCreateParams) {
  const {
    accessKey,
    amount,
    extraData,
    ipnUrl,
    orderId,
    orderInfo,
    partnerCode,
    redirectUrl,
    requestId,
    requestType,
  } = params;

  // theo docs onetime/quickpay v2: các field này là core :contentReference[oaicite:1]{index=1}
  return (
    `accessKey=${accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`
  );
}

export function buildIpnRawSignature(params: Record<string, any>) {
  // IPN signature cũng là key=value&... theo docs signature
  // nhưng MoMo có nhiều biến thể; cách an toàn:
  // - lấy đúng field list theo docs IPN của requestType bạn dùng
  // Ở đây mình build theo bộ field phổ biến:
  const keys = [
    'accessKey',
    'amount',
    'extraData',
    'message',
    'orderId',
    'orderInfo',
    'orderType',
    'partnerCode',
    'payType',
    'requestId',
    'responseTime',
    'resultCode',
    'transId',
  ];

  return keys
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}
