// Razorpay Checkout (their payment popup), loaded only when someone pays.
const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading = null;

function load() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.onload = resolve;
    s.onerror = () => {
      loading = null;
      reject(new Error('razorpay'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens Checkout for a subscription created by our API (/billing/subscribe).
 * Resolves with { razorpay_payment_id, razorpay_subscription_id, razorpay_signature },
 * resolves null if the user closed the popup, rejects if the payment failed.
 */
export async function payWithRazorpay(order, { color = '#1d45d8' } = {}) {
  await load();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      subscription_id: order.subscription_id,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color },
      handler: resolve,
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'failed')));
    rzp.open();
  });
}
