// A quiet editorial motif, not a geographic data or crisis heat map.
export default function WorldMap() {
  return (
    <div className="map-motif" aria-hidden="true">
      <svg viewBox="0 0 320 180">
        <defs>
          <pattern
            id="map-dots"
            width="4.5"
            height="4.5"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="0.8" fill="#607e73" />
          </pattern>
        </defs>
        <g fill="url(#map-dots)">
          <path d="M20 43 40 24 60 20 78 14 110 22 115 39 98 51 92 74 72 86 62 102 50 83 38 71 31 57Z" />
          <path d="m93 15 19-9 16 6-9 20-18 5Z" />
          <path d="m77 103 26-6 20 22-6 22-16 27-12-21-2-25Z" />
          <path d="m149 43 12-18 26 2 12 10-4 20-25 6-16-8Z" />
          <path d="m154 67 25-12 24 11 8 29-20 39-23-20-9-22Z" />
          <path d="m195 31 26-16 48 3 33 25-11 22-28 5-1 24-20 15-16-18-6-25-27-8Z" />
          <path d="m255 132 30-8 19 19-11 11-34-4Z" />
          <path d="m240 107 7-5 5 17-6 5Z" />
          <path d="m278 88 6-5 4 11-7 5Z" />
        </g>
      </svg>
      <p>
        Different perspectives.
        <br />A clearer tomorrow.
      </p>
    </div>
  );
}
