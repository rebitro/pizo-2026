// Razorpay checkout loader + helper
import { api, LOGO_URL } from "@/lib/api";

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

let _loadingPromise = null;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = RZP_SCRIPT;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { _loadingPromise = null; resolve(false); };
    document.body.appendChild(s);
  });
  return _loadingPromise;
}

/**
 * Initiate a Razorpay checkout end-to-end.
 * - Calls backend /payments/razorpay/order to create order
 * - Opens Razorpay checkout
 * - Verifies signature on success via /payments/razorpay/verify
 *
 * @param {object} opts
 * @param {number} opts.amount        Amount in rupees (whole INR)
 * @param {"subscription"|"owner_onboard"} opts.purpose
 * @param {string} [opts.plan_id]     Required for subscription
 * @param {string} [opts.name]        Prefill user name
 * @param {string} [opts.email]       Prefill email
 * @param {string} [opts.theme]       Hex color, defaults to gold
 * @param {string} [opts.description] Checkout description
 * @returns {Promise<{ok:true, payload:object}>}
 */
export async function startRazorpayCheckout({ amount, purpose, plan_id, purchase_payload, booking_payload, name, email, theme = "#D4AF37", description }) {
  const ok = await loadRazorpay();
  if (!ok) throw new Error("Failed to load Razorpay SDK. Check your network.");

  const { data: order } = await api.post("/payments/razorpay/order", {
    amount,
    purpose,
    plan_id,
    purchase_payload,
    notes: { description: description || purpose },
  });

  if (!order?.order_id || !order?.key_id) {
    const detail = order?.detail || "Payment provider is unavailable right now.";
    throw new Error(detail);
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: "PIZO • Pirates of Play",
      description: description || (purpose === "subscription" ? "Pirate Pass" : "Owner Onboarding"),
      image: LOGO_URL,
      prefill: { name: name || order.name, email: email || order.email },
      theme: { color: theme, backdrop_color: "#070707" },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      handler: async (resp) => {
        try {
          const { data } = await api.post("/payments/razorpay/verify", {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
            purpose,
            plan_id,
            purchase_payload,
            booking_payload,
          });
          resolve({ ok: true, payload: data });
        } catch (e) {
          reject(e);
        }
      },
    });
    rzp.on("payment.failed", (e) => {
      reject(new Error(e?.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}
