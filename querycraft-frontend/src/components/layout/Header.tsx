import React from "react";

export const Header = () => {
  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between px-6"
      style={{
        borderBottom: "1px solid #1e293b", // aurora border
        background:
          "linear-gradient(135deg, #020817 0%, #071129 25%, #0b1f2b 50%, #081126 75%, #020817 100%)",
      }}
    >
      {/* Left side: App Title & Model Selector */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold" style={{ color: "#f8fafc" }}>
          Query
          <span style={{ color: "#0ea5e9" /* electric cyan accent */ }}>
            Craft
          </span>
        </h1>

        {/* Model selector */}
        <div
          className="hidden sm:flex items-center gap-2 cursor-pointer text-sm font-medium"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
            padding: "0.375rem 0.75rem",
            borderRadius: "0.5rem",
            color: "#94a3b8",
            border: "1px solid #1e293b",
          }}
        >
          <span>Mistral AI</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Right side: Action Icons */}
      <div className="flex items-center gap-4">
        {/* Avatar placeholder */}
        <div
          className="h-8 w-8 rounded-full"
          style={{ background: "#1e293b" }}
        ></div>

        {/* Accent circle */}
        <div
          className="h-8 w-8 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(14,165,233,1), rgba(139,92,246,1))",
          }}
        ></div>
      </div>
    </header>
  );
};
