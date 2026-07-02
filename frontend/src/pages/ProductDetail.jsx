import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { startRazorpayCheckout } from "@/lib/razorpay";

export default function ProductDetail() {
  const { user, loading } = useAuth();
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loadingItem, setLoadingItem] = useState(true);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [cartCount, setCartCount] = useState(0);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingItem(true);
      try {
        const { data } = await api.get(`/merch/${itemId}`);
        setItem(data);
        setSelectedSize(data?.sizes?.[0] || "");
        setSelectedColor(data?.colors?.[0] || "");
        setRecipientName(user?.name || "");
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Could not load product");
      } finally {
        setLoadingItem(false);
      }
    };
    load();
  }, [itemId, user]);

  const mainImage = useMemo(() => {
    if (!item) return "";
    if (selectedColor && item.color_images?.[selectedColor]) return item.color_images[selectedColor];
    if (item.images?.length) return item.images[0];
    return item.image;
  }, [item, selectedColor]);

  useEffect(() => {
    const loadCart = async () => {
      if (!user) return;
      try {
        const { data } = await api.get("/me/merch/cart");
        setCartCount(data?.item_count || 0);
      } catch {
        setCartCount(0);
      }
    };
    loadCart();
  }, [user, orderPlaced]);

  const addToCart = async () => {
    if (!user) {
      toast.error("Please sign in to add items to cart");
      return;
    }
    try {
      await api.post("/merch/cart", {
        item_id: item.id,
        size: selectedSize,
        color: selectedColor,
        quantity,
      });
      toast.success(`${item.name} added to cart`);
      const { data } = await api.get("/me/merch/cart");
      setCartCount(data?.item_count || 0);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not add to cart");
    }
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to place an order");
      return;
    }
    if (!recipientName || !shippingAddress || !phone || !email) {
      toast.error("Please fill in your name, address, phone and email");
      return;
    }
    if (!selectedSize || !selectedColor) {
      toast.error("Please choose a size and color");
      return;
    }
    try {
      setIsPaying(true);
      if (paymentMethod !== "cod") {
        const { payload } = await startRazorpayCheckout({
          amount: item.price * quantity,
          purpose: "merch_purchase",
          purchase_payload: {
            item_id: item.id,
            size: selectedSize,
            color: selectedColor,
            quantity,
            shipping_address: shippingAddress,
            phone,
            email,
            payment_method: paymentMethod,
          },
          name: user.name,
          email,
          description: `Purchase ${item.name}`,
        });
        if (payload?.order) {
          setOrderPlaced(payload.order);
          toast.success("Order placed successfully");
        }
      } else {
        const { data } = await api.post("/merch/checkout", {
          items: [{ item_id: item.id, size: selectedSize, color: selectedColor, quantity }],
          name: recipientName,
          shipping_address: shippingAddress,
          phone,
          email,
          payment_method: paymentMethod,
        });
        setOrderPlaced(data.order);
        toast.success("Order placed successfully");
      }
    } catch (e) {
      if (e?.message !== "Payment cancelled") {
        toast.error(e?.response?.data?.detail || e?.message || "Could not place order");
      }
    } finally {
      setIsPaying(false);
    }
  };

  const lineTotal = useMemo(() => (item ? item.price * quantity : 0), [item, quantity]);

  if (loading || loadingItem) {
    return <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto text-zinc-400">Loading product…</main>;
  }

  if (!user) {
    return (
      <main className="pt-32 pb-24 px-6 max-w-4xl mx-auto text-center">
        <h1 className="font-display text-4xl font-black">Sign in to shop the merch.</h1>
        <Link to="/merch" className="text-[var(--pizo-gold-soft)] underline mt-3 inline-block">Back to merch</Link>
      </main>
    );
  }

  if (!item) {
    return <main className="pt-32 pb-24 px-6 max-w-4xl mx-auto">Product not found.</main>;
  }

  return (
    <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Back to merch
      </button>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="glass rounded-3xl p-3">
            <img src={mainImage} alt={item.name} className="w-full h-[420px] object-cover rounded-2xl" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {(item.images || []).map((img, idx) => (
              <img key={`${item.id}-${idx}`} src={img} alt={`${item.name}-${idx + 1}`} className="h-24 w-full object-cover rounded-2xl border border-white/10" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">PRODUCT DETAIL</div>
          <h1 className="font-display text-4xl font-black">{item.name}</h1>
          <p className="text-zinc-400">{item.description}</p>
          <div className="font-bebas text-4xl gold-text">₹{item.price}</div>

          <div className="glass rounded-2xl p-4">
            <div className="text-sm font-semibold mb-3">Product details</div>
            <div className="grid gap-3 md:grid-cols-3">
              {(item.details || []).map((detail) => (
                <div key={detail.label} className="rounded-xl border border-white/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{detail.label}</div>
                  <div className="mt-1 text-sm text-zinc-200">{detail.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 space-y-4">
            {item.sizes?.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">Size</div>
                <div className="flex flex-wrap gap-2">
                  {item.sizes.map((size) => (
                    <button key={size} type="button" onClick={() => setSelectedSize(size)} className={`px-3 py-2 rounded-full text-sm ${selectedSize === size ? "bg-[var(--pizo-coral)] text-white" : "bg-white/5 text-zinc-300"}`}>
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.colors?.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">Color</div>
                <div className="flex flex-wrap gap-2">
                  {item.colors.map((color) => (
                    <button key={color} type="button" onClick={() => setSelectedColor(color)} className={`px-3 py-2 rounded-full text-sm ${selectedColor === color ? "bg-[var(--pizo-gold)] text-black" : "bg-white/5 text-zinc-300"}`}>
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm font-semibold mb-2">Quantity</div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"><Minus size={16}/></button>
                <div className="min-w-[40px] text-center text-lg font-bold">{quantity}</div>
                <button type="button" onClick={() => setQuantity((q) => q + 1)} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"><Plus size={16}/></button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <ShoppingCart size={16} /> {cartCount} item{cartCount === 1 ? "" : "s"} in your cart
            </div>

            <button type="button" onClick={addToCart} className="w-full py-3 rounded-full bg-white/10 hover:bg-white/20 font-semibold">Add to Cart</button>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="font-semibold mb-3">Checkout</div>
            <form onSubmit={placeOrder} className="space-y-3">
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient name" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
              <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Shipping address" className="w-full min-h-[90px] bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm">
                <option value="wallet">Wallet</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="cod">COD</option>
              </select>

              <div className="rounded-2xl border border-white/10 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between"><span>Selected variant</span><span>{selectedSize || "—"} / {selectedColor || "—"}</span></div>
                <div className="flex items-center justify-between"><span>Quantity</span><span>{quantity}</span></div>
                <div className="flex items-center justify-between font-semibold"><span>Order total</span><span>₹{lineTotal}</span></div>
              </div>

              <button type="submit" disabled={isPaying} className="w-full py-3 rounded-full bg-[var(--pizo-coral)] text-white font-semibold disabled:opacity-60">{isPaying ? "Processing..." : "Place Order"}</button>
            </form>
          </div>

          {orderPlaced && (
            <div className="glass rounded-2xl p-4 border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 size={18} /> Order confirmed</div>
              <div className="mt-2 text-sm text-zinc-400">Your order {orderPlaced.order_id} is now pending. Track it in <Link to="/my-orders" className="text-[var(--pizo-gold-soft)] underline">My Orders</Link>.</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
