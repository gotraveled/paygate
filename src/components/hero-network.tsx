/**
 * Original hero artwork — an abstract "global payment rail" map: nodes
 * (markets) linked by animated dashed flows converging on a routing core.
 * Pure SVG + CSS animation (pg-drift/pg-pulse/pg-flow), no assets, and it
 * stands still under prefers-reduced-motion.
 */
export function HeroNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 380"
      role="img"
      aria-label="Abstract illustration of payment providers connected across global markets"
      className={className}
      fill="none"
    >
      {/* radial arcs — latitude-like sweep lines */}
      <g stroke="rgba(137,163,199,0.22)" strokeWidth="1">
        <ellipse cx="260" cy="195" rx="225" ry="130" />
        <ellipse cx="260" cy="195" rx="165" ry="95" />
        <ellipse cx="260" cy="195" rx="95" ry="55" />
        <line x1="35" y1="195" x2="485" y2="195" />
        <path d="M60 130 Q260 60 460 130" />
        <path d="M60 260 Q260 330 460 260" />
      </g>

      {/* animated payment flows — dashed links between nodes */}
      <g strokeWidth="1.6" strokeLinecap="round">
        <path className="pg-flow" d="M95 120 C160 110 200 150 260 190" stroke="#3d72f0" />
        <path className="pg-flow" d="M425 105 C360 110 320 150 260 190" stroke="#26b89a" />
        <path className="pg-flow" d="M80 265 C150 265 200 230 260 190" stroke="#6397f7" style={{ animationDelay: "0.5s" }} />
        <path className="pg-flow" d="M440 270 C370 268 320 230 260 190" stroke="#93e8d0" style={{ animationDelay: "0.9s" }} />
        <path className="pg-flow" d="M260 330 C260 270 260 240 260 190" stroke="#5c7ca7" style={{ animationDelay: "1.3s" }} />
      </g>

      {/* outer market nodes */}
      <g>
        <circle className="pg-drift" cx="95" cy="120" r="7" fill="#0f1d36" stroke="#3d72f0" strokeWidth="2" />
        <circle className="pg-drift-slow" cx="425" cy="105" r="7" fill="#0f1d36" stroke="#26b89a" strokeWidth="2" />
        <circle className="pg-drift" cx="80" cy="265" r="7" fill="#0f1d36" stroke="#6397f7" strokeWidth="2" style={{ animationDelay: "1.2s" }} />
        <circle className="pg-drift-slow" cx="440" cy="270" r="7" fill="#0f1d36" stroke="#93e8d0" strokeWidth="2" style={{ animationDelay: "0.7s" }} />
        <circle className="pg-drift" cx="260" cy="330" r="7" fill="#0f1d36" stroke="#5c7ca7" strokeWidth="2" style={{ animationDelay: "2s" }} />
      </g>

      {/* pulse rings around nodes — "live" market signals */}
      <g>
        <circle className="pg-pulse" cx="95" cy="120" r="13" stroke="#3d72f0" strokeWidth="1" opacity="0.5" />
        <circle className="pg-pulse" cx="425" cy="105" r="13" stroke="#26b89a" strokeWidth="1" opacity="0.5" style={{ animationDelay: "0.8s" }} />
        <circle className="pg-pulse" cx="440" cy="270" r="13" stroke="#93e8d0" strokeWidth="1" opacity="0.5" style={{ animationDelay: "1.6s" }} />
        <circle className="pg-pulse" cx="80" cy="265" r="13" stroke="#6397f7" strokeWidth="1" opacity="0.5" style={{ animationDelay: "2.2s" }} />
      </g>

      {/* routing core */}
      <g>
        <circle cx="260" cy="190" r="30" fill="#152746" stroke="#3d72f0" strokeWidth="2" />
        <circle cx="260" cy="190" r="18" fill="#2658e3" />
        <circle cx="260" cy="190" r="6" fill="#ffffff" />
        <circle className="pg-pulse" cx="260" cy="190" r="40" stroke="#3d72f0" strokeWidth="1.4" opacity="0.45" />
        <circle className="pg-pulse" cx="260" cy="190" r="52" stroke="#3d72f0" strokeWidth="1" opacity="0.25" style={{ animationDelay: "1.1s" }} />
      </g>

      {/* small data ticks along flows */}
      <g fill="#c9f4e6">
        <circle className="pg-pulse" cx="180" cy="140" r="2.5" style={{ animationDelay: "0.3s" }} />
        <circle className="pg-pulse" cx="345" cy="135" r="2.5" style={{ animationDelay: "1.4s" }} />
        <circle className="pg-pulse" cx="170" cy="250" r="2.5" style={{ animationDelay: "2s" }} />
        <circle className="pg-pulse" cx="350" cy="248" r="2.5" style={{ animationDelay: "0.6s" }} />
        <circle className="pg-pulse" cx="260" cy="265" r="2.5" style={{ animationDelay: "1.8s" }} />
      </g>
    </svg>
  );
}
