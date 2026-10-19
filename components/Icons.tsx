// Stroke icons drawn for Bibliotheca. All decorative: the button or link carries the label.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
  </Svg>
);
export const IconLibrary = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h4v16H4z" />
    <path d="M10 4h4v16h-4z" />
    <path d="m16.5 5.2 3.6-1 3.2 15-3.6 1z" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 20h14" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <path d="M12 7.5v.01" />
  </Svg>
);
export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 13v7h14v-7" />
  </Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconBookmark = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M6.5 4h11v16.5l-5.5-4-5.5 4z" fill={filled ? "currentColor" : "none"} />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Svg>
);
export const IconList = (p: P) => (
  <Svg {...p}>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <path d="M4.5 6h.01" />
    <path d="M4.5 12h.01" />
    <path d="M4.5 18h.01" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M9.5 7V4.5h5V7" />
    <path d="M6 7l1 13h10l1-13" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
  </Svg>
);
export const IconWave = (p: P) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M4 10v4" />
    <path d="M8 7v10" />
    <path d="M12 4v16" />
    <path d="M16 8v8" />
    <path d="M20 11v2" />
  </Svg>
);
export const IconPrev = (p: P) => (
  <Svg {...p}>
    <path d="M6 5v14" />
    <path d="M19 5.5 9.5 12l9.5 6.5z" />
  </Svg>
);
export const IconNext = (p: P) => (
  <Svg {...p}>
    <path d="M18 5v14" />
    <path d="M5 5.5 14.5 12 5 18.5z" />
  </Svg>
);
export const IconBack15 = (p: P) => (
  <Svg {...p} strokeWidth={1.6}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 3.5v4h4" />
    <text x="12.2" y="15.4" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">
      15
    </text>
  </Svg>
);
export const IconFwd30 = (p: P) => (
  <Svg {...p} strokeWidth={1.6}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 3.5v4h-4" />
    <text x="11.8" y="15.4" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">
      30
    </text>
  </Svg>
);

export const IconPlay = ({ size = 24, ...p }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);
export const IconPause = ({ size = 24, ...p }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...p}>
    <rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
  </svg>
);
export const IconSpinner = ({ size = 24, ...p }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="spin" {...p}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="42 100" />
  </svg>
);

export const IconVolume = ({ level = 1, ...p }: P & { level?: number }) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {level > 0.05 && <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />}
    {level > 0.5 && <path d="M18 7a7 7 0 0 1 0 10" />}
  </Svg>
);
export const IconMute = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="m16 10 4 4M20 10l-4 4" />
  </Svg>
);
