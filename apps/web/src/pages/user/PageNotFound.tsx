import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home } from "lucide-react";

const PageNotFound = () => {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center relative overflow-hidden"
      style={{ backgroundColor: "#FAF7F2" }}
    >
      {/* soft decorative glow */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ backgroundColor: "#C8A96E" }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ backgroundColor: "#8B5A2B" }}
      />

      {/* barber illustration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-xs sm:max-w-sm mb-2"
      >
        <svg
          viewBox="0 0 680 460"
          style={{ width: "100%", height: "auto" }}
          role="img"
          aria-label="Illustration of a barber cutting a client's hair"
        >
          <title>Barber cutting a client's hair</title>

          <rect x="0" y="0" width="680" height="460" fill="#FAF7F2" />
          <circle cx="560" cy="90" r="70" fill="#C8A96E" opacity="0.15" />
          <circle cx="90" cy="380" r="90" fill="#8B5A2B" opacity="0.12" />

          {/* floor line */}
          <line x1="60" y1="440" x2="620" y2="440" stroke="#C8A96E" strokeWidth="1" opacity="0.5" />

          {/* barber chair */}
          <rect x="225" y="270" width="230" height="150" rx="18" fill="#2C1810" />
          <rect x="245" y="260" width="190" height="40" rx="14" fill="#2C1810" />
          <rect x="300" y="415" width="80" height="16" rx="4" fill="#2C1810" />
          <rect x="260" y="430" width="30" height="14" rx="3" fill="#8B5A2B" />
          <rect x="390" y="430" width="30" height="14" rx="3" fill="#8B5A2B" />

          {/* client cape */}
          <path
            d="M240 320 Q340 300 440 320 L460 440 L220 440 Z"
            fill="#8B5A2B"
            stroke="#2C1810"
            strokeWidth="1"
          />

          {/* client neck */}
          <rect x="322" y="255" width="36" height="30" rx="8" fill="#E8B98C" />

          {/* client head */}
          <g>
            <circle cx="340" cy="220" r="52" fill="#EFC49A" />
            <path
              d="M290 195 Q300 150 340 148 Q385 150 392 198 Q392 175 370 165 Q350 155 335 165 Q315 158 300 175 Q292 183 290 195 Z"
              fill="#3C2A1E"
            />
            <ellipse cx="292" cy="222" rx="8" ry="13" fill="#EFC49A" />
            <circle cx="325" cy="222" r="3" fill="#2C1810" />
            <circle cx="352" cy="222" r="3" fill="#2C1810" />
            <path
              d="M322 244 Q338 254 356 244"
              fill="none"
              stroke="#2C1810"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* falling hair clippings */}
          <motion.rect
            x="300"
            y="180"
            width="10"
            height="2.5"
            rx="1.2"
            fill="#3C2A1E"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [300, 300, 286, 286],
              y: [180, 180, 330, 330],
              rotate: [0, 0, 80, 80],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeIn", times: [0, 0.1, 0.9, 1] }}
          />
          <motion.rect
            x="315"
            y="178"
            width="8"
            height="2.5"
            rx="1.2"
            fill="#3C2A1E"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [315, 315, 321, 321],
              y: [178, 178, 333, 333],
              rotate: [0, 0, -70, -70],
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeIn",
              delay: 0.4,
              times: [0, 0.1, 0.9, 1],
            }}
          />
          <motion.rect
            x="330"
            y="182"
            width="9"
            height="2.5"
            rx="1.2"
            fill="#3C2A1E"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [330, 330, 322, 322],
              y: [182, 182, 330, 330],
              rotate: [0, 0, 60, 60],
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeIn",
              delay: 0.8,
              times: [0, 0.1, 0.9, 1],
            }}
          />

          {/* barber body */}
          <path d="M430 210 Q470 190 500 215 L515 340 Q470 355 425 340 Z" fill="#2C1810" />
          <path d="M450 210 Q470 202 490 212 L488 230 Q470 222 452 230 Z" fill="#C8A96E" />

          {/* barber neck + head */}
          <rect x="452" y="178" width="26" height="24" rx="6" fill="#D9A066" />
          <circle cx="465" cy="158" r="34" fill="#E3B27C" />
          <path
            d="M432 150 Q436 118 465 116 Q495 118 498 152 Q490 130 465 128 Q442 128 434 148 Z"
            fill="#1E140E"
          />
          <circle cx="453" cy="160" r="2.4" fill="#2C1810" />
          <circle cx="475" cy="160" r="2.4" fill="#2C1810" />
          <path
            d="M455 175 Q465 181 476 175"
            fill="none"
            stroke="#2C1810"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* barber's comb arm (static) */}
          <path
            d="M432 225 Q400 220 380 205"
            fill="none"
            stroke="#2C1810"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <rect x="368" y="196" width="30" height="8" rx="3" fill="#5F5E5A" />

          {/* barber's scissor arm (animated) */}
          <motion.g
            style={{ transformOrigin: "446px 232px" }}
            animate={{ rotate: [0, -6, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          >
            <path
              d="M446 232 Q420 222 402 202"
              fill="none"
              stroke="#2C1810"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <g transform="translate(392,192) rotate(20)">
              <motion.path
                d="M0 0 L26 -6 L30 -3 L4 4 Z"
                fill="#B4B2A9"
                style={{ transformOrigin: "2px 0px" }}
                animate={{ rotate: [0, -9, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.path
                d="M0 0 L26 8 L30 5 L4 -2 Z"
                fill="#888780"
                style={{ transformOrigin: "2px 0px" }}
                animate={{ rotate: [0, 9, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
              <circle cx="2" cy="0" r="3.5" fill="#5F5E5A" />
            </g>
          </motion.g>
        </svg>
      </motion.div>

      {/* 404 */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="text-8xl md:text-9xl font-bold"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          color: "#2C1810",
          letterSpacing: "0.02em",
        }}
      >
        404
      </motion.h1>

      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 80, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="h-[2px] mt-3 mb-5"
        style={{ backgroundColor: "#C8A96E" }}
      />

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-xl font-semibold"
        style={{ fontFamily: "'Jost', sans-serif", color: "#2C1810" }}
      >
        Page not found
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.42 }}
        className="mt-2 max-w-md"
        style={{ fontFamily: "'Jost', sans-serif", color: "#8B5A2B" }}
      >
        Sorry, we couldn't find the page you're looking for. It might have
        been moved or doesn't exist.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
      >
        <Link to="/">
          <motion.button
            whileHover={{ scale: 1.04, backgroundColor: "#8B5A2B" }}
            whileTap={{ scale: 0.97 }}
            className="mt-8 inline-flex items-center gap-2 rounded-md px-7 py-3 text-white font-medium transition-colors"
            style={{
              backgroundColor: "#2C1810",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            <Home size={18} />
            Go back home
          </motion.button>
        </Link>
      </motion.div>
    </div>
  );
};

export default PageNotFound;