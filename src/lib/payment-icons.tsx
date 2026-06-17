// Brand badge components rendered as inline SVG — crisp, scalable, no cropping.

type Props = { className?: string };

const Card = ({
  bg,
  children,
  className,
}: {
  bg: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`inline-flex items-center justify-center rounded-md ${className ?? ""}`}
    style={{
      width: 52,
      height: 34,
      background: bg,
      border: "1px solid rgba(0,0,0,0.08)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
      overflow: "hidden",
      flexShrink: 0,
    }}
  >
    {children}
  </div>
);

const Pix = ({ className }: Props) => (
  <Card bg="#ffffff" className={className}>
    <svg viewBox="0 0 48 48" width="24" height="24" aria-label="Pix">
      <g fill="#32BCAD">
        <path d="M11.917 11.71h2.319a4.108 4.108 0 0 1 2.895 1.205l4.776 4.775a1.6 1.6 0 0 0 2.272 0l4.751-4.75a4.108 4.108 0 0 1 2.911-1.214h2.831L29.532 5.84a6.41 6.41 0 0 0-9.083 0l-8.532 8.532zM30.84 36.252a4.106 4.106 0 0 1-2.911-1.214l-4.75-4.75a1.65 1.65 0 0 0-2.273 0l-4.775 4.775a4.108 4.108 0 0 1-2.895 1.207H11.92l8.527 8.514a6.408 6.408 0 0 0 9.083 0l8.535-8.532z"/>
        <path d="M42.156 19.471 37 14.314a.79.79 0 0 1-.27.057h-3.293a2.846 2.846 0 0 0-2 .828l-4.75 4.75a4.143 4.143 0 0 1-5.864 0l-4.776-4.775a2.844 2.844 0 0 0-2-.83h-4.043a.778.778 0 0 1-.255-.054l-5.18 5.181a6.41 6.41 0 0 0 0 9.083l5.18 5.18a.788.788 0 0 1 .255-.054h4.043a2.844 2.844 0 0 0 2-.828l4.776-4.777a4.144 4.144 0 0 1 5.864 0l4.75 4.751a2.846 2.846 0 0 0 2 .828h3.293a.78.78 0 0 1 .27.058l5.156-5.157a6.41 6.41 0 0 0 0-9.084"/>
      </g>
    </svg>
  </Card>
);

const Visa = ({ className }: Props) => (
  <Card bg="#1A1F71" className={className}>
    <svg viewBox="0 0 60 20" width="40" height="14" aria-label="Visa">
      <text
        x="30"
        y="16"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="18"
        fill="#ffffff"
        letterSpacing="1"
      >
        VISA
      </text>
    </svg>
  </Card>
);

const Mastercard = ({ className }: Props) => (
  <Card bg="#ffffff" className={className}>
    <svg viewBox="0 0 40 24" width="36" height="22" aria-label="Mastercard">
      <circle cx="15" cy="12" r="8.5" fill="#EB001B" />
      <circle cx="25" cy="12" r="8.5" fill="#F79E1B" />
      <path
        d="M20 5.6a8.5 8.5 0 0 1 0 12.8 8.5 8.5 0 0 1 0-12.8z"
        fill="#FF5F00"
      />
    </svg>
  </Card>
);

const Elo = ({ className }: Props) => (
  <Card bg="#000000" className={className}>
    <svg viewBox="0 0 40 20" width="32" height="16" aria-label="Elo">
      <text
        x="20"
        y="15"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="14"
        fontStyle="italic"
      >
        <tspan fill="#FFCB05">e</tspan>
        <tspan fill="#ffffff">l</tspan>
        <tspan fill="#EF4135">o</tspan>
      </text>
    </svg>
  </Card>
);

const Amex = ({ className }: Props) => (
  <Card bg="#2E77BC" className={className}>
    <svg viewBox="0 0 50 30" width="44" height="26" aria-label="American Express">
      <text
        x="25"
        y="13"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="8"
        fill="#ffffff"
      >
        AMERICAN
      </text>
      <text
        x="25"
        y="22"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="8"
        fill="#ffffff"
      >
        EXPRESS
      </text>
    </svg>
  </Card>
);

const Hipercard = ({ className }: Props) => (
  <Card bg="#B3131B" className={className}>
    <svg viewBox="0 0 60 20" width="46" height="14" aria-label="Hipercard">
      <text
        x="30"
        y="15"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="11"
        fontStyle="italic"
        fill="#ffffff"
      >
        Hipercard
      </text>
    </svg>
  </Card>
);

const Boleto = ({ className }: Props) => (
  <Card bg="#ffffff" className={className}>
    <svg viewBox="0 0 32 18" width="32" height="18" aria-label="Boleto">
      <g fill="#111111">
        <rect x="2" y="2" width="2" height="14" />
        <rect x="5" y="2" width="1" height="14" />
        <rect x="7" y="2" width="2.5" height="14" />
        <rect x="10.5" y="2" width="1" height="14" />
        <rect x="13" y="2" width="2" height="14" />
        <rect x="16" y="2" width="1" height="14" />
        <rect x="18" y="2" width="2.5" height="14" />
        <rect x="22" y="2" width="1" height="14" />
        <rect x="24" y="2" width="2" height="14" />
        <rect x="27" y="2" width="2" height="14" />
      </g>
    </svg>
  </Card>
);

const REGISTRY: Record<string, React.FC<Props>> = {
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
        style={{ border: "1px solid rgba(0,0,0,0.15)", background: "#fff", color: "#111" }}
      >
        {brand}
      </span>
    );
  }
  return <Comp className={className} />;
}
