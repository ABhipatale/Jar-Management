<!doctype html>
<html lang="mr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{ $name }} — पेमेंट / Payment</title>
<style>
  :root { --brand: #1d45d8; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; font-family: 'Noto Sans Devanagari', 'Nirmala UI', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
         color: var(--ink); background: linear-gradient(160deg, #0b2a7a, var(--brand) 45%, #0ea5e9); display: flex; justify-content: center; padding: 20px 14px; }
  .card { width: 100%; max-width: 420px; background: #fff; border-radius: 26px; padding: 22px 20px 20px; box-shadow: 0 30px 60px rgba(2, 6, 23, .35); text-align: center; align-self: flex-start; }
  .shop { display: flex; align-items: center; justify-content: center; gap: 12px; }
  .shop img { width: 48px; height: 48px; border-radius: 14px; object-fit: contain; background: #fff; box-shadow: 0 0 0 1px var(--line); }
  .shop h1 { margin: 0; font-size: 21px; line-height: 1.25; text-align: left; }
  .sub { color: var(--muted); font-size: 13.5px; margin-top: 2px; text-align: left; }
  .amount { margin: 18px 0 4px; padding: 14px; border-radius: 18px; background: #fef2f2; box-shadow: inset 0 0 0 1px #fecaca; }
  .amount small { display: block; color: #b91c1c; font-weight: 600; font-size: 13px; }
  .amount b { display: block; font-size: 34px; color: #b91c1c; letter-spacing: -.5px; }
  .qr { margin: 16px auto 6px; padding: 10px; border-radius: 18px; box-shadow: 0 0 0 1px var(--line); display: inline-block; background: #fff; }
  .qr img { display: block; width: 100%; max-width: 300px; height: auto; border-radius: 10px; }
  .hint { color: var(--muted); font-size: 13.5px; line-height: 1.5; margin: 8px 4px 14px; }
  .btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; border-radius: 14px; font-size: 16px; font-weight: 700;
         text-decoration: none; border: 0; cursor: pointer; margin-top: 10px; font-family: inherit; }
  .primary { background: linear-gradient(135deg, #16a34a, #059669); color: #fff; box-shadow: 0 10px 22px -8px rgba(5, 150, 105, .6); }
  .light { background: #f1f5f9; color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); }
  .upi { margin-top: 14px; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: #f8fafc; box-shadow: inset 0 0 0 1px var(--line); text-align: left; }
  .upi span { flex: 1; min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
  .upi small { display: block; color: var(--muted); font-weight: 500; font-size: 12px; }
  .upi button { flex: none; padding: 8px 12px; border-radius: 10px; border: 0; background: var(--brand); color: #fff; font-weight: 700; font-family: inherit; }
  .foot { margin-top: 16px; color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<main class="card">
  <div class="shop">
    @if ($logo)<img src="{{ $logo }}" alt="">@endif
    <div>
      <h1>{{ $name }}</h1>
      <div class="sub">पेमेंट करा · Pay</div>
    </div>
  </div>

  @if ($amount !== null)
    <div class="amount">
      <small>बाकी रक्कम · Amount due</small>
      <b>₹{{ number_format($amount, $amount == floor($amount) ? 0 : 2) }}</b>
    </div>
  @endif

  @if ($qrUrl)
    <div class="qr"><img src="{{ $qrUrl }}" alt="Payment QR"></div>
    <p class="hint">
      दुसऱ्या फोनवरून हा QR स्कॅन करा, किंवा QR डाउनलोड करून UPI ॲपमध्ये <b>“Scan from gallery”</b> निवडा.<br>
      Scan this QR from another phone, or download it and use “Scan from gallery” in your UPI app.
    </p>
    <a class="btn light" href="{{ $qrUrl }}" download="payment-qr.png">⬇️ QR डाउनलोड करा · Download QR</a>
  @endif

  @if ($upiLink)
    <a class="btn primary" href="{{ $upiLink }}">💳 UPI ॲपने पेमेंट करा · Pay with UPI app</a>
    <div class="upi">
      <span><small>UPI ID</small>{{ $upi }}</span>
      <button type="button" id="copy" data-upi="{{ $upi }}">कॉपी · Copy</button>
    </div>
  @endif

  <div class="foot">पेमेंट केल्यावर दुकानदाराला कळवा. · After paying, please inform the shop.</div>
</main>
<script>
  const b = document.getElementById('copy');
  if (b) b.addEventListener('click', () => {
    navigator.clipboard?.writeText(b.dataset.upi).then(() => { b.textContent = '✓'; setTimeout(() => (b.textContent = 'कॉपी · Copy'), 1500); });
  });
</script>
</body>
</html>
