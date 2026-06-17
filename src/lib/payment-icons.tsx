// Brand badge components rendered as inline SVG (look like card images).
// Sized via the `h` prop in pixels; width auto-scales.

type Props = { className?: string };

const Card = ({ bg, children, className }: { bg: string; children: React.ReactNode; className?: string }) => (
  <div
    className={`inline-flex items-center justify-center rounded-md shadow-sm ${className ?? ""}`}
    style={{
      width: 44,
      height: 28,
      background: bg,
      border: "1px solid rgba(0,0,0,0.08)",
    }}
  >
    {children}
  </div>
);

const Pix = ({ className }: Props) => (
  <Card bg="#ffffff" className={className}>
    <svg viewBox="0 0 32 32" width="22" height="22" aria-label="Pix">
      <g fill="#32BCAD">
        <path d="M21.6 24.3a3.6 3.6 0 01-2.5-1l-3.4-3.4a.7.7 0 00-1 0L11.3 23.3a3.6 3.6 0 01-2.5 1H8l4.3 4.3a3.6 3.6 0 005 0l4.3-4.3z" />
        <path d="M8.8 7.7a3.6 3.6 0 012.5 1l3.4 3.4a.7.7 0 001 0l3.4-3.4a3.6 3.6 0 012.5-1h.6l-4.3-4.3a3.6 3.6 0 00-5 0L7.6 7.7z" />
        <path d="M28.3 13.5l-2.6-2.6h-1.2a2.6 2.6 0 00-1.8.7l-3.4 3.4a1.7 1.7 0 01-2.4 0l-3.4-3.4a2.6 2.6 0 00-1.8-.7H8.5L5.7 13.7a3.6 3.6 0 000 5l2.8 2.8h1.7a2.6 2.6 0 001.8-.7l3.4-3.4a1.7 1.7 0 012.4 0l3.4 3.4a2.6 2.6 0 001.8.7h1.2l2.6-2.6a3.6 3.6 0 000-5z" />
      </g>
    </svg>
  </Card>
);

const Visa = ({ className }: Props) => (
  <Card bg="#1A1F71" className={className}>
    <span style={{ color: "#fff", fontFamily: "Arial, sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: 13, letterSpacing: 1 }}>
      VISA
    </span>
  </Card>
);

const Mastercard = ({ className }: Props) => (
  <Card bg="#ffffff" className={className}>
    <svg viewBox="0 0 36 22" width="30" height="20" aria-label="Mastercard">
      <circle cx="13" cy="11" r="9" fill="#EB001B" />
      <circle cx="23" cy="11" r="9" fill="#F79E1B" />
      <path d="M18 4.5a9 9 0 010 13 9 9 0 010-13z" fill="#FF5F00" />
    </svg>
  </Card>
);

const Elo = ({ className }: Props) => (
  <Card bg="#000000" className={className}>
    <span style={{ color: "#fff", fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>
      <span style={{ color: "#FFCB05" }}>e</span>
      <span style={{ color: "#fff" }}>l</span>
      <span style={{ color: "#EF4135" }}>o</span>
    </span>
  </Card>
);

const Amex = ({ className }: Props) => (
  <Card bg="#2E77BC" className={className}>
    <span style={{ color: "#fff", fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: 8, letterSpacing: 0.3, lineHeight: 1, textAlign: "center" }}>
      AMERICAN<br />EXPRESS
    </span>
  </Card>
);

const Hipercard = ({ className }: Props) => (
  <Card bg="#B3131B" className={className}>
    <span style={{ color: "#fff", fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: 9, fontStyle: "italic" }}>
      Hipercard
    </span>
  </Card>
);

const Boleto = ({ className }: Props) => (
  <Card bg="#ffffff" className={className}>
    <svg viewBox="0 0 24 24" width="22" height="14" aria-label="Boleto">
      <g fill="#111">
        <rect x="1" y="3" width="1.5" height="18" />
        <rect x="4" y="3" width="0.7" height="18" />
        <rect x="6" y="3" width="2" height="18" />
        <rect x="9.5" y="3" width="0.7" height="18" />
        <rect x="11.5" y="3" width="1.5" height="18" />
        <rect x="14.5" y="3" width="0.7" height="18" />
        <rect x="16.5" y="3" width="2" height="18" />
        <rect x="20" y="3" width="1.5" height="18" />
      </g>
    </svg>
  </Card>
);

const REGISTRY: Record<string, (p: Props) => JSX.Element> = {
  pix: Pix,
  visa: Visa,
  mastercard: Mastercard,
  elo: Elo,
  amex: Amex,
  "american-express": Amex,
  hipercard: Hipercard,
  boleto: Boleto,
};

export const PAYMENT_KEYS = Object.keys(REGISTRY);

export function PaymentBadge({ brand, className }: { brand: string; className?: string }) {
  const key = brand.trim().toLowerCase();
  const Comp = REGISTRY[key];
  if (!Comp) {
    return (
      <span
        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase ${className ?? ""}`}
        style={{ border: "1px solid rgba(0,0,0,0.15)" }}
      >
        {brand}
      </span>
    );
  }
  return <Comp className={className} />;
}
